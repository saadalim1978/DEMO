import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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
  resetCameraBtn: document.querySelector("#resetCameraBtn"),
  layerToggles: document.querySelectorAll("[data-layer-toggle]"),
  cutawayToggle: document.querySelector("#cutawayToggle")
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
let activeLayerGroup = null;

const disease = {};
const bodyParts = {};
const layerGroups = {};
const gltfLoader = new GLTFLoader();
const cutawayPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.08);
const layerState = {
  skin: true,
  organs: true,
  vessels: true,
  sensors: true,
  labels: true,
  effects: true
};
let cutawayEnabled = true;

let bodyShellAsset = {
  file: "VH_M_Skin.glb",
  label: "NIH 3D Skin, Male",
  source: "NIH 3D",
  fit: [2.96, 5.15, 0.9],
  position: [0, 0.18, 0],
  rotation: [0, 0, 0]
};

let organAssets = [
  {
    key: "lungs",
    file: "3d-vh-f-lung.glb",
    label: "Lungs",
    position: [0, 1.36, 0.04],
    fit: [0.62, 0.72, 0.25],
    rotation: [0, Math.PI, 0],
    material: { color: 0x48c7d8, emissive: 0x07334a, opacity: 0.72 }
  },
  {
    key: "heart",
    file: "VH_M_Heart.glb",
    label: "Heart",
    position: [-0.08, 1.12, 0.12],
    fit: [0.24, 0.3, 0.2],
    rotation: [0, -0.2, 0],
    material: { color: 0xef4b5f, emissive: 0x4c0712, opacity: 0.96 }
  },
  {
    key: "liver",
    file: "VH_M_Liver.glb",
    label: "Liver",
    position: [0.24, 0.7, 0.06],
    fit: [0.5, 0.24, 0.2],
    rotation: [0, Math.PI, 0],
    material: { color: 0x9a4d2f, emissive: 0x341006, opacity: 0.88 }
  },
  {
    key: "stomach",
    file: "realistic_stomach.glb",
    label: "Stomach",
    position: [-0.22, 0.55, 0.08],
    fit: [0.25, 0.28, 0.18],
    rotation: [0, 0.2, 0],
    material: { color: 0xff9f80, emissive: 0x44140c, opacity: 0.9 }
  },
  {
    key: "pancreas",
    file: "3d-vh-m-pancreas.glb",
    label: "Pancreas",
    position: [-0.04, 0.66, 0.13],
    fit: [0.42, 0.1, 0.1],
    rotation: [0, Math.PI, 0],
    material: { color: 0xf4b740, emissive: 0x5a3600, opacity: 0.95 }
  },
  {
    key: "leftKidney",
    file: "VH_M_Kidney_L.glb",
    label: "Left Kidney",
    position: [-0.28, 0.34, -0.08],
    fit: [0.15, 0.24, 0.11],
    rotation: [0, Math.PI, -0.18],
    material: { color: 0xc084fc, emissive: 0x28113c, opacity: 0.9 }
  },
  {
    key: "rightKidney",
    file: "VH_M_Kidney_L.glb",
    label: "Right Kidney",
    position: [0.28, 0.34, -0.08],
    fit: [0.15, 0.24, 0.11],
    rotation: [0, 0, 0.18],
    mirrorX: true,
    material: { color: 0xc084fc, emissive: 0x28113c, opacity: 0.9 }
  },
  {
    key: "smallIntestine",
    file: "VH_F_Small_Intestine.glb",
    label: "Small Intestine",
    position: [0, 0.08, 0.08],
    fit: [0.5, 0.42, 0.18],
    rotation: [0, Math.PI, 0],
    material: { color: 0xffb3a7, emissive: 0x4e1b16, opacity: 0.84 }
  },
  {
    key: "largeIntestine",
    file: "SBU_F_Intestine_Large.glb",
    label: "Large Intestine",
    position: [0, 0.05, 0.06],
    fit: [0.58, 0.5, 0.2],
    rotation: [0, Math.PI, 0],
    material: { color: 0xffb3a7, emissive: 0x4e1b16, opacity: 0.76 }
  },
  {
    key: "bladder",
    file: "VH_F_Urinary_Bladder.glb",
    label: "Bladder",
    position: [0, -0.5, 0.04],
    fit: [0.16, 0.16, 0.14],
    rotation: [0, Math.PI, 0],
    material: { color: 0xff77aa, emissive: 0x4c0b24, opacity: 0.86 }
  }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0d10);
scene.fog = new THREE.Fog(0x0c0d10, 10, 24);

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
camera.position.set(0.18, 0.72, 7.85);

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  dom.scene.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0.45, 0.14);
  controls.maxPolarAngle = Math.PI * 0.64;
  controls.minDistance = 4.3;
  controls.maxDistance = 11.5;
} catch {
  document.body.classList.add("webgl-fallback");
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

await loadAnatomyManifest();
if (renderer) initScene();
wireEvents();
resize();
refreshTwin().then(() => askAi("حلل حالة الجسم الآن مع التركيز على السكري والضغط والجلطات."));
setInterval(refreshTwin, 2600);
if (renderer) requestAnimationFrame(animate);

async function loadAnatomyManifest() {
  try {
    const response = await fetch("/anatomy-manifest.json?v=body-anatomy-6", { cache: "no-store" });
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.bodyShell) bodyShellAsset = normalizeBodyShell(manifest.bodyShell);
    if (Array.isArray(manifest.organs)) organAssets = manifest.organs.map(normalizeOrganAsset);
    if (Array.isArray(manifest.layers)) {
      manifest.layers.forEach((layer) => {
        if (layer?.key in layerState) layerState[layer.key] = layer.defaultVisible !== false;
      });
    }
    document.body.dataset.anatomyManifest = manifest.version || "loaded";
  } catch (error) {
    console.warn("Using bundled anatomy configuration", error);
    bodyShellAsset = normalizeBodyShell(bodyShellAsset);
    organAssets = organAssets.map(normalizeOrganAsset);
  }
}

function normalizeBodyShell(asset) {
  return {
    ...asset,
    fit: vectorOr(asset.fit, [2.96, 5.15, 0.9]),
    position: vectorOr(asset.position, [0, 0.18, 0]),
    rotation: vectorOr(asset.rotation, [0, 0, 0])
  };
}

function normalizeOrganAsset(asset) {
  return {
    ...asset,
    position: vectorOr(asset.position, [0, 0, 0]),
    fit: vectorOr(asset.fit, [0.3, 0.3, 0.3]),
    rotation: vectorOr(asset.rotation, [0, 0, 0]),
    material: {
      color: colorToHex(asset.material?.color, 0xffffff),
      emissive: colorToHex(asset.material?.emissive, 0x000000),
      opacity: Number.isFinite(asset.material?.opacity) ? asset.material.opacity : 0.85
    }
  };
}

function vectorOr(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return [...fallback];
  return value.slice(0, 3).map((item, index) => (Number.isFinite(item) ? item : fallback[index]));
}

function colorToHex(value, fallback) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const clean = value.trim().replace(/^#/, "");
  const parsed = Number.parseInt(clean, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
  humanGroup.rotation.set(0.01, -Math.PI / 2, 0);
  humanGroup.scale.setScalar(0.98);
  scene.add(humanGroup);
  createLayerGroups();

  const vesselRed = vesselMaterial(0xff5d73, 0x5a0610, 0.35);
  const vesselBlue = vesselMaterial(0x4cc9f0, 0x052d4a, 0.24);

  loadNihBodyShell().catch((error) => {
    console.warn("NIH body shell failed to load, using canvas silhouette fallback", error);
    addHumanSilhouette();
  });
  loadReadyMadeOrgans();
  withLayer("organs", () => {
    bodyParts.brain = addEllipsoid("brain", [0, 2.48, 0.02], [0.22, 0.14, 0.18], organMaterial(0xa78bfa, 0x221146, 0.78));
    addBrainFolds();
  });

  withLayer("vessels", () => {
    createTube(
      [
        [-0.06, 1.1, 0.12],
        [-0.02, 1.58, 0.08],
        [0, 2.02, 0.04],
        [-0.04, 2.27, 0.03],
        [0, 2.45, 0.02]
      ],
      0.045,
      vesselRed,
      "aorta-up"
    );
    createTube(
      [
        [-0.04, 1.08, 0.1],
        [-0.01, 0.54, 0.07],
        [-0.02, -0.36, 0.05],
        [-0.2, -1.08, 0.04],
        [-0.24, -2.0, 0.03]
      ],
      0.04,
      vesselRed,
      "leg-artery-left"
    );
    createTube(
      [
        [0.02, -0.36, 0.05],
        [0.2, -1.08, 0.04],
        [0.24, -2.0, 0.03]
      ],
      0.036,
      vesselRed,
      "leg-artery-right"
    );
    createTube(
      [
        [0.12, 1.12, 0.04],
        [0.08, 0.44, 0.03],
        [-0.12, -0.54, 0.02],
        [-0.2, -1.58, 0.02]
      ],
      0.035,
      vesselBlue,
      "vein-left"
    );
    createTube(
      [
        [0.14, 1.08, 0.04],
        [0.16, 0.42, 0.03],
        [0.18, -0.58, 0.02],
        [0.22, -1.72, 0.02]
      ],
      0.032,
      vesselBlue,
      "vein-right"
    );
    createTube(
      [
        [-0.02, 2.02, 0.04],
        [-0.08, 2.25, 0.03],
        [-0.08, 2.43, 0.02]
      ],
      0.024,
      vesselRed,
      "carotid-left"
    );
    createTube(
      [
        [0.02, 2.02, 0.04],
        [0.08, 2.25, 0.03],
        [0.08, 2.43, 0.02]
      ],
      0.024,
      vesselRed,
      "carotid-right"
    );
    createBloodParticles();
    createVascularAndNerveNetwork();
  });

  withLayer("effects", () => {
    createDiseaseLayers();
    createGlucoseParticles();
  });
  withLayer("labels", createAnatomyLabels);
  applyLayerVisibility();
  applyCutawayMode();
}

function createLayerGroups() {
  ["skin", "organs", "vessels", "effects", "sensors", "labels"].forEach((key) => {
    const group = new THREE.Group();
    group.name = `layer-${key}`;
    layerGroups[key] = group;
    humanGroup.add(group);
  });
}

function withLayer(key, callback) {
  const previous = activeLayerGroup;
  activeLayerGroup = layerGroups[key] || humanGroup;
  try {
    return callback();
  } finally {
    activeLayerGroup = previous;
  }
}

function addToActiveLayer(object) {
  (activeLayerGroup || humanGroup)?.add(object);
}

function applyLayerVisibility() {
  Object.entries(layerGroups).forEach(([key, group]) => {
    group.visible = layerState[key] !== false;
  });
  dom.layerToggles.forEach((input) => {
    input.checked = layerState[input.dataset.layerToggle] !== false;
  });
}

function applyCutawayMode() {
  if (renderer) renderer.localClippingEnabled = true;
  bodyParts.skin?.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.material.clippingPlanes = cutawayEnabled ? [cutawayPlane] : [];
    child.material.opacity = cutawayEnabled ? 0.28 : 0.46;
    child.material.needsUpdate = true;
  });
  document.body.dataset.cutaway = cutawayEnabled ? "on" : "off";
  if (dom.cutawayToggle) dom.cutawayToggle.checked = cutawayEnabled;
}

async function loadNihBodyShell() {
  const gltf = await gltfLoader.loadAsync(`/models/body/${bodyShellAsset.file}`);
  const shell = prepareBodyShell(gltf.scene);
  layerGroups.skin?.add(shell);
  bodyParts.skin = shell;
  document.body.dataset.bodyShell = "nih-3d-skin-male";
  applyLayerVisibility();
  applyCutawayMode();
}

function prepareBodyShell(sceneModel) {
  const wrapper = new THREE.Group();
  wrapper.name = "nih-human-body-shell";
  sceneModel.name = "nih-human-skin-source";

  sceneModel.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    child.renderOrder = 1;
    child.material = skinShellMaterial();
  });

  fitModelToBox(sceneModel, bodyShellAsset.fit);
  wrapper.add(sceneModel);
  wrapper.position.set(...bodyShellAsset.position);
  wrapper.rotation.set(...bodyShellAsset.rotation);
  wrapper.userData.asset = bodyShellAsset;

  const edge = createBodyInspectionWindow();
  wrapper.add(edge);
  return wrapper;
}

function fitModelToBox(sceneModel, fitBox) {
  const box = new THREE.Box3().setFromObject(sceneModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fit = new THREE.Vector3(...fitBox);
  const scale = Math.min(fit.x / size.x, fit.y / size.y, fit.z / size.z);

  sceneModel.scale.setScalar(scale);
  sceneModel.position.set(
    -center.x * sceneModel.scale.x,
    -center.y * sceneModel.scale.y,
    -center.z * sceneModel.scale.z
  );
}

function skinShellMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffc8b6,
    roughness: 0.62,
    metalness: 0.01,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
    emissive: 0x2c1210,
    emissiveIntensity: 0.04,
    transparent: true,
    opacity: cutawayEnabled ? 0.28 : 0.46,
    depthWrite: false,
    side: THREE.DoubleSide,
    clippingPlanes: cutawayEnabled ? [cutawayPlane] : [],
    clipShadows: true
  });
}

function createBodyInspectionWindow() {
  const group = new THREE.Group();
  group.name = "body-inspection-window";
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffe2d6,
    transparent: true,
    opacity: 0.48
  });
  const points = [];
  for (let i = 0; i <= 72; i += 1) {
    const t = (i / 72) * Math.PI * 2;
    points.push(new THREE.Vector3(-0.42, 0.58 + Math.sin(t) * 0.93, 0.06 + Math.cos(t) * 0.31));
  }
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
  group.add(outline);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 1.72),
    new THREE.MeshBasicMaterial({
      color: 0x101419,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  panel.position.set(-0.42, 0.58, 0.06);
  panel.rotation.y = Math.PI / 2;
  panel.renderOrder = 0;
  group.add(panel);
  return group;
}

async function loadReadyMadeOrgans() {
  const organLayer = new THREE.Group();
  organLayer.name = "ready-made-human-organs";
  layerGroups.organs?.add(organLayer);

  const results = await Promise.allSettled(
    organAssets.map(async (asset) => {
      const gltf = await gltfLoader.loadAsync(`/models/organs/${asset.file}`);
      const model = prepareOrganModel(gltf.scene, asset);
      organLayer.add(model);
      bodyParts[asset.key] = model;
      return model;
    })
  );

  const loaded = results.filter((result) => result.status === "fulfilled").length;
  if (loaded < organAssets.length) {
    console.warn(`Loaded ${loaded}/${organAssets.length} ready-made organ models`);
  }
}

function prepareOrganModel(sceneModel, asset) {
  const wrapper = new THREE.Group();
  wrapper.name = asset.key;
  sceneModel.name = `${asset.key}-source`;

  sceneModel.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    child.material = organAssetMaterial(asset.material);
  });

  const box = new THREE.Box3().setFromObject(sceneModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fit = new THREE.Vector3(...asset.fit);
  const scale = Math.min(fit.x / size.x, fit.y / size.y, fit.z / size.z);

  sceneModel.scale.setScalar(scale);
  if (asset.mirrorX) sceneModel.scale.x *= -1;
  sceneModel.position.set(
    -center.x * sceneModel.scale.x,
    -center.y * sceneModel.scale.y,
    -center.z * sceneModel.scale.z
  );

  wrapper.add(sceneModel);
  wrapper.position.set(...asset.position);
  wrapper.rotation.set(...asset.rotation);
  wrapper.userData.asset = asset;
  return wrapper;
}

function organAssetMaterial(config) {
  return new THREE.MeshPhysicalMaterial({
    color: config.color,
    roughness: 0.5,
    metalness: 0.02,
    clearcoat: 0.28,
    clearcoatRoughness: 0.5,
    emissive: config.emissive,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: config.opacity
  });
}

function addHumanSilhouette() {
  const canvas = document.createElement("canvas");
  canvas.width = 700;
  canvas.height = 1700;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const fill = "rgba(242, 200, 180, 0.28)";
  const stroke = "rgba(255, 218, 205, 0.56)";
  const shadow = "rgba(239, 75, 95, 0.18)";

  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 34;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.ellipse(350, 184, 84, 112, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(305, 292, 90, 108, 42);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(238, 390);
  ctx.bezierCurveTo(278, 350, 422, 350, 462, 390);
  ctx.bezierCurveTo(505, 502, 480, 748, 430, 936);
  ctx.bezierCurveTo(398, 1000, 302, 1000, 270, 936);
  ctx.bezierCurveTo(220, 748, 195, 502, 238, 390);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  [
    { side: -1, shoulder: 244, wrist: 142 },
    { side: 1, shoulder: 456, wrist: 558 }
  ].forEach(({ side, shoulder, wrist }) => {
    ctx.beginPath();
    ctx.moveTo(shoulder, 420);
    ctx.bezierCurveTo(shoulder + side * 48, 566, wrist + side * 10, 830, wrist, 1120);
    ctx.bezierCurveTo(wrist - side * 42, 1148, wrist - side * 64, 1090, wrist - side * 50, 1002);
    ctx.bezierCurveTo(wrist - side * 34, 780, shoulder - side * 12, 548, shoulder - side * 54, 444);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  [
    { side: -1, hip: 304, ankle: 292 },
    { side: 1, hip: 396, ankle: 408 }
  ].forEach(({ side, hip, ankle }) => {
    ctx.beginPath();
    ctx.moveTo(hip, 900);
    ctx.bezierCurveTo(hip + side * 32, 1064, ankle + side * 30, 1375, ankle, 1572);
    ctx.bezierCurveTo(ankle - side * 16, 1622, ankle - side * 70, 1618, ankle - side * 74, 1560);
    ctx.bezierCurveTo(ankle - side * 68, 1358, hip - side * 18, 1120, 350 - side * 10, 930);
    ctx.bezierCurveTo(334, 906, 318, 900, hip, 900);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(350, 402);
  ctx.bezierCurveTo(328, 592, 326, 836, 350, 1030);
  ctx.bezierCurveTo(374, 836, 372, 592, 350, 402);
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const silhouette = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 5.25),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  silhouette.name = "human-silhouette";
  silhouette.position.set(0, 0.22, -0.08);
  layerGroups.skin?.add(silhouette);
}

function createSkeleton(boneMat) {
  addEllipsoid("skull", [0, 2.77, -0.015], [0.25, 0.31, 0.22], boneMat);
  addEllipsoid("jaw", [0, 2.53, 0.04], [0.16, 0.055, 0.13], boneMat);
  capsuleBetween([0, 2.18, 0.02], [0, -0.56, 0.02], 0.022, boneMat);
  for (let i = 0; i < 12; i += 1) {
    const y = 2.02 - i * 0.18;
    addEllipsoid(`vertebra-${i}`, [0, y, 0.035], [0.045, 0.032, 0.03], boneMat);
  }

  capsuleBetween([-0.5, 1.8, 0.11], [-0.07, 1.7, 0.14], 0.024, boneMat);
  capsuleBetween([0.5, 1.8, 0.11], [0.07, 1.7, 0.14], 0.024, boneMat);
  capsuleBetween([-0.06, 1.72, 0.16], [0.06, 0.82, 0.18], 0.026, boneMat);

  for (let i = 0; i < 6; i += 1) {
    const y = 1.58 - i * 0.12;
    const width = 0.21 + i * 0.04;
    createRib(-1, y, width, boneMat);
    createRib(1, y, width, boneMat);
  }

  createPelvis(boneMat);
}

function createRib(side, y, width, material) {
  const points = [
    [0.06 * side, y, 0.12],
    [side * width * 0.58, y + 0.035, 0.17],
    [side * width, y - 0.025, 0.08],
    [side * width * 0.78, y - 0.1, -0.045],
    [side * 0.12, y - 0.075, -0.035]
  ];
  createTube(points, 0.009, material, `rib-${side}-${y}`);
}

function createPelvis(material) {
  createTube([[-0.38, -0.43, 0.05], [-0.2, -0.62, 0.12], [0, -0.58, 0.14], [0.2, -0.62, 0.12], [0.38, -0.43, 0.05]], 0.02, material, "pelvis-front");
  createTube([[-0.38, -0.43, 0.05], [-0.43, -0.66, 0], [-0.22, -0.78, 0.03], [-0.06, -0.62, 0.12]], 0.017, material, "pelvis-left");
  createTube([[0.38, -0.43, 0.05], [0.43, -0.66, 0], [0.22, -0.78, 0.03], [0.06, -0.62, 0.12]], 0.017, material, "pelvis-right");
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
  addEllipsoid("stomach", [-0.19, 0.54, 0.38], [0.14, 0.21, 0.09], stomachMat, [0, 0.1, -0.2]);
  const intestineMat = vesselMaterial(0xffb3a7, 0x4e1b16, 0.08);
  for (let row = 0; row < 3; row += 1) {
    const y = 0.18 - row * 0.12;
    const points = [];
    for (let i = 0; i < 18; i += 1) {
      const t = i / 17;
      const x = -0.27 + t * 0.54;
      const wiggle = Math.sin(t * Math.PI * 4 + row) * 0.045;
      points.push([x, y + wiggle, 0.38 + Math.cos(t * Math.PI * 4) * 0.018]);
    }
    createTube(points, 0.018, intestineMat, `intestine-${row}`);
  }
  addEllipsoid("bladder", [0, -0.46, 0.34], [0.095, 0.11, 0.08], organMaterial(0xff77aa, 0x4c0b24, 0.8));
}

function createVascularAndNerveNetwork() {
  const artery = vesselMaterial(0xff4d6d, 0x520411, 0.22);
  const vein = vesselMaterial(0x35c7ff, 0x033247, 0.18);
  const nerve = vesselMaterial(0xffd166, 0x493000, 0.12);

  [
    { side: -1, mat: artery, radius: 0.006, points: [[-0.3, 1.42, 0.03], [-0.48, 1.1, 0.02], [-0.67, 0.58, 0.02], [-0.78, 0.3, 0.02]] },
    { side: 1, mat: artery, radius: 0.006, points: [[0.3, 1.42, 0.03], [0.48, 1.1, 0.02], [0.67, 0.58, 0.02], [0.78, 0.3, 0.02]] },
    { side: -1, mat: vein, radius: 0.006, points: [[-0.24, 1.32, 0.01], [-0.44, 1, 0.01], [-0.62, 0.54, 0.01], [-0.74, 0.28, 0.01]] },
    { side: 1, mat: vein, radius: 0.006, points: [[0.24, 1.32, 0.01], [0.44, 1, 0.01], [0.62, 0.54, 0.01], [0.74, 0.28, 0.01]] },
    { side: -1, mat: artery, radius: 0.007, points: [[-0.1, -0.48, 0.03], [-0.18, -1.12, 0.02], [-0.23, -1.78, 0.02], [-0.22, -2.16, 0.02]] },
    { side: 1, mat: artery, radius: 0.007, points: [[0.1, -0.48, 0.03], [0.18, -1.12, 0.02], [0.23, -1.78, 0.02], [0.22, -2.16, 0.02]] },
    { side: -1, mat: vein, radius: 0.006, points: [[-0.04, -0.42, 0.01], [-0.13, -1.1, 0.01], [-0.19, -1.76, 0.01], [-0.18, -2.12, 0.01]] },
    { side: 1, mat: vein, radius: 0.006, points: [[0.04, -0.42, 0.01], [0.13, -1.1, 0.01], [0.19, -1.76, 0.01], [0.18, -2.12, 0.01]] }
  ].forEach((path) => createTube(path.points, path.radius, path.mat, `vascular-${path.side}`));

  createTube([[0, 2.45, 0.02], [-0.08, 2.25, 0.02], [-0.22, 1.94, 0.02], [-0.42, 1.78, 0.02]], 0.0045, nerve, "neck-nerve-left");
  createTube([[0, 2.45, 0.02], [0.08, 2.25, 0.02], [0.22, 1.94, 0.02], [0.42, 1.78, 0.02]], 0.0045, nerve, "neck-nerve-right");
}

function createDiseaseLayers() {
  disease.pancreasGlow = addGlowSphere([-0.04, 0.66, 0.13], [0.38, 0.12, 0.08], 0xf4b740);
  disease.glucoseField = new THREE.Group();
  disease.pressure = new THREE.Group();
  disease.clot = createClotGroup([-0.18, -1.58, 0.02], 0.68);
  disease.lungClot = createClotGroup([0.22, 1.42, 0.08], 0.5);
  disease.brain = addGlowSphere([0, 2.48, 0.02], [0.3, 0.2, 0.22], 0xa78bfa);
  disease.carotid = createClotGroup([-0.08, 2.24, 0.03], 0.36);
  disease.kidney = new THREE.Group();

  for (let i = 0; i < 4; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3 + i * 0.13, 0.008, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0xef4b5f, transparent: true, opacity: 0.34, depthWrite: false })
    );
    ring.position.set(0, 1.08 - i * 0.12, 0.1);
    ring.rotation.set(Math.PI / 2.35, 0, 0);
    disease.pressure.add(ring);
  }
  addToActiveLayer(disease.pressure);

  [[-0.28, 0.34, -0.08], [0.28, 0.34, -0.08]].forEach((pos) => {
    const glow = addGlowSphere(pos, [0.13, 0.2, 0.1], 0xc084fc);
    disease.kidney.add(glow);
  });
  addToActiveLayer(disease.kidney);

  Object.values(disease).forEach((item) => {
    if (item) item.visible = false;
  });
}

function createBloodParticles() {
  const material = new THREE.MeshBasicMaterial({ color: 0xffc8c8 });
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, 1.12, 0.1),
    new THREE.Vector3(0, 1.66, 0.07),
    new THREE.Vector3(0, 2.32, 0.03),
    new THREE.Vector3(-0.02, 0.42, 0.06),
    new THREE.Vector3(-0.2, -1.9, 0.02),
    new THREE.Vector3(0.2, -1.8, 0.02),
    new THREE.Vector3(0.1, 1.0, 0.05)
  ]);

  for (let i = 0; i < 46; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), material.clone());
    const t = i / 46;
    particle.position.copy(path.getPointAt(t));
    particle.userData = { t, path, speed: 0.45 + (i % 5) * 0.045 };
    bloodParticles.push(particle);
    addToActiveLayer(particle);
  }
}

function createGlucoseParticles() {
  const material = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 42; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), material.clone());
    particle.position.set((Math.random() - 0.5) * 0.9, -0.05 + Math.random() * 1.45, 0.02 + Math.random() * 0.16);
    particle.userData = { baseY: particle.position.y, speed: 0.8 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2 };
    glucoseParticles.push(particle);
    disease.glucoseField.add(particle);
  }
  disease.glucoseField.visible = false;
  addToActiveLayer(disease.glucoseField);
}

function createAnatomyLabels() {
  createAnatomyLabel("الدماغ", "#a78bfa", [0.5, 2.48, 0.18]);
  createAnatomyLabel("الرئتان", "#48c7d8", [0.58, 1.4, 0.18]);
  createAnatomyLabel("القلب", "#ef4b5f", [-0.52, 1.08, 0.2]);
  createAnatomyLabel("البنكرياس", "#f4b740", [-0.52, 0.64, 0.18]);
  createAnatomyLabel("الكلى", "#c084fc", [0.52, 0.32, 0.16]);
  createAnatomyLabel("الأوعية", "#ff5d73", [0.48, 0.92, 0.18]);
}

function addBrainFolds() {
  const foldMat = new THREE.LineBasicMaterial({ color: 0xefe7ff, transparent: true, opacity: 0.42 });
  for (let i = 0; i < 5; i += 1) {
    const points = [];
    for (let j = 0; j < 24; j += 1) {
      const u = (j / 23) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(u) * (0.085 + i * 0.018), 2.48 + Math.sin(u * 2 + i) * 0.012, 0.02 + Math.sin(u) * (0.05 + i * 0.012)));
    }
    addToActiveLayer(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), foldMat));
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
  addToActiveLayer(group);
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
  addToActiveLayer(mesh);
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
  addToActiveLayer(mesh);
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
  addToActiveLayer(group);
  return group;
}

function createTube(points, radius, material, name = "") {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 18, false), material);
  mesh.name = name;
  mesh.castShadow = true;
  addToActiveLayer(mesh);
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
  sprite.scale.set(0.54, 0.17, 1);
  addToActiveLayer(sprite);
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
        new THREE.SphereGeometry(0.045, 24, 18),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.62,
          roughness: 0.25,
          metalness: 0.12
        })
      );
      shell.name = "sensor-shell";
      shell.userData.sensorId = sensor.id;
      group.add(shell);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.0045, 8, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.name = "sensor-ring";
      ring.userData.sensorId = sensor.id;
      group.add(ring);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.18, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 })
      );
      stem.position.y = -0.09;
      group.add(stem);

      group.userData.sensorId = sensor.id;
      sensorMeshes.set(sensor.id, group);
      layerGroups.sensors?.add(group);
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
      group.parent?.remove(group);
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
  dom.layerToggles.forEach((input) => {
    input.addEventListener("change", () => {
      layerState[input.dataset.layerToggle] = input.checked;
      applyLayerVisibility();
    });
  });
  dom.cutawayToggle?.addEventListener("change", () => {
    cutawayEnabled = dom.cutawayToggle.checked;
    applyCutawayMode();
  });

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
  const worldPosition = new THREE.Vector3();
  group.getWorldPosition(worldPosition);
  controls.target.copy(worldPosition);
}

function resetCamera() {
  camera.position.set(0.18, 0.72, 7.85);
  controls?.target.set(0, 0.45, 0.14);
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
    camera.position.set(0.24, 0.68, 8.1);
    controls?.target.set(0, 0.45, 0.14);
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
    if (bodyParts.lungs) {
      bodyParts.lungs.scale.set(1 + breathing * 0.65, 1 + breathing * 1.05, 1 + breathing * 0.45);
    }
    const bpm = Math.max(45, twinState?.summary?.heartRate || 72);
    const beat = Math.exp(-Math.pow(((elapsed % (60 / bpm)) / (60 / bpm) - 0.08) / 0.075, 2)) * 0.08;
    bodyParts.heart?.scale.setScalar(1 + beat * 1.4);
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
