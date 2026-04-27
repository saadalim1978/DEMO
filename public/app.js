import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const dom = {
  scene: document.querySelector("#scene"),
  assetName: document.querySelector("#assetName"),
  scenarioName: document.querySelector("#scenarioName"),
  interventionName: document.querySelector("#interventionName"),
  lastUpdate: document.querySelector("#lastUpdate"),
  disclaimer: document.querySelector("#disclaimer"),
  healthMetric: document.querySelector("#healthMetric"),
  riskMetric: document.querySelector("#riskMetric"),
  perfusionMetric: document.querySelector("#perfusionMetric"),
  pulseMetric: document.querySelector("#pulseMetric"),
  bpMetric: document.querySelector("#bpMetric"),
  alertBadge: document.querySelector("#alertBadge"),
  sensorList: document.querySelector("#sensorList"),
  interventionList: document.querySelector("#interventionList"),
  predictionList: document.querySelector("#predictionList"),
  eventList: document.querySelector("#eventList"),
  aiAnswer: document.querySelector("#aiAnswer"),
  aiEvidence: document.querySelector("#aiEvidence"),
  aiSource: document.querySelector("#aiSource"),
  questionInput: document.querySelector("#questionInput"),
  askBtn: document.querySelector("#askBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  resetCameraBtn: document.querySelector("#resetCameraBtn")
};

const statusColors = {
  normal: 0x46c483,
  warning: 0xf4b740,
  critical: 0xef4b5f
};

const statusLabels = {
  normal: "طبيعي",
  warning: "تنبيه",
  critical: "حرج",
  info: "معلومة",
  watch: "متابعة"
};

let twinState = null;
let selectedSensorId = null;
let renderer = null;
let controls = null;
let humanGroup;
let sensorMeshes = new Map();
let bloodParticles = [];
let glucoseParticles = [];
let webglSignalChecked = false;
let framesWithoutSignal = 0;

const disease = {};
const bodyParts = {};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0d10);
scene.fog = new THREE.Fog(0x0c0d10, 10, 24);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
camera.position.set(0.35, 0.88, 7.25);

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  dom.scene.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0.58, 0.12);
  controls.maxPolarAngle = Math.PI * 0.64;
  controls.minDistance = 4.3;
  controls.maxDistance = 11.5;
} catch {
  document.body.classList.add("webgl-fallback");
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

if (renderer) initScene();
wireEvents();
resize();
refreshTwin().then(() => askAi("حلل حالة الجسم الآن مع التركيز على السكري والضغط والجلطات."));
setInterval(refreshTwin, 2600);
if (renderer) requestAnimationFrame(animate);

function initScene() {
  const ambient = new THREE.HemisphereLight(0xf7fbff, 0x211017, 1.05);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 2.65);
  key.position.set(4.5, 7, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  const redFill = new THREE.PointLight(0xef4b5f, 17, 9);
  redFill.position.set(-3.6, 2.4, 2.9);
  scene.add(redFill);

  const cyanFill = new THREE.PointLight(0x48c7d8, 14, 9);
  cyanFill.position.set(3.4, 2.8, -2.2);
  scene.add(cyanFill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8.8, 8.8),
    new THREE.MeshStandardMaterial({
      color: 0x14171d,
      roughness: 0.82,
      metalness: 0.08
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.42;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(8.8, 24, 0x33434c, 0x20262d);
  grid.position.y = -2.405;
  scene.add(grid);

  addBodyTwinModel();
}

function addBodyTwinModel() {
  humanGroup = new THREE.Group();
  humanGroup.rotation.set(-0.02, -0.02, 0);
  humanGroup.scale.setScalar(0.94);
  scene.add(humanGroup);

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8c2aa,
    roughness: 0.62,
    metalness: 0.02,
    clearcoat: 0.16,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide
  });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x6a3a3a, transparent: true, opacity: 0.16, side: THREE.BackSide });
  const vesselRed = vesselMaterial(0xff5d73, 0x5a0610, 0.35);
  const vesselBlue = vesselMaterial(0x4cc9f0, 0x052d4a, 0.24);
  const boneMat = boneMaterial();

  const torso = addEllipsoid("body-shell", [0, 0.9, 0], [0.88, 1.35, 0.42], skinMat);
  const torsoBack = new THREE.Mesh(torso.geometry, outlineMat);
  torsoBack.position.copy(torso.position);
  torsoBack.scale.copy(torso.scale).multiplyScalar(1.02);
  humanGroup.add(torsoBack);

  addEllipsoid("pelvis-shell", [0, -0.55, 0], [0.58, 0.38, 0.36], skinMat, [0, 0, 0.05]);
  addEllipsoid("head-shell", [0, 2.84, 0.02], [0.36, 0.42, 0.34], skinMat);
  capsuleBetween([0, 2.25, 0], [0, 2.52, 0], 0.12, skinMat);

  capsuleBetween([-0.62, 1.82, 0], [-1.28, 0.52, 0.02], 0.09, skinMat);
  capsuleBetween([0.62, 1.82, 0], [1.28, 0.52, 0.02], 0.09, skinMat);
  capsuleBetween([-0.32, -0.82, 0], [-0.42, -2.14, 0.02], 0.13, skinMat);
  capsuleBetween([0.32, -0.82, 0], [0.42, -2.14, 0.02], 0.13, skinMat);

  createSkeleton(boneMat);
  bodyParts.brain = addEllipsoid("brain", [0, 2.91, 0.08], [0.28, 0.18, 0.24], organMaterial(0xa78bfa, 0x221146, 0.82));
  addBrainFolds();

  bodyParts.leftLung = addEllipsoid("left-lung", [-0.28, 1.48, 0.2], [0.28, 0.58, 0.17], organMaterial(0x48c7d8, 0x07334a, 0.62), [0.04, 0, -0.08]);
  bodyParts.rightLung = addEllipsoid("right-lung", [0.28, 1.48, 0.2], [0.28, 0.58, 0.17], organMaterial(0x48c7d8, 0x07334a, 0.62), [0.04, 0, 0.08]);
  bodyParts.heart = addEllipsoid("heart", [-0.12, 1.24, 0.44], [0.17, 0.25, 0.16], organMaterial(0xef4b5f, 0x4c0712, 0.95), [0.08, 0.16, -0.2]);
  bodyParts.liver = addEllipsoid("liver", [0.28, 0.66, 0.34], [0.36, 0.22, 0.16], organMaterial(0x9a4d2f, 0x341006, 0.84), [0, 0, -0.08]);
  bodyParts.pancreas = capsuleBetween([-0.38, 0.72, 0.44], [0.24, 0.76, 0.46], 0.055, organMaterial(0xf4b740, 0x5a3600, 0.95));
  bodyParts.leftKidney = addEllipsoid("left-kidney", [-0.38, 0.34, 0.22], [0.13, 0.22, 0.1], organMaterial(0xc084fc, 0x28113c, 0.88), [0, 0.18, -0.18]);
  bodyParts.rightKidney = addEllipsoid("right-kidney", [0.38, 0.34, 0.22], [0.13, 0.22, 0.1], organMaterial(0xc084fc, 0x28113c, 0.88), [0, -0.18, 0.18]);
  createDigestiveSystem();

  createTube(
    [
      [-0.12, 1.2, 0.5],
      [-0.02, 1.62, 0.48],
      [0, 2.12, 0.32],
      [-0.1, 2.48, 0.2],
      [0, 2.78, 0.1]
    ],
    0.045,
    vesselRed,
    "aorta-up"
  );
  createTube(
    [
      [-0.1, 1.18, 0.48],
      [-0.02, 0.55, 0.42],
      [0, -0.35, 0.34],
      [-0.28, -1.12, 0.23],
      [-0.4, -2.02, 0.18]
    ],
    0.04,
    vesselRed,
    "leg-artery-left"
  );
  createTube(
    [
      [-0.02, -0.35, 0.34],
      [0.28, -1.12, 0.22],
      [0.4, -2.02, 0.18]
    ],
    0.036,
    vesselRed,
    "leg-artery-right"
  );
  createTube(
    [
      [0.18, 1.18, 0.39],
      [0.08, 0.46, 0.33],
      [-0.18, -0.55, 0.26],
      [-0.38, -1.6, 0.2]
    ],
    0.035,
    vesselBlue,
    "vein-left"
  );
  createTube(
    [
      [0.18, 1.15, 0.38],
      [0.22, 0.42, 0.32],
      [0.38, -0.58, 0.24],
      [0.48, -1.75, 0.18]
    ],
    0.032,
    vesselBlue,
    "vein-right"
  );
  createTube(
    [
      [-0.02, 2.02, 0.34],
      [-0.18, 2.34, 0.28],
      [-0.22, 2.72, 0.16]
    ],
    0.024,
    vesselRed,
    "carotid-left"
  );
  createTube(
    [
      [0.02, 2.02, 0.34],
      [0.18, 2.34, 0.28],
      [0.22, 2.72, 0.16]
    ],
    0.024,
    vesselRed,
    "carotid-right"
  );

  createDiseaseLayers();
  createBloodParticles();
  createGlucoseParticles();
  createVascularAndNerveNetwork();
  createAnatomyLabels();
}

function createSkeleton(boneMat) {
  addEllipsoid("skull", [0, 2.86, -0.02], [0.31, 0.38, 0.28], boneMat);
  addEllipsoid("jaw", [0, 2.6, 0.04], [0.22, 0.09, 0.18], boneMat);
  capsuleBetween([0, 2.23, 0.02], [0, -0.72, 0.02], 0.032, boneMat);
  for (let i = 0; i < 16; i += 1) {
    const y = 2.15 - i * 0.18;
    addEllipsoid(`vertebra-${i}`, [0, y, 0.03], [0.07, 0.045, 0.04], boneMat);
  }

  capsuleBetween([-0.58, 1.9, 0.12], [-0.08, 1.78, 0.15], 0.035, boneMat);
  capsuleBetween([0.58, 1.9, 0.12], [0.08, 1.78, 0.15], 0.035, boneMat);
  capsuleBetween([-0.08, 1.82, 0.16], [0.08, 0.78, 0.18], 0.035, boneMat);

  for (let i = 0; i < 8; i += 1) {
    const y = 1.68 - i * 0.12;
    const width = 0.26 + i * 0.045;
    createRib(-1, y, width, boneMat);
    createRib(1, y, width, boneMat);
  }

  createPelvis(boneMat);
  createLimbBones(boneMat);
}

function createRib(side, y, width, material) {
  const points = [
    [0.06 * side, y, 0.12],
    [side * width * 0.58, y + 0.05, 0.18],
    [side * width, y - 0.02, 0.09],
    [side * width * 0.82, y - 0.12, -0.08],
    [side * 0.14, y - 0.08, -0.05]
  ];
  createTube(points, 0.014, material, `rib-${side}-${y}`);
}

function createPelvis(material) {
  createTube([[-0.48, -0.48, 0.05], [-0.25, -0.72, 0.12], [0, -0.66, 0.14], [0.25, -0.72, 0.12], [0.48, -0.48, 0.05]], 0.032, material, "pelvis-front");
  createTube([[-0.48, -0.48, 0.05], [-0.58, -0.74, 0], [-0.32, -0.92, 0.03], [-0.08, -0.72, 0.12]], 0.028, material, "pelvis-left");
  createTube([[0.48, -0.48, 0.05], [0.58, -0.74, 0], [0.32, -0.92, 0.03], [0.08, -0.72, 0.12]], 0.028, material, "pelvis-right");
}

function createLimbBones(material) {
  const limbs = [
    [[-0.62, 1.78, 0.05], [-0.9, 1.03, 0.05], [-1.23, 0.5, 0.05]],
    [[0.62, 1.78, 0.05], [0.9, 1.03, 0.05], [1.23, 0.5, 0.05]],
    [[-0.27, -0.78, 0.04], [-0.35, -1.4, 0.04], [-0.43, -2.12, 0.04]],
    [[0.27, -0.78, 0.04], [0.35, -1.4, 0.04], [0.43, -2.12, 0.04]]
  ];
  limbs.forEach(([a, b, c], index) => {
    capsuleBetween(a, b, index < 2 ? 0.024 : 0.034, material);
    capsuleBetween(b, c, index < 2 ? 0.018 : 0.024, material);
    addEllipsoid(`joint-${index}`, b, index < 2 ? [0.045, 0.045, 0.04] : [0.06, 0.05, 0.045], material);
  });

  createHand(-1, material);
  createHand(1, material);
  createFoot(-1, material);
  createFoot(1, material);
}

function createHand(side, material) {
  const wrist = new THREE.Vector3(side * 1.23, 0.5, 0.05);
  for (let i = 0; i < 5; i += 1) {
    const spread = (i - 2) * 0.045;
    capsuleBetween([wrist.x, wrist.y, wrist.z], [side * (1.34 + i * 0.018), 0.27 + spread, 0.06], 0.007, material);
  }
}

function createFoot(side, material) {
  const ankle = [side * 0.43, -2.12, 0.04];
  for (let i = 0; i < 5; i += 1) {
    capsuleBetween(ankle, [side * (0.32 + i * 0.055), -2.31, 0.24], 0.01, material);
  }
}

function createDigestiveSystem() {
  const stomachMat = organMaterial(0xff9f80, 0x44140c, 0.86);
  addEllipsoid("stomach", [-0.22, 0.55, 0.48], [0.18, 0.28, 0.12], stomachMat, [0, 0.1, -0.2]);
  const intestineMat = vesselMaterial(0xffb3a7, 0x4e1b16, 0.08);
  for (let row = 0; row < 5; row += 1) {
    const y = 0.18 - row * 0.11;
    const points = [];
    for (let i = 0; i < 20; i += 1) {
      const t = i / 19;
      const x = -0.34 + t * 0.68;
      const wiggle = Math.sin(t * Math.PI * 5 + row) * 0.06;
      points.push([x, y + wiggle, 0.48 + Math.cos(t * Math.PI * 4) * 0.025]);
    }
    createTube(points, 0.026, intestineMat, `intestine-${row}`);
  }
  addEllipsoid("bladder", [0, -0.58, 0.38], [0.12, 0.13, 0.1], organMaterial(0xff77aa, 0x4c0b24, 0.86));
}

function createVascularAndNerveNetwork() {
  const artery = vesselMaterial(0xff4d6d, 0x520411, 0.22);
  const vein = vesselMaterial(0x35c7ff, 0x033247, 0.18);
  const nerve = vesselMaterial(0xffd166, 0x493000, 0.12);
  const colors = [artery, vein, nerve];
  const offsets = [-0.032, 0.032, 0.072];

  [
    { side: -1, points: [[-0.56, 1.78, 0.24], [-0.82, 1.18, 0.25], [-1.12, 0.56, 0.24], [-1.32, 0.26, 0.22]] },
    { side: 1, points: [[0.56, 1.78, 0.24], [0.82, 1.18, 0.25], [1.12, 0.56, 0.24], [1.32, 0.26, 0.22]] },
    { side: -1, points: [[-0.22, -0.7, 0.25], [-0.34, -1.25, 0.25], [-0.42, -1.78, 0.23], [-0.46, -2.22, 0.2]] },
    { side: 1, points: [[0.22, -0.7, 0.25], [0.34, -1.25, 0.25], [0.42, -1.78, 0.23], [0.46, -2.22, 0.2]] }
  ].forEach((limb) => {
    colors.forEach((mat, index) => {
      const shifted = limb.points.map(([x, y, z]) => [x + limb.side * offsets[index], y, z + index * 0.018]);
      createTube(shifted, index === 2 ? 0.006 : 0.008, mat, `network-${limb.side}-${index}`);
    });
    for (let i = 1; i < limb.points.length - 1; i += 1) {
      const [x, y, z] = limb.points[i];
      createTube([[x, y, z], [x + limb.side * 0.16, y - 0.08, z + 0.03]], 0.0045, nerve, "nerve-branch");
      createTube([[x, y, z + 0.02], [x - limb.side * 0.14, y - 0.06, z + 0.03]], 0.0045, vein, "vein-branch");
    }
  });

  createTube([[0, 2.72, 0.16], [-0.16, 2.48, 0.2], [-0.32, 2.22, 0.24], [-0.48, 1.9, 0.25]], 0.006, nerve, "neck-nerve-left");
  createTube([[0, 2.72, 0.16], [0.16, 2.48, 0.2], [0.32, 2.22, 0.24], [0.48, 1.9, 0.25]], 0.006, nerve, "neck-nerve-right");
}

function createDiseaseLayers() {
  disease.pancreasGlow = addGlowSphere([0, 0.74, 0.48], [0.62, 0.2, 0.12], 0xf4b740);
  disease.glucoseField = new THREE.Group();
  disease.pressure = new THREE.Group();
  disease.clot = createClotGroup([-0.38, -1.62, 0.2]);
  disease.lungClot = createClotGroup([0.34, 1.55, 0.45], 0.68);
  disease.brain = addGlowSphere([0, 2.92, 0.1], [0.44, 0.28, 0.32], 0xa78bfa);
  disease.carotid = createClotGroup([-0.2, 2.36, 0.26], 0.52);
  disease.kidney = new THREE.Group();

  for (let i = 0; i < 4; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38 + i * 0.19, 0.01, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0xef4b5f, transparent: true, opacity: 0.34, depthWrite: false })
    );
    ring.position.set(0, 1.18 - i * 0.16, 0.42);
    ring.rotation.set(Math.PI / 2.35, 0, 0);
    disease.pressure.add(ring);
  }
  humanGroup.add(disease.pressure);

  [[-0.38, 0.34, 0.22], [0.38, 0.34, 0.22]].forEach((pos) => {
    const glow = addGlowSphere(pos, [0.2, 0.3, 0.16], 0xc084fc);
    disease.kidney.add(glow);
  });
  humanGroup.add(disease.kidney);

  Object.values(disease).forEach((item) => {
    if (item) item.visible = false;
  });
}

function createBloodParticles() {
  const material = new THREE.MeshBasicMaterial({ color: 0xffc8c8 });
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.1, 1.18, 0.52),
    new THREE.Vector3(0, 1.7, 0.48),
    new THREE.Vector3(0, 2.35, 0.24),
    new THREE.Vector3(-0.02, 0.45, 0.38),
    new THREE.Vector3(-0.36, -1.9, 0.18),
    new THREE.Vector3(0.34, -1.8, 0.18),
    new THREE.Vector3(0.18, 1.0, 0.4)
  ]);

  for (let i = 0; i < 46; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), material.clone());
    const t = i / 46;
    particle.position.copy(path.getPointAt(t));
    particle.userData = { t, path, speed: 0.45 + (i % 5) * 0.045 };
    bloodParticles.push(particle);
    humanGroup.add(particle);
  }
}

function createGlucoseParticles() {
  const material = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 42; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), material.clone());
    particle.position.set((Math.random() - 0.5) * 1.3, 0.1 + Math.random() * 1.65, 0.32 + Math.random() * 0.35);
    particle.userData = { baseY: particle.position.y, speed: 0.8 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2 };
    glucoseParticles.push(particle);
    disease.glucoseField.add(particle);
  }
  disease.glucoseField.visible = false;
  humanGroup.add(disease.glucoseField);
}

function createAnatomyLabels() {
  createAnatomyLabel("الدماغ", "#a78bfa", [0.62, 2.95, 0.25]);
  createAnatomyLabel("الرئتان", "#48c7d8", [0.85, 1.66, 0.28]);
  createAnatomyLabel("القلب", "#ef4b5f", [-0.58, 1.25, 0.72]);
  createAnatomyLabel("البنكرياس", "#f4b740", [-0.72, 0.74, 0.74]);
  createAnatomyLabel("الكلى", "#c084fc", [0.74, 0.34, 0.42]);
  createAnatomyLabel("أوعية رئيسية", "#ff5d73", [0.66, 1.03, 0.76]);
}

function addBrainFolds() {
  const foldMat = new THREE.LineBasicMaterial({ color: 0xefe7ff, transparent: true, opacity: 0.42 });
  for (let i = 0; i < 5; i += 1) {
    const points = [];
    for (let j = 0; j < 24; j += 1) {
      const u = (j / 23) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(u) * (0.12 + i * 0.025), 2.92 + Math.sin(u * 2 + i) * 0.018, 0.1 + Math.sin(u) * (0.07 + i * 0.018)));
    }
    humanGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), foldMat));
  }
}

function createClotGroup(position, scale = 1) {
  const group = new THREE.Group();
  const clotMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f1d1b,
    roughness: 0.72,
    metalness: 0.05,
    emissive: 0x2f0505,
    emissiveIntensity: 0.36
  });
  [
    [[0, 0, 0], 0.1],
    [[0.08, 0.025, 0.01], 0.065],
    [[-0.06, -0.03, 0.02], 0.055]
  ].forEach(([offset, size]) => {
    const clot = new THREE.Mesh(new THREE.DodecahedronGeometry(size * scale, 1), clotMaterial);
    clot.position.set(...offset);
    clot.castShadow = true;
    group.add(clot);
  });
  group.position.set(...position);
  group.visible = false;
  humanGroup.add(group);
  return group;
}

function addGlowSphere(position, scale, color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 36, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false })
  );
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.visible = false;
  humanGroup.add(mesh);
  return mesh;
}

function addEllipsoid(name, position, scale, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  humanGroup.add(mesh);
  return mesh;
}

function capsuleBetween(start, end, radius, material) {
  const group = new THREE.Group();
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const cylinder = cylinderBetween(a, b, radius, material);
  group.add(cylinder);
  [a, b].forEach((point) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
    cap.position.copy(point);
    cap.castShadow = true;
    group.add(cap);
  });
  humanGroup.add(group);
  return group;
}

function createTube(points, radius, material, name = "") {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 18, false), material);
  mesh.name = name;
  mesh.castShadow = true;
  humanGroup.add(mesh);
  return mesh;
}

function cylinderBetween(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(direction.multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(end, start).normalize());
  mesh.castShadow = true;
  return mesh;
}

function organMaterial(color, emissive, opacity = 0.86) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.48,
    metalness: 0.03,
    clearcoat: 0.35,
    clearcoatRoughness: 0.42,
    emissive,
    emissiveIntensity: 0.24,
    transparent: true,
    opacity
  });
}

function boneMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xf2e6d2,
    roughness: 0.56,
    metalness: 0.04,
    emissive: 0x3d2d1a,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.86
  });
}

function vesselMaterial(color, emissive, emissiveIntensity = 0.22) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.24,
    emissive,
    emissiveIntensity
  });
}

function createAnatomyLabel(text, color, position) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";
  ctx.fillStyle = "rgba(12, 13, 16, 0.78)";
  roundRect(ctx, 42, 42, 428, 76, 24);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#fff8f2";
  ctx.font = "800 32px Segoe UI, Tahoma, Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, 256, 92);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(...position);
  sprite.scale.set(0.78, 0.24, 1);
  humanGroup.add(sprite);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function buildSensors(sensors) {
  const seen = new Set();
  sensors.forEach((sensor) => {
    seen.add(sensor.id);
    const color = statusColors[sensor.status] || statusColors.normal;
    let group = sensorMeshes.get(sensor.id);
    if (!group) {
      group = new THREE.Group();
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.066, 24, 18),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.78,
          roughness: 0.25,
          metalness: 0.12
        })
      );
      shell.name = "sensor-shell";
      shell.userData.sensorId = sensor.id;
      group.add(shell);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.006, 8, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.name = "sensor-ring";
      ring.userData.sensorId = sensor.id;
      group.add(ring);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.28, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24 })
      );
      stem.position.y = -0.14;
      group.add(stem);

      group.userData.sensorId = sensor.id;
      sensorMeshes.set(sensor.id, group);
      scene.add(group);
    }

    group.position.set(...sensor.position);
    group.userData.sensor = sensor;
    const shell = group.getObjectByName("sensor-shell");
    const ring = group.getObjectByName("sensor-ring");
    shell.material.color.setHex(color);
    shell.material.emissive.setHex(color);
    shell.material.emissiveIntensity = sensor.status === "critical" ? 1.45 : sensor.status === "warning" ? 1.08 : 0.68;
    ring.material.color.setHex(color);
    group.scale.setScalar(sensor.id === selectedSensorId ? 1.32 : 1);
  });

  for (const [id, group] of sensorMeshes) {
    if (!seen.has(id)) {
      scene.remove(group);
      sensorMeshes.delete(id);
    }
  }
}

async function refreshTwin() {
  try {
    const response = await fetch("/api/twin");
    if (!response.ok) throw new Error("API error");
    twinState = await response.json();
    selectedSensorId ||= twinState.sensors[0]?.id;
    renderTwin(twinState);
  } catch {
    dom.aiAnswer.textContent = "تعذر الاتصال بواجهة API المحلية.";
  }
}

function renderTwin(state) {
  document.body.dataset.scenario = state.scenario.id;
  dom.assetName.textContent = state.asset.name;
  dom.scenarioName.textContent = state.scenario.label;
  dom.interventionName.textContent = state.intervention.label;
  dom.disclaimer.textContent = state.disclaimer;
  dom.lastUpdate.textContent = new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(state.generatedAt));

  dom.healthMetric.textContent = `${state.summary.health}%`;
  dom.riskMetric.textContent = `${state.summary.risk}%`;
  dom.perfusionMetric.textContent = `${state.summary.glucose} mg/dL`;
  dom.pulseMetric.textContent = `${state.summary.bloodPressure}`;
  dom.bpMetric.textContent = `${state.summary.heartRate} bpm · O2 ${state.summary.oxygen}%`;
  dom.alertBadge.textContent = `${state.summary.openAlerts} تنبيه`;

  document.querySelectorAll(".scenario-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === state.scenario.id);
  });

  if (renderer && humanGroup) {
    updateDiseaseVisuals(state);
    buildSensors(state.sensors);
  }
  renderSensors(state.sensors);
  renderInterventions(state.interventions);
  renderPredictions(state.prediction);
  renderEvents(state.events);
  refreshIcons();
}

function updateDiseaseVisuals(state) {
  Object.values(disease).forEach((item) => {
    if (item) item.visible = false;
  });

  const lesions = state.lesions || [];
  const has = (type) => lesions.find((lesion) => lesion.type === type);
  const diabetes = has("diabetes");
  const glucose = has("glucose");
  const hypertension = has("hypertension");
  const clot = has("clot");
  const lungClot = has("lung-clot");
  const stroke = has("stroke");
  const carotid = has("carotid");
  const kidney = has("kidney");

  if (diabetes) {
    disease.pancreasGlow.visible = true;
    disease.pancreasGlow.material.opacity = 0.16 + diabetes.severity * 0.28;
  }
  if (glucose) {
    disease.glucoseField.visible = true;
    disease.glucoseField.children.forEach((particle) => {
      particle.material.opacity = 0.45 + glucose.severity * 0.44;
    });
  }
  if (hypertension) {
    disease.pressure.visible = true;
    disease.pressure.children.forEach((ring) => {
      ring.material.opacity = 0.18 + hypertension.severity * 0.34;
      ring.material.color.set(hypertension.color);
    });
  }
  if (clot) {
    disease.clot.visible = true;
    disease.clot.position.set(...clot.position);
    const scale = 0.8 + clot.severity * 1.15;
    disease.clot.scale.set(scale, scale, scale);
  }
  if (lungClot) {
    disease.lungClot.visible = true;
    disease.lungClot.position.set(...lungClot.position);
  }
  if (stroke) {
    disease.brain.visible = true;
    disease.brain.material.opacity = 0.16 + stroke.severity * 0.35;
  }
  if (carotid) {
    disease.carotid.visible = true;
    disease.carotid.position.set(...carotid.position);
  }
  if (kidney) {
    disease.kidney.visible = true;
    disease.kidney.children.forEach((glow) => {
      glow.visible = true;
      glow.material.opacity = 0.12 + kidney.severity * 0.28;
    });
  }
}

function renderSensors(sensors) {
  dom.sensorList.innerHTML = "";
  sensors.forEach((sensor) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `sensor-item ${sensor.id === selectedSensorId ? "selected" : ""}`;
    item.dataset.sensorId = sensor.id;
    item.innerHTML = `
      <span class="status-dot ${sensor.status === "warning" ? "status-warning" : ""} ${sensor.status === "critical" ? "status-critical" : ""}"></span>
      <span class="item-main">
        <strong>${escapeHtml(sensor.name)}</strong>
        <small>${statusLabels[sensor.status]} · ${escapeHtml(sensor.zone)}</small>
      </span>
      <span class="sensor-value">${sensor.value} ${escapeHtml(sensor.unit)}</span>
    `;
    item.addEventListener("click", () => {
      selectedSensorId = sensor.id;
      focusSensor(sensor.id);
      renderTwin(twinState);
    });
    dom.sensorList.appendChild(item);
  });
}

function renderInterventions(options) {
  dom.interventionList.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `intervention-btn ${option.active ? "active" : ""}`;
    button.dataset.intervention = option.id;
    button.title = option.description;
    button.innerHTML = `<i data-lucide="${iconForIntervention(option.id)}"></i><span>${escapeHtml(option.label)}</span>`;
    button.addEventListener("click", async () => {
      await fetch("/api/twin/intervene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervention: option.id })
      });
      await refreshTwin();
      askAi(`حلل تأثير تدخل ${option.label} في السيناريو الحالي.`);
    });
    dom.interventionList.appendChild(button);
  });
}

function iconForIntervention(id) {
  return {
    observe: "eye",
    lifestyle: "footprints",
    glucose_control: "droplets",
    pressure_control: "gauge",
    clot_pathway: "route"
  }[id] || "activity";
}

function renderPredictions(prediction) {
  const rows = [
    ["خطر السكري", `${Math.round(prediction.diabetesProbability * 100)}%`, "نموذج أيضي تعليمي"],
    ["خطر الضغط", `${Math.round(prediction.hypertensionProbability * 100)}%`, "اعتمادًا على الضغط وتيبس الأوعية"],
    ["خطر الجلطات", `${Math.round(prediction.clotProbability * 100)}%`, "قابلية التخثر وD-dimer"],
    ["إشارات سكتة", `${Math.round(prediction.strokeSignalProbability * 100)}%`, prediction.suggestedMonitoring]
  ];

  dom.predictionList.innerHTML = rows
    .map(
      ([title, value, caption]) => `
    <article class="prediction-item">
      <strong>${escapeHtml(title)}: ${escapeHtml(value)}</strong>
      <small>${escapeHtml(caption)}</small>
    </article>
  `
    )
    .join("");
}

function renderEvents(events) {
  dom.eventList.innerHTML = events
    .map(
      (event) => `
    <article class="event-item ${escapeHtml(event.level)}">
      <strong>${escapeHtml(event.title)}</strong>
      <small>${escapeHtml(event.message)}</small>
    </article>
  `
    )
    .join("");
}

async function askAi(defaultQuestion) {
  const question = defaultQuestion || dom.questionInput.value.trim() || "حلل حالة التوأم الرقمي للجسم الآن.";
  dom.askBtn.disabled = true;
  dom.aiAnswer.textContent = "جاري التحليل...";
  dom.aiEvidence.innerHTML = "";

  try {
    const response = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const result = await response.json();
    dom.aiSource.textContent = result.source === "openai" ? "OpenAI" : "Local AI";
    dom.aiAnswer.textContent = result.answer;
    dom.aiEvidence.innerHTML = [
      ...(result.evidence || []),
      ...(result.actions || []).slice(0, 2).map((action) => `إجراء: ${action}`)
    ]
      .map((item) => `<div class="evidence-item">${escapeHtml(item)}</div>`)
      .join("");
  } catch {
    dom.aiAnswer.textContent = "تعذر تشغيل التحليل الآن. تحقق من اتصال API المحلي.";
  } finally {
    dom.askBtn.disabled = false;
  }
}

function wireEvents() {
  window.addEventListener("resize", resize);
  dom.refreshBtn.addEventListener("click", refreshTwin);
  dom.resetCameraBtn.addEventListener("click", resetCamera);
  dom.askBtn.addEventListener("click", () => askAi());

  dom.questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) askAi();
  });

  document.querySelectorAll(".scenario-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      await fetch("/api/twin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: button.dataset.scenario })
      });
      await refreshTwin();
      askAi(`حلل سيناريو ${button.textContent.trim()} الحالي.`);
    });
  });

  if (!renderer) return;
  renderer.domElement.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = [...sensorMeshes.values()].flatMap((group) => group.children);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const sensorId = hit?.object?.userData?.sensorId;
    if (sensorId) {
      selectedSensorId = sensorId;
      renderTwin(twinState);
    }
  });
}

function focusSensor(sensorId) {
  const group = sensorMeshes.get(sensorId);
  if (!group || !controls) return;
  controls.target.copy(group.position);
}

function resetCamera() {
  camera.position.set(0.35, 0.88, 7.25);
  controls?.target.set(0, 0.58, 0.12);
}

function resize() {
  if (!renderer) return;
  const rect = dom.scene.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(320, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const mobileLayout = width < 520;
  if (mobileLayout && !camera.userData.mobileLayout) {
    camera.position.set(0.28, 0.72, 8.05);
    controls?.target.set(0, 0.52, 0.12);
    camera.userData.mobileLayout = true;
  } else if (!mobileLayout && camera.userData.mobileLayout) {
    resetCamera();
    camera.userData.mobileLayout = false;
  }
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  controls?.update();

  if (humanGroup) {
    const breathing = Math.sin(elapsed * 1.5) * 0.018;
    bodyParts.leftLung?.scale.set(0.28 + breathing, 0.58 + breathing * 1.8, 0.17 + breathing);
    bodyParts.rightLung?.scale.set(0.28 + breathing, 0.58 + breathing * 1.8, 0.17 + breathing);
    const bpm = Math.max(45, twinState?.summary?.heartRate || 72);
    const beat = Math.exp(-Math.pow(((elapsed % (60 / bpm)) / (60 / bpm) - 0.08) / 0.075, 2)) * 0.08;
    bodyParts.heart?.scale.set(0.17 + beat, 0.25 + beat * 1.4, 0.16 + beat);
  }

  animateParticles(delta, elapsed);
  animateDiseaseLayers(elapsed);
  animateSensors(elapsed);
  renderer.render(scene, camera);
  markWebglReadyIfCanvasHasSignal();
  requestAnimationFrame(animate);
}

function animateParticles(delta, elapsed) {
  bloodParticles.forEach((particle) => {
    const clotDrag = twinState?.summary?.clotRisk > 65 && particle.userData.t > 0.55 ? 0.42 : 1;
    particle.userData.t += delta * particle.userData.speed * 0.18 * clotDrag;
    if (particle.userData.t > 1) particle.userData.t = 0;
    particle.position.copy(particle.userData.path.getPointAt(particle.userData.t));
    particle.material.color.set(twinState?.summary?.oxygen < 94 ? 0xef4b5f : 0xffc8c8);
  });

  glucoseParticles.forEach((particle) => {
    particle.position.y = particle.userData.baseY + Math.sin(elapsed * particle.userData.speed + particle.userData.phase) * 0.08;
    particle.rotation.y += delta;
  });
}

function animateDiseaseLayers(elapsed) {
  if (disease.pressure?.visible) {
    disease.pressure.children.forEach((ring, index) => {
      ring.scale.setScalar(1 + Math.sin(elapsed * 2.2 + index) * 0.08);
    });
  }
  [disease.clot, disease.lungClot, disease.carotid].forEach((group) => {
    if (group?.visible) {
      group.rotation.y += 0.01;
      group.rotation.x = Math.sin(elapsed * 1.7) * 0.12;
    }
  });
  [disease.brain, disease.pancreasGlow].forEach((mesh) => {
    if (mesh?.visible) mesh.scale.multiplyScalar(1 + Math.sin(elapsed * 3) * 0.0008);
  });
}

function animateSensors(elapsed) {
  for (const group of sensorMeshes.values()) {
    const sensor = group.userData.sensor;
    const ring = group.getObjectByName("sensor-ring");
    if (!sensor || !ring) continue;
    ring.rotation.z = elapsed * 0.9;
    const pulse = 1 + Math.sin(elapsed * 3.4 + group.position.x) * 0.055;
    const selected = group.userData.sensorId === selectedSensorId ? 1.32 : 1;
    const alertScale = sensor.status === "critical" ? 1.22 : sensor.status === "warning" ? 1.1 : 1;
    group.scale.setScalar(selected * alertScale * pulse);
  }
}

function markWebglReadyIfCanvasHasSignal() {
  if (webglSignalChecked || framesWithoutSignal > 120) return;
  framesWithoutSignal += 1;
  if (framesWithoutSignal < 3 || framesWithoutSignal % 6 !== 0) return;
  try {
    const gl = renderer.getContext();
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const samples = [
      [0.48, 0.3],
      [0.5, 0.48],
      [0.42, 0.6],
      [0.56, 0.67],
      [0.5, 0.78]
    ];
    const pixel = new Uint8Array(4);
    const brightSamples = samples.filter(([x, y]) => {
      gl.readPixels(Math.floor(size.x * x), Math.floor(size.y * y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel[0] + pixel[1] + pixel[2] > 64;
    });
    if (brightSamples.length >= 2) {
      document.body.classList.add("webgl-ready");
      webglSignalChecked = true;
    }
  } catch {
    document.body.classList.add("webgl-fallback");
    webglSignalChecked = true;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

window.addEventListener("load", refreshIcons);
