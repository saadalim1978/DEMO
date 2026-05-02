import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { initAnatomyDebug, updateDebugHelpers } from "/anatomy-debug.js";

const dom = {
  appShell: document.querySelector(".app-shell"),
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginUser: document.querySelector("#loginUser"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  togglePasswordBtn: document.querySelector("#togglePasswordBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  currentUserName: document.querySelector("#currentUserName"),
  currentPatientName: document.querySelector("#currentPatientName"),
  currentPatientRecord: document.querySelector("#currentPatientRecord"),
  scene: document.querySelector("#scene"),
  scenePanel: document.querySelector(".scene-panel"),
  assetName: document.querySelector("#assetName"),
  scenarioName: document.querySelector("#scenarioName"),
  interventionName: document.querySelector("#interventionName"),
  lastUpdate: document.querySelector("#lastUpdate"),
  disclaimer: document.querySelector("#disclaimer"),
  organLinkCard: document.querySelector("#organLinkCard"),
  organLinkName: document.querySelector("#organLinkName"),
  organLinkMetrics: document.querySelector("#organLinkMetrics"),
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
  imagingModality: document.querySelector("#imagingModality"),
  imagingRegion: document.querySelector("#imagingRegion"),
  imagingFile: document.querySelector("#imagingFile"),
  clearImagingBtn: document.querySelector("#clearImagingBtn"),
  imagingStatus: document.querySelector("#imagingStatus"),
  imagingList: document.querySelector("#imagingList"),
  imagingConfidence: document.querySelector("#imagingConfidence"),
  refreshBtn: document.querySelector("#refreshBtn"),
  resetCameraBtn: document.querySelector("#resetCameraBtn"),
  layerToggles: document.querySelectorAll("[data-layer-toggle]"),
  paletteButtons: document.querySelectorAll("[data-anatomy-palette]"),
  skinOpacityRange: document.querySelector("#skinOpacityRange"),
  organOpacityRange: document.querySelector("#organOpacityRange"),
  cutawayToggle: document.querySelector("#cutawayToggle"),
  teachingModeToggle: document.querySelector("#teachingModeToggle")
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

const DEMO_AUTH = {
  storageKey: "dgaDemoAuthenticated",
  username: "salshehri58",
  password: "102030",
  aliases: [],
  displayName: "سعد محمد الشهري",
  patientName: "خالد علي العمر",
  patientRecord: "MRN-2026-1045"
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
let imagingStatusOverride = "";
let imagingStatusOverrideUntil = 0;
let activeLayerGroup = null;
let selectedOrganKey = "pancreas";
let usingIntegratedAnatomy = false;

const disease = {};
const bodyParts = {};
const layerGroups = {};
const gltfLoader = new GLTFLoader();
const CUTAWAY_FRONT_Z = 0.02;
const CUTAWAY_MIN_Y = -0.92;
const CUTAWAY_MAX_Y = 2.72;
const CUTAWAY_LOWER_HALF_WIDTH = 0.32;
const CUTAWAY_UPPER_HALF_WIDTH = 0.66;
const LUNG_BREATH_RATE = 1.28;
const LUNG_EXPANSION_X = 0.085;
const LUNG_EXPANSION_Y = 0.055;
const LUNG_EXPANSION_Z = 0.1;
const organHighlights = new Map();
const organMetricLinks = {
  brain: { label: "الدماغ", color: "#a78bfa", sensors: ["neuroPerfusion"] },
  heart: { label: "القلب", color: "#ef4b5f", sensors: ["heartRate", "systolic", "diastolic"] },
  lungs: { label: "الرئتان", color: "#48c7d8", sensors: ["oxygen"] },
  liver: { label: "الكبد", color: "#9a4d2f", sensors: ["ldl", "triglycerides", "inflammation"] },
  spleen: { label: "الطحال", color: "#6b1f2e", sensors: ["splenicPerfusion", "spleenSize", "plateletCount", "inflammation"] },
  stomach: { label: "المعدة", color: "#ff9f80", sensors: ["bmi", "inflammation"] },
  pancreas: { label: "البنكرياس", color: "#f4b740", sensors: ["glucose", "hba1c", "insulinResistance"] },
  kidneys: { label: "الكلى", color: "#c084fc", sensors: ["egfr", "systolic", "diastolic"] },
  bladder: { label: "المثانة", color: "#ff77aa", sensors: ["egfr"] },
  intestines: { label: "الأمعاء", color: "#ffb3a7", sensors: ["bmi", "inflammation", "triglycerides"] },
  vessels: { label: "الأوعية الدموية", color: "#ff5d73", sensors: ["systolic", "diastolic", "clotRisk", "dDimer", "legFlow", "vascularStiffness"] }
};
const sensorOrganMap = {
  glucose: "pancreas",
  hba1c: "pancreas",
  insulinResistance: "pancreas",
  heartRate: "heart",
  oxygen: "lungs",
  ldl: "liver",
  triglycerides: "liver",
  egfr: "kidneys",
  systolic: "vessels",
  diastolic: "vessels",
  clotRisk: "vessels",
  dDimer: "vessels",
  splenicPerfusion: "spleen",
  spleenSize: "spleen",
  plateletCount: "spleen",
  legFlow: "vessels",
  vascularStiffness: "vessels",
  bmi: "intestines",
  inflammation: "intestines",
  painScore: "vessels"
};

const teachingOrganScales = {
  brain: 1.24,
  lungs: 1.16,
  heart: 1.3,
  liver: 1.2,
  stomach: 1.24,
  pancreas: 1.38,
  leftKidney: 1.28,
  rightKidney: 1.28,
  kidneys: 1.28,
  smallIntestine: 1.13,
  largeIntestine: 1.13,
  intestines: 1.13,
  bladder: 1.25
};

const defaultIntegratedAnatomyParts = [
  { key: "skin", file: "skin.glb" },
  { key: "brain", file: "brain.glb" },
  { key: "lungs", file: "lungs.glb" },
  { key: "heart", file: "heart.glb" },
  { key: "liver", file: "liver.glb" },
  { key: "spleen", file: "spleen.glb" },
  { key: "stomach", file: "stomach.glb" },
  { key: "pancreas", file: "pancreas.glb" },
  { key: "small_intestine", file: "small_intestine.glb" },
  { key: "large_intestine", file: "large_intestine.glb" },
  { key: "kidney_left", file: "kidney_left.glb" },
  { key: "kidney_right", file: "kidney_right.glb" },
  { key: "bladder", file: "bladder.glb" },
  { key: "trunk_arteries", file: "trunk_arteries.glb" },
  { key: "trunk_veins", file: "trunk_veins.glb" },
  { key: "arm_arteries", file: "arm_arteries.glb" },
  { key: "arm_veins", file: "arm_veins.glb" },
  { key: "leg_arteries", file: "leg_arteries.glb" },
  { key: "leg_veins", file: "leg_veins.glb" }
];

const layerState = {
  skin: true,
  organs: true,
  vessels: true,
  sensors: true,
  labels: true,
  effects: true
};
let cutawayEnabled = false;
let teachingModeEnabled = false;

const anatomyPalettes = {
  natural: { skin: 0xd8b48f, organTint: 0xffffff, vesselTint: 0xffffff },
  research: { skin: 0x7d7467, organTint: 0xffd6aa, vesselTint: 0xe8f4ff },
  cool: { skin: 0x667077, organTint: 0xd8f2ff, vesselTint: 0xd6e5ff }
};
const anatomyAppearance = {
  palette: "natural",
  skinOpacity: 0.54,
  organOpacity: 0.88
};

let bodyShellAsset = {
  file: "VH_M_Skin.glb",
  label: "NIH 3D Skin, Male",
  source: "NIH 3D",
  fit: [3.08, 5.28, 1.38],
  fitMode: "stretch",
  position: [0, 0.16, 0.03],
  rotation: [0, 0, 0]
};

let integratedAnatomyAsset = {
  enabled: true,
  mode: "separate-parts",
  partsPath: "/models/anatomy-parts",
  parts: defaultIntegratedAnatomyParts,
  label: "Professional Human Anatomy Parts",
  source: "User supplied GLB",
  fit: [3.08, 5.28, 1.38],
  fitMode: "stretch",
  position: [0, 0.16, 0.03],
  rotation: [0, 0, 0]
};

let organAssets = [
  {
    key: "lungs",
    file: "3d-vh-f-lung.glb",
    label: "Lungs",
    position: [0, 1.32, 0.02],
    fit: [0.78, 0.82, 0.32],
    rotation: [0, Math.PI, 0],
    material: { color: 0x48c7d8, emissive: 0x07334a, opacity: 0.62 }
  },
  {
    key: "heart",
    file: "VH_M_Heart.glb",
    label: "Heart",
    position: [0.06, 1.18, 0.06],
    fit: [0.22, 0.26, 0.18],
    rotation: [0, -0.25, -0.18],
    material: { color: 0xef4b5f, emissive: 0x4c0712, opacity: 0.96 }
  },
  {
    key: "liver",
    file: "VH_M_Liver.glb",
    label: "Liver",
    position: [-0.12, 0.92, 0.05],
    fit: [0.5, 0.26, 0.22],
    rotation: [0, Math.PI, 0],
    material: { color: 0x9a4d2f, emissive: 0x341006, opacity: 0.85 }
  },
  {
    key: "stomach",
    file: "stomach.glb",
    label: "Stomach",
    position: [0.23, 0.92, 0.18],
    fit: [0.36, 0.42, 0.26],
    rotation: [0, -0.7, -0.16],
    material: { color: 0xff9f80, emissive: 0x44140c, opacity: 0.94 }
  },
  {
    key: "pancreas",
    file: "3d-vh-m-pancreas.glb",
    label: "Pancreas",
    position: [0.0, 0.7, -0.04],
    fit: [0.45, 0.12, 0.12],
    rotation: [0, Math.PI, 0.05],
    material: { color: 0xf4b740, emissive: 0x5a3600, opacity: 0.95 }
  },
  {
    key: "leftKidney",
    file: "VH_M_Kidney_L.glb",
    label: "Left Kidney",
    position: [0.18, 0.64, -0.14],
    fit: [0.12, 0.22, 0.1],
    rotation: [0, 0, 0.28],
    material: { color: 0xc084fc, emissive: 0x28113c, opacity: 0.9 }
  },
  {
    key: "rightKidney",
    file: "VH_M_Kidney_L.glb",
    label: "Right Kidney",
    position: [-0.18, 0.64, -0.14],
    fit: [0.12, 0.22, 0.1],
    rotation: [0, 0, -0.28],
    mirrorX: true,
    material: { color: 0xc084fc, emissive: 0x28113c, opacity: 0.9 }
  },
  {
    key: "smallIntestine",
    file: "VH_F_Small_Intestine.glb",
    label: "Small Intestine",
    position: [0, 0.32, 0.05],
    fit: [0.42, 0.36, 0.18],
    rotation: [0, Math.PI, 0],
    material: { color: 0xffb3a7, emissive: 0x4e1b16, opacity: 0.78 }
  },
  {
    key: "largeIntestine",
    file: "SBU_F_Intestine_Large.glb",
    label: "Large Intestine",
    position: [0, 0.36, 0.04],
    fit: [0.5, 0.44, 0.2],
    rotation: [0, Math.PI, 0],
    material: { color: 0xd68a7c, emissive: 0x4e1b16, opacity: 0.7 }
  },
  {
    key: "bladder",
    file: "VH_F_Urinary_Bladder.glb",
    label: "Bladder",
    position: [0, 0.02, 0.05],
    fit: [0.14, 0.14, 0.12],
    rotation: [0, Math.PI, 0],
    material: { color: 0xff77aa, emissive: 0x4c0b24, opacity: 0.86 }
  }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171a20);
scene.fog = new THREE.Fog(0x171a20, 10, 24);

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 0.64, 8.55);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0.34, 0.1);
const MOBILE_CAMERA_POSITION = new THREE.Vector3(0, 0.62, 8.85);
const BODY_FRONT_ROTATION = new THREE.Euler(0.01, 0, 0);

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
camera.position.copy(DEFAULT_CAMERA_POSITION);

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
  controls.target.copy(DEFAULT_CAMERA_TARGET);
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
initializeAuth();
wireEvents();
resize();
refreshTwin().then(() => askAi("حلل حالة الجسم الآن مع التركيز على السكري والضغط والجلطات."));
setInterval(refreshTwin, 2600);
if (renderer) requestAnimationFrame(animate);

async function loadAnatomyManifest() {
  try {
    const response = await fetch("/anatomy-manifest.json?v=body-anatomy-32", { cache: "no-store" });
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.integratedAnatomy) integratedAnatomyAsset = normalizeIntegratedAnatomy(manifest.integratedAnatomy);
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
    integratedAnatomyAsset = normalizeIntegratedAnatomy(integratedAnatomyAsset);
    bodyShellAsset = normalizeBodyShell(bodyShellAsset);
    organAssets = organAssets.map(normalizeOrganAsset);
  }
}

function normalizeIntegratedAnatomy(asset) {
  return {
    ...asset,
    enabled: asset.enabled !== false,
    mode: typeof asset.mode === "string" ? asset.mode : "separate-parts",
    partsPath: typeof asset.partsPath === "string" ? asset.partsPath : "/models/anatomy-parts",
    parts: Array.isArray(asset.parts) && asset.parts.length ? asset.parts.map(normalizeIntegratedPartAsset) : defaultIntegratedAnatomyParts.map(normalizeIntegratedPartAsset),
    fit: vectorOr(asset.fit, [3.08, 5.28, 1.38]),
    fitMode: typeof asset.fitMode === "string" ? asset.fitMode : "stretch",
    position: vectorOr(asset.position, [0, 0.16, 0.03]),
    rotation: vectorOr(asset.rotation, [0, 0, 0])
  };
}

function normalizeIntegratedPartAsset(part) {
  const file = typeof part.file === "string" ? part.file : "";
  const key = typeof part.key === "string" && part.key ? part.key : file.replace(/\.glb$/i, "");
  return { ...part, key, file };
}

function normalizeBodyShell(asset) {
  return {
    ...asset,
    fit: vectorOr(asset.fit, [3.08, 5.28, 1.38]),
    fitMode: typeof asset.fitMode === "string" ? asset.fitMode : "stretch",
    position: vectorOr(asset.position, [0, 0.16, 0.03]),
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

function initializeAuth() {
  populateSessionContext();
  const authenticated = window.sessionStorage.getItem(DEMO_AUTH.storageKey) === "1";
  if (!authenticated) clearLoginFields();
  setAuthenticated(authenticated);
  [120, 480, 1100].forEach((delay) => {
    setTimeout(() => {
      if (!document.body.classList.contains("is-authenticated")) clearLoginFields();
    }, delay);
  });
}

function populateSessionContext() {
  if (dom.currentUserName) dom.currentUserName.textContent = DEMO_AUTH.displayName;
  if (dom.currentPatientName) dom.currentPatientName.textContent = DEMO_AUTH.patientName;
  if (dom.currentPatientRecord) dom.currentPatientRecord.textContent = DEMO_AUTH.patientRecord;
}

function clearLoginFields() {
  if (dom.loginUser) {
    dom.loginUser.value = "";
    dom.loginUser.defaultValue = "";
  }
  if (dom.loginPassword) {
    dom.loginPassword.value = "";
    dom.loginPassword.defaultValue = "";
  }
}

function normalizeLoginName(value = "") {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidDemoLogin(username, password) {
  const normalized = normalizeLoginName(username);
  const validNames = [DEMO_AUTH.username, ...DEMO_AUTH.aliases].map(normalizeLoginName);
  return validNames.includes(normalized) && password === DEMO_AUTH.password;
}

function setAuthenticated(authenticated) {
  document.body.classList.toggle("login-active", !authenticated);
  document.body.classList.toggle("is-authenticated", authenticated);
  dom.loginScreen?.setAttribute("aria-hidden", String(authenticated));
  if (authenticated) {
    window.sessionStorage.setItem(DEMO_AUTH.storageKey, "1");
    populateSessionContext();
    setTimeout(() => {
      resize();
      resetCamera();
    }, 120);
  } else {
    window.sessionStorage.removeItem(DEMO_AUTH.storageKey);
    clearLoginFields();
    setTimeout(() => dom.loginUser?.focus(), 80);
  }
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const username = dom.loginUser?.value || "";
  const password = dom.loginPassword?.value || "";
  if (isValidDemoLogin(username, password)) {
    if (dom.loginError) dom.loginError.textContent = "";
    setAuthenticated(true);
    return;
  }
  if (dom.loginError) dom.loginError.textContent = "بيانات الدخول غير صحيحة.";
}

function togglePasswordVisibility() {
  if (!dom.loginPassword || !dom.togglePasswordBtn) return;
  const showPassword = dom.loginPassword.type === "password";
  dom.loginPassword.type = showPassword ? "text" : "password";
  dom.togglePasswordBtn.setAttribute("aria-label", showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  dom.togglePasswordBtn.innerHTML = `<i data-lucide="${showPassword ? "eye-off" : "eye"}"></i>`;
  refreshIcons();
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
      transparent: true,
      opacity: 0.18,
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
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((material) => {
    material.transparent = true;
    material.opacity = 0.14;
  });
  scene.add(grid);

  addBodyTwinModel();
}

function addBodyTwinModel() {
  humanGroup = new THREE.Group();
  humanGroup.rotation.copy(BODY_FRONT_ROTATION);
  humanGroup.scale.setScalar(0.98);
  scene.add(humanGroup);
  createLayerGroups();

  const vesselRed = vesselMaterial(0xff5d73, 0x5a0610, 0.35);
  const vesselBlue = vesselMaterial(0x4cc9f0, 0x052d4a, 0.24);

  usingIntegratedAnatomy = integratedAnatomyAsset.enabled !== false;
  if (usingIntegratedAnatomy) {
    loadIntegratedAnatomyModel().catch((error) => {
      console.error("Integrated anatomy V2 failed to load", error);
      usingIntegratedAnatomy = false;
      document.body.dataset.bodyShell = "integrated-anatomy-load-error";
      if (dom.assetName) dom.assetName.textContent = "تعذر تحميل Model V2";
    });
  } else {
    loadLegacyAnatomyModel(vesselRed, vesselBlue);
  }
  initAnatomyDebug({
    scene,
    bodyParts,
    manifestRef: {
      value: {
        integratedAnatomy: integratedAnatomyAsset,
        bodyShell: bodyShellAsset,
        organs: organAssets,
        brain: { key: "brain", label: "Brain", position: [0, 2.62, 0.02], size: [0.16, 0.13, 0.18] }
      }
    }
  });
  if (usingIntegratedAnatomy) {
    withLayer("effects", () => {
      createBloodParticles();
      createDiseaseLayers();
      createGlucoseParticles();
    });
    withLayer("labels", createAnatomyLabels);
    applyLayerVisibility();
    applyCutawayMode();
    applyTeachingMode();
    return;
  }
}

function loadLegacyAnatomyModel(vesselRed, vesselBlue) {
  loadNihBodyShell().catch((error) => {
    console.warn("NIH body shell failed to load, using canvas silhouette fallback", error);
    addHumanSilhouette();
  });
  loadReadyMadeOrgans();
  withLayer("organs", () => {
    bodyParts.brain = addEllipsoid("brain", [0, 2.62, 0.02], [0.16, 0.13, 0.18], organMaterial(0xa78bfa, 0x221146, 0.78));
    bodyParts.brain.userData.organKey = "brain";
    registerOrganDisplayObject(bodyParts.brain, "brain");
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
        [-0.01, 0.54, 0.08],
        [-0.1, -0.4, 0.07],
        [-0.27, -0.82, 0.08],
        [-0.35, -1.38, 0.09],
        [-0.42, -2.08, 0.06],
        [-0.43, -2.24, 0.08]
      ],
      0.04,
      vesselRed,
      "leg-artery-left"
    );
    createTube(
      [
        [0.02, -0.36, 0.05],
        [0.27, -0.82, 0.08],
        [0.35, -1.38, 0.09],
        [0.42, -2.08, 0.06],
        [0.43, -2.24, 0.08]
      ],
      0.036,
      vesselRed,
      "leg-artery-right"
    );
    createTube(
      [
        [0.12, 1.12, 0.04],
        [0.08, 0.44, 0.05],
        [-0.08, -0.48, 0.06],
        [-0.26, -1.1, 0.08],
        [-0.38, -1.78, 0.11],
        [-0.39, -2.12, 0.075],
        [-0.33, -2.25, 0.09]
      ],
      0.035,
      vesselBlue,
      "vein-left"
    );
    createTube(
      [
        [0.14, 1.08, 0.04],
        [0.16, 0.42, 0.05],
        [0.26, -0.78, 0.07],
        [0.38, -1.5, 0.1],
        [0.39, -2.12, 0.075],
        [0.33, -2.25, 0.09]
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
  applyTeachingMode();
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
  bodyParts.skin?.traverse((child) => {
    if (child.userData?.cutawayHelper) {
      child.visible = cutawayEnabled;
      applyToMaterials(child.material, (material) => {
        material.clippingPlanes = [];
        material.needsUpdate = true;
      });
      return;
    }
    if (!child.isMesh || !child.material) return;
    applyToMaterials(child.material, (material) => {
      syncSkinCutawayUniforms(material);
      material.clippingPlanes = [];
      material.opacity = skinShellOpacity();
      material.needsUpdate = true;
    });
  });
  document.body.dataset.cutaway = cutawayEnabled ? "on" : "off";
  if (dom.cutawayToggle) dom.cutawayToggle.checked = cutawayEnabled;
}

function applyToMaterials(materialOrArray, callback) {
  if (!materialOrArray) return;
  const materials = Array.isArray(materialOrArray) ? materialOrArray : [materialOrArray];
  materials.forEach((material) => {
    if (material) callback(material);
  });
}

function syncSkinCutawayUniforms(material) {
  const uniforms = material.userData?.cutawayUniforms;
  if (!uniforms) return;
  uniforms.uCutawayEnabled.value = cutawayEnabled;
  uniforms.uCutawayFrontZ.value = CUTAWAY_FRONT_Z;
  uniforms.uCutawayMinY.value = CUTAWAY_MIN_Y;
  uniforms.uCutawayMaxY.value = CUTAWAY_MAX_Y;
  uniforms.uCutawayLowerHalfWidth.value = CUTAWAY_LOWER_HALF_WIDTH;
  uniforms.uCutawayUpperHalfWidth.value = CUTAWAY_UPPER_HALF_WIDTH;
}

function skinShellOpacity() {
  if (usingIntegratedAnatomy) return cutawayEnabled ? Math.min(0.72, anatomyAppearance.skinOpacity + 0.08) : anatomyAppearance.skinOpacity;
  if (teachingModeEnabled) return cutawayEnabled ? 0.18 : 0.32;
  return cutawayEnabled ? 0.28 : 0.46;
}

function applyTeachingMode() {
  document.body.dataset.anatomyDisplay = teachingModeEnabled ? "teaching" : "realistic";
  Object.entries(bodyParts).forEach(([key, object]) => {
    if (!object || key === "skin") return;
    applyOrganDisplayScale(object);
  });
  applyCutawayMode();
  if (dom.teachingModeToggle) dom.teachingModeToggle.checked = teachingModeEnabled;
}

function setAnatomyPalette(palette) {
  if (!anatomyPalettes[palette]) return;
  anatomyAppearance.palette = palette;
  applyAnatomyAppearance();
}

function setAppearanceOpacity(kind, value) {
  const opacity = Math.max(0.18, Math.min(1, Number(value) / 100));
  if (kind === "skin") anatomyAppearance.skinOpacity = opacity;
  if (kind === "organs") anatomyAppearance.organOpacity = opacity;
  applyAnatomyAppearance();
}

function syncAppearanceControls() {
  dom.paletteButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.anatomyPalette === anatomyAppearance.palette);
  });
  if (dom.skinOpacityRange) dom.skinOpacityRange.value = Math.round(anatomyAppearance.skinOpacity * 100);
  if (dom.organOpacityRange) dom.organOpacityRange.value = Math.round(anatomyAppearance.organOpacity * 100);
}

function applyAnatomyAppearance() {
  const palette = anatomyPalettes[anatomyAppearance.palette] || anatomyPalettes.natural;
  humanGroup?.traverse?.((child) => {
    if (!child.isMesh || !child.material) return;
    applyToMaterials(child.material, (material) => {
      const role = material.userData?.appearanceRole;
      if (!role) return;
      delete material.userData.organBase;
      if (role === "skin") {
        material.color?.setHex?.(palette.skin);
        material.transparent = true;
        material.opacity = skinShellOpacity();
        material.depthWrite = false;
      } else if (role === "organ") {
        material.color?.setHex?.(palette.organTint);
        material.transparent = true;
        material.opacity = anatomyAppearance.organOpacity;
        material.depthWrite = false;
      } else if (role === "vessel") {
        material.color?.setHex?.(palette.vesselTint);
        material.transparent = false;
        material.opacity = 0.98;
        material.depthWrite = true;
      }
      material.needsUpdate = true;
    });
  });
  syncAppearanceControls();
  applyCutawayMode();
  if (twinState) updateOrganLinks(twinState);
}

function registerOrganDisplayObject(object, key) {
  object.userData.organKey = object.userData.organKey || organGroupKey(key);
  object.userData.displayKey = key;
  object.userData.baseScale = object.scale.clone();
  object.userData.basePosition = object.position.clone();
  object.userData.teachingScale = teachingScaleFor(key);
  applyOrganDisplayScale(object);
  return object;
}

function teachingScaleFor(key) {
  if (usingIntegratedAnatomy) return 1;
  return teachingOrganScales[key] || teachingOrganScales[organGroupKey(key)] || 1.18;
}

function displayScaleForObject(object) {
  return teachingModeEnabled ? object.userData.teachingScale || 1 : 1;
}

function applyOrganDisplayScale(object, multiplier = [1, 1, 1]) {
  const base = object.userData.baseScale || new THREE.Vector3(1, 1, 1);
  const display = displayScaleForObject(object);
  object.scale.set(base.x * display * multiplier[0], base.y * display * multiplier[1], base.z * display * multiplier[2]);
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

async function loadIntegratedAnatomyModel() {
  if (Array.isArray(integratedAnatomyAsset.parts) && integratedAnatomyAsset.parts.length) {
    const loadedParts = await Promise.all(
      integratedAnatomyAsset.parts.map(async (part) => {
        const gltf = await gltfLoader.loadAsync(integratedPartUrl(part.file));
        return { asset: part, sceneModel: gltf.scene };
      })
    );
    prepareIntegratedAnatomyParts(loadedParts);
    document.body.dataset.bodyShell = "integrated-human-anatomy-parts";
    applyAnatomyAppearance();
    applyLayerVisibility();
    applyCutawayMode();
    applyTeachingMode();
    return;
  }

  const gltf = await gltfLoader.loadAsync(`/models/body/${integratedAnatomyAsset.file}`);
  prepareIntegratedAnatomyModel(gltf.scene);
  document.body.dataset.bodyShell = "integrated-human-anatomy";
  applyAnatomyAppearance();
  applyLayerVisibility();
  applyCutawayMode();
  applyTeachingMode();
}

function integratedPartUrl(file) {
  const base = integratedAnatomyAsset.partsPath || "/models/anatomy-parts";
  return `${base.replace(/\/$/, "")}/${file}`;
}

function prepareIntegratedAnatomyModel(sceneModel) {
  const box = new THREE.Box3().setFromObject(sceneModel);
  prepareIntegratedAnatomyEntries(collectIntegratedPartRoots(sceneModel), box);
}

function prepareIntegratedAnatomyParts(loadedParts) {
  const box = new THREE.Box3();
  const entries = loadedParts.map(({ asset, sceneModel }) => {
    box.union(new THREE.Box3().setFromObject(sceneModel));
    return { object: sceneModel, config: integratedPartConfig(asset.key || asset.file), asset };
  });
  prepareIntegratedAnatomyEntries(entries, box);
}

function prepareIntegratedAnatomyEntries(entries, box) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fit = new THREE.Vector3(...integratedAnatomyAsset.fit);
  const scale = new THREE.Vector3(fit.x / size.x, fit.y / size.y, fit.z / size.z);
  if (integratedAnatomyAsset.fitMode !== "stretch") {
    scale.setScalar(Math.min(scale.x, scale.y, scale.z));
  }
  const offset = new THREE.Vector3(-center.x * scale.x, -center.y * scale.y, -center.z * scale.z);
  const placement = new THREE.Vector3(...integratedAnatomyAsset.position);
  const integratedGroups = {
    skin: new THREE.Group(),
    organs: new THREE.Group(),
    vessels: new THREE.Group()
  };
  integratedGroups.skin.name = "integrated-anatomy-skin";
  integratedGroups.organs.name = "integrated-anatomy-organs";
  integratedGroups.vessels.name = "integrated-anatomy-vessels";
  layerGroups.skin?.add(integratedGroups.skin);
  layerGroups.organs?.add(integratedGroups.organs);
  layerGroups.vessels?.add(integratedGroups.vessels);
  bodyParts.skin = integratedGroups.skin;
  bodyParts.vessels = integratedGroups.vessels;

  entries.forEach(({ object: child, config }) => {
    const wrapper = new THREE.Group();
    wrapper.name = `integrated-${config.key}`;
    wrapper.scale.copy(scale);
    wrapper.position.copy(offset).add(placement);
    wrapper.rotation.set(...integratedAnatomyAsset.rotation);
    child.parent?.remove(child);
    wrapper.add(child);
    prepareIntegratedPart(child, config);
    integratedGroups[config.layer]?.add(wrapper);

    if (config.layer === "organs" && config.bodyPartKey) {
      wrapper.userData.organKey = config.organKey;
      bodyParts[config.bodyPartKey] = wrapper;
      registerOrganDisplayObject(wrapper, config.bodyPartKey);
    }
  });

  const edge = createBodyInspectionWindow();
  integratedGroups.skin.add(edge);
}

function collectIntegratedPartRoots(sceneModel) {
  const roots = [];
  const visit = (object, insideRecognizedPart = false) => {
    const config = integratedPartConfig(object.name);
    if (config.recognized && !insideRecognizedPart) {
      roots.push({ object, config });
      return;
    }
    object.children.forEach((child) => visit(child, insideRecognizedPart || config.recognized));
  };
  sceneModel.children.forEach((child) => visit(child));
  if (roots.length) return roots;
  return sceneModel.children.map((object) => ({ object, config: integratedPartConfig(object.name) }));
}

function integratedPartConfig(name = "") {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const organConfigs = {
    brain: { recognized: true, layer: "organs", key: "brain", bodyPartKey: "brain", organKey: "brain", color: 0xa78bfa, emissive: 0x221146, opacity: 0.82 },
    lungs: { recognized: true, layer: "organs", key: "lungs", bodyPartKey: "lungs", organKey: "lungs", color: 0x48c7d8, emissive: 0x07334a, opacity: 0.58 },
    heart: { recognized: true, layer: "organs", key: "heart", bodyPartKey: "heart", organKey: "heart", color: 0xef4b5f, emissive: 0x4c0712, opacity: 0.96 },
    liver: { recognized: true, layer: "organs", key: "liver", bodyPartKey: "liver", organKey: "liver", color: 0x9a4d2f, emissive: 0x341006, opacity: 0.86 },
    spleen: { recognized: true, layer: "organs", key: "spleen", bodyPartKey: "spleen", organKey: "spleen", color: 0x9254de, emissive: 0x261039, opacity: 0.82 },
    stomach: { recognized: true, layer: "organs", key: "stomach", bodyPartKey: "stomach", organKey: "stomach", color: 0xff9f80, emissive: 0x44140c, opacity: 0.88 },
    pancreas: { recognized: true, layer: "organs", key: "pancreas", bodyPartKey: "pancreas", organKey: "pancreas", color: 0xf4b740, emissive: 0x5a3600, opacity: 0.95 },
    small_intestine: { recognized: true, layer: "organs", key: "small-intestine", bodyPartKey: "smallIntestine", organKey: "intestines", color: 0xffb3a7, emissive: 0x4e1b16, opacity: 0.82 },
    large_intestine: { recognized: true, layer: "organs", key: "large-intestine", bodyPartKey: "largeIntestine", organKey: "intestines", color: 0xd68a7c, emissive: 0x4e1b16, opacity: 0.78 },
    kidney_left: { recognized: true, layer: "organs", key: "left-kidney", bodyPartKey: "leftKidney", organKey: "kidneys", color: 0xc084fc, emissive: 0x28113c, opacity: 0.9 },
    kidney_right: { recognized: true, layer: "organs", key: "right-kidney", bodyPartKey: "rightKidney", organKey: "kidneys", color: 0xc084fc, emissive: 0x28113c, opacity: 0.9 },
    bladder: { recognized: true, layer: "organs", key: "bladder", bodyPartKey: "bladder", organKey: "bladder", color: 0xff77aa, emissive: 0x4c0b24, opacity: 0.86 }
  };
  if (key === "skin") return { recognized: true, layer: "skin", key: "skin", organKey: "skin", type: "skin" };
  if (key.includes("arter")) return { recognized: true, layer: "vessels", key, organKey: "vessels", type: "artery" };
  if (key.includes("vein")) return { recognized: true, layer: "vessels", key, organKey: "vessels", type: "vein" };
  return organConfigs[key] || { layer: "organs", key: key || "anatomy-part", bodyPartKey: key, organKey: key, color: 0xffffff, emissive: 0x111111, opacity: 0.82 };
}

function prepareIntegratedPart(object, config) {
  const material = integratedPartMaterial(config);
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    child.renderOrder = config.layer === "skin" ? 1 : 4;
    child.material = material.clone();
    child.userData.organKey = config.organKey;
    child.userData.organPartKey = config.bodyPartKey || config.key;
  });
}

function integratedPartMaterial(config) {
  if (config.type === "skin") {
    return integratedSkinMaterial();
  }
  if (config.type === "artery") {
    return integratedVertexColorMaterial("vessel");
  }
  if (config.type === "vein") {
    return integratedVertexColorMaterial("vessel");
  }
  return integratedVertexColorMaterial("organ");
}

function integratedSkinMaterial() {
  const palette = anatomyPalettes[anatomyAppearance.palette] || anatomyPalettes.natural;
  const material = new THREE.MeshBasicMaterial({
    color: palette.skin,
    transparent: true,
    opacity: skinShellOpacity(),
    depthWrite: false,
    side: THREE.DoubleSide
  });
  material.userData.appearanceRole = "skin";
  installSkinCutawayShader(material);
  return material;
}

function integratedVertexColorMaterial(role) {
  const palette = anatomyPalettes[anatomyAppearance.palette] || anatomyPalettes.natural;
  const material = new THREE.MeshBasicMaterial({
    color: role === "vessel" ? palette.vesselTint : palette.organTint,
    vertexColors: true,
    transparent: role !== "vessel",
    opacity: role === "organ" ? anatomyAppearance.organOpacity : 0.98,
    depthWrite: role === "vessel",
    side: THREE.DoubleSide
  });
  material.userData.appearanceRole = role;
  return material;
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

  fitModelToBox(sceneModel, bodyShellAsset.fit, bodyShellAsset.fitMode);
  wrapper.add(sceneModel);
  wrapper.position.set(...bodyShellAsset.position);
  wrapper.rotation.set(...bodyShellAsset.rotation);
  wrapper.userData.asset = bodyShellAsset;

  const edge = createBodyInspectionWindow();
  wrapper.add(edge);
  return wrapper;
}

function fitModelToBox(sceneModel, fitBox, fitMode = "uniform") {
  const box = new THREE.Box3().setFromObject(sceneModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fit = new THREE.Vector3(...fitBox);
  const scale = new THREE.Vector3(fit.x / size.x, fit.y / size.y, fit.z / size.z);
  if (fitMode === "stretch") sceneModel.scale.copy(scale);
  else sceneModel.scale.setScalar(Math.min(scale.x, scale.y, scale.z));
  sceneModel.position.set(
    -center.x * sceneModel.scale.x,
    -center.y * sceneModel.scale.y,
    -center.z * sceneModel.scale.z
  );
}

function skinShellMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffc8b6,
    roughness: 0.62,
    metalness: 0.01,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
    emissive: 0x2c1210,
    emissiveIntensity: 0.04,
    transparent: true,
    opacity: skinShellOpacity(),
    depthWrite: false,
    side: THREE.DoubleSide,
    clipShadows: true
  });
  installSkinCutawayShader(material);
  return material;
}

function installSkinCutawayShader(material) {
  material.userData.cutawayUniforms = {
    uCutawayEnabled: { value: cutawayEnabled },
    uCutawayFrontZ: { value: CUTAWAY_FRONT_Z },
    uCutawayMinY: { value: CUTAWAY_MIN_Y },
    uCutawayMaxY: { value: CUTAWAY_MAX_Y },
    uCutawayLowerHalfWidth: { value: CUTAWAY_LOWER_HALF_WIDTH },
    uCutawayUpperHalfWidth: { value: CUTAWAY_UPPER_HALF_WIDTH }
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, material.userData.cutawayUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vCutawayWorldPosition;\nvoid main() {")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n\tvCutawayWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        [
          "uniform bool uCutawayEnabled;",
          "uniform float uCutawayFrontZ;",
          "uniform float uCutawayMinY;",
          "uniform float uCutawayMaxY;",
          "uniform float uCutawayLowerHalfWidth;",
          "uniform float uCutawayUpperHalfWidth;",
          "varying vec3 vCutawayWorldPosition;",
          "void main() {"
        ].join("\n")
      )
      .replace(
        "#include <clipping_planes_fragment>",
        [
          "#include <clipping_planes_fragment>",
          "\tif (uCutawayEnabled) {",
          "\t\tfloat y = vCutawayWorldPosition.y;",
          "\t\tfloat halfWidth = mix(uCutawayLowerHalfWidth, uCutawayUpperHalfWidth, smoothstep(0.05, 1.65, y));",
          "\t\tbool insideBodyWindow = y > uCutawayMinY && y < uCutawayMaxY && abs(vCutawayWorldPosition.x) < halfWidth;",
          "\t\tif (insideBodyWindow && vCutawayWorldPosition.z < uCutawayFrontZ) discard;",
          "\t}"
        ].join("\n")
      );
  };
  material.customProgramCacheKey = () => "skin-cutaway-window-v2";
}

function createBodyInspectionWindow() {
  const group = new THREE.Group();
  group.name = "body-inspection-window";
  group.userData.cutawayHelper = true;
  group.visible = cutawayEnabled;
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffe2d6,
    transparent: true,
    opacity: 0.48
  });
  const points = [];
  for (let i = 0; i <= 72; i += 1) {
    const t = (i / 72) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t) * 0.62, 0.58 + Math.sin(t) * 1.08, -0.1));
  }
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
  outline.userData.cutawayHelper = true;
  group.add(outline);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.24, 2.12),
    new THREE.MeshBasicMaterial({
      color: 0x101419,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  panel.position.set(0, 0.58, -0.1);
  panel.userData.cutawayHelper = true;
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
  const organKey = organGroupKey(asset.key);

  sceneModel.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    child.material = organAssetMaterial(asset.material);
    child.userData.organKey = organKey;
    child.userData.organPartKey = asset.key;
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
  wrapper.userData.organKey = organKey;
  registerOrganDisplayObject(wrapper, asset.key);
  return wrapper;
}

function organAssetMaterial(config) {
  return new THREE.MeshPhysicalMaterial({
    color: config.color,
    vertexColors: config.vertexColors === true,
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

function organGroupKey(key = "") {
  if (key === "leftKidney" || key === "rightKidney") return "kidneys";
  if (key === "smallIntestine" || key === "largeIntestine") return "intestines";
  return key;
}

function sensorsForOrgan(organKey, state = twinState) {
  const link = organMetricLinks[organKey];
  if (!link || !state?.sensors) return [];
  return link.sensors.map((id) => state.sensors.find((sensor) => sensor.id === id)).filter(Boolean);
}

function organObjects(organKey) {
  const keys = {
    kidneys: ["leftKidney", "rightKidney"],
    intestines: ["smallIntestine", "largeIntestine"],
    vessels: ["vessels"]
  }[organKey] || [organKey];
  return keys.map((key) => bodyParts[key]).filter(Boolean);
}

function organMeshes() {
  const meshes = [];
  Object.values(bodyParts).forEach((object) => {
    object?.traverse?.((child) => {
      const organKey = selectableOrganKey(child.userData?.organKey);
      if (child.isMesh && organKey && isObjectVisibleInScene(child)) meshes.push(child);
    });
  });
  return meshes;
}

function selectableOrganKey(organKey) {
  if (!organKey || organKey === "skin") return "";
  const normalized = organMetricLinks[organKey] ? organKey : organGroupKey(organKey);
  return organMetricLinks[normalized] ? normalized : "";
}

function isObjectVisibleInScene(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function rememberMaterialBase(material) {
  if (!material || material.userData.organBase) return;
  material.userData.organBase = {
    color: material.color?.getHex?.() || 0xffffff,
    emissive: material.emissive?.getHex?.() || 0x000000,
    emissiveIntensity: material.emissiveIntensity || 0,
    opacity: material.opacity ?? 1
  };
}

function setOrganMaterialHighlight(object, active, color = 0xffffff) {
  object?.traverse?.((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      rememberMaterialBase(material);
      const base = material.userData.organBase;
      if (active) {
        if (material.emissive) {
          material.emissive.setHex(color);
          material.emissiveIntensity = Math.max(base.emissiveIntensity + 0.45, 0.58);
        } else {
          material.color?.setHex?.(color);
        }
        if (material.transparent) material.opacity = Math.min(1, base.opacity + 0.14);
      } else {
        material.color?.setHex?.(base.color);
        if (material.emissive) {
          material.emissive.setHex(base.emissive);
          material.emissiveIntensity = base.emissiveIntensity;
        }
        if (material.transparent) material.opacity = base.opacity;
      }
      material.needsUpdate = true;
    });
  });
}

function updateOrganLinks(state = twinState) {
  const organKey = selectedOrganKey || sensorOrganMap[selectedSensorId] || "pancreas";
  const link = organMetricLinks[organKey] || organMetricLinks.pancreas;
  Object.entries(bodyParts).forEach(([key, object]) => {
    if (key !== "skin") setOrganMaterialHighlight(object, false);
  });
  organObjects(organKey).forEach((object) => setOrganMaterialHighlight(object, true, colorToHex(link.color, 0xffffff)));
  layerGroups.vessels?.traverse((child) => {
    if (!child.isMesh || !child.material?.emissive) return;
    rememberMaterialBase(child.material);
    const base = child.material.userData.organBase;
    const active = organKey === "vessels";
    child.material.emissiveIntensity = active ? Math.max(base.emissiveIntensity + 0.18, 0.42) : base.emissiveIntensity;
    child.material.needsUpdate = true;
  });
  if (!dom.organLinkCard || !state?.sensors) return;
  dom.organLinkName.textContent = link.label;
  dom.organLinkMetrics.innerHTML = sensorsForOrgan(organKey, state)
    .map((sensor) => `<span class="organ-metric-chip ${sensor.status}">${escapeHtml(sensor.name)}: ${sensor.value} ${escapeHtml(sensor.unit)}</span>`)
    .join("");
}

function selectOrgan(organKey) {
  const selectableKey = selectableOrganKey(organKey);
  if (!selectableKey) return;
  selectedOrganKey = selectableKey;
  const sensors = sensorsForOrgan(selectedOrganKey);
  if (sensors[0]) selectedSensorId = sensors[0].id;
  renderTwin(twinState);
}

function focusOrgan(organKey) {
  const objects = organObjects(organKey);
  if (!objects.length || !controls) return;
  const box = new THREE.Box3();
  objects.forEach((object) => box.expandByObject(object));
  if (box.isEmpty()) return;
  controls.target.copy(box.getCenter(new THREE.Vector3()));
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
  addEllipsoid("bladder", [0, -0.38, 0.34], [0.095, 0.11, 0.08], organMaterial(0xff77aa, 0x4c0b24, 0.8));
}

function createVascularAndNerveNetwork() {
  const artery = vesselMaterial(0xff4d6d, 0x520411, 0.22);
  const vein = vesselMaterial(0x35c7ff, 0x033247, 0.18);
  const nerve = vesselMaterial(0xffd166, 0x493000, 0.12);

  [
    {
      name: "arm-artery-left",
      mat: artery,
      radius: 0.006,
      points: [[-0.56, 1.58, 0.11], [-0.76, 1.25, 0.12], [-0.94, 0.92, 0.12], [-1.12, 0.58, 0.13], [-1.28, 0.38, 0.13]]
    },
    {
      name: "arm-artery-right",
      mat: artery,
      radius: 0.006,
      points: [[0.56, 1.58, 0.11], [0.76, 1.25, 0.12], [0.94, 0.92, 0.12], [1.12, 0.58, 0.13], [1.28, 0.38, 0.13]]
    },
    {
      name: "arm-vein-left",
      mat: vein,
      radius: 0.0055,
      points: [[-0.62, 1.54, 0.16], [-0.82, 1.2, 0.17], [-0.99, 0.86, 0.17], [-1.14, 0.54, 0.18], [-1.24, 0.34, 0.17]]
    },
    {
      name: "arm-vein-right",
      mat: vein,
      radius: 0.0055,
      points: [[0.62, 1.54, 0.16], [0.82, 1.2, 0.17], [0.99, 0.86, 0.17], [1.14, 0.54, 0.18], [1.24, 0.34, 0.17]]
    },
    {
      name: "leg-artery-guide-left",
      mat: artery,
      radius: 0.006,
      points: [[-0.1, -0.48, 0.07], [-0.24, -0.92, 0.08], [-0.34, -1.45, 0.09], [-0.42, -2.08, 0.06], [-0.43, -2.24, 0.08]]
    },
    {
      name: "leg-artery-guide-right",
      mat: artery,
      radius: 0.006,
      points: [[0.1, -0.48, 0.07], [0.24, -0.92, 0.08], [0.34, -1.45, 0.09], [0.42, -2.08, 0.06], [0.43, -2.24, 0.08]]
    },
    {
      name: "leg-vein-guide-left",
      mat: vein,
      radius: 0.0055,
      points: [[-0.04, -0.42, 0.13], [-0.18, -0.98, 0.13], [-0.29, -1.56, 0.11], [-0.39, -2.1, 0.075], [-0.33, -2.25, 0.09]]
    },
    {
      name: "leg-vein-guide-right",
      mat: vein,
      radius: 0.0055,
      points: [[0.04, -0.42, 0.13], [0.18, -0.98, 0.13], [0.29, -1.56, 0.11], [0.39, -2.1, 0.075], [0.33, -2.25, 0.09]]
    }
  ].forEach((path) => createTube(path.points, path.radius, path.mat, path.name));

  createHandVessels(-1, artery, vein);
  createHandVessels(1, artery, vein);
  createFootVessels(-1, artery, vein);
  createFootVessels(1, artery, vein);

  createTube([[0, 2.45, 0.02], [-0.08, 2.25, 0.02], [-0.22, 1.94, 0.02], [-0.42, 1.78, 0.02]], 0.0045, nerve, "neck-nerve-left");
  createTube([[0, 2.45, 0.02], [0.08, 2.25, 0.02], [0.22, 1.94, 0.02], [0.42, 1.78, 0.02]], 0.0045, nerve, "neck-nerve-right");
}

function createHandVessels(side, artery, vein) {
  const arteryPalm = [side * 1.28, 0.38, 0.12];
  const veinPalm = [side * 1.24, 0.34, 0.16];
  for (let i = 0; i < 5; i += 1) {
    const spread = (i - 2) * 0.045;
    createTube([arteryPalm, [side * (1.34 + i * 0.018), 0.28 + spread, 0.13]], 0.0035, artery, `hand-artery-${side}-${i}`);
    createTube([veinPalm, [side * (1.32 + i * 0.018), 0.27 + spread, 0.17]], 0.003, vein, `hand-vein-${side}-${i}`);
  }
}

function createFootVessels(side, artery, vein) {
  const arteryArch = [side * 0.43, -2.22, 0.08];
  const veinArch = [side * 0.31, -2.23, 0.095];
  for (let i = 0; i < 5; i += 1) {
    const toeX = side * (0.32 + i * 0.05);
    const toeY = -2.275 + (i - 2) * 0.004;
    const toeDepth = 0.095 + i * 0.004;
    createTube([arteryArch, [toeX, toeY, toeDepth]], 0.004, artery, `foot-artery-${side}-${i}`);
    createTube([veinArch, [toeX, toeY + 0.01, toeDepth + 0.012]], 0.0032, vein, `foot-vein-${side}-${i}`);
  }
}

function createDiseaseLayers() {
  disease.pancreasGlow = addGlowSphere([-0.02, 0.68, 0.13], [0.5, 0.16, 0.12], 0xf4b740);
  disease.glucoseField = new THREE.Group();
  disease.pressure = new THREE.Group();
  disease.clot = createClotGroup([-0.18, -1.58, 0.02], 0.68);
  disease.lungClot = createClotGroup([0.22, 1.42, 0.08], 0.5);
  disease.brain = addGlowSphere([0, 2.66, 0.03], [0.3, 0.2, 0.22], 0xa78bfa);
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

  [[0.27, 0.56, -0.15], [-0.27, 0.56, -0.15]].forEach((pos) => {
    const glow = addGlowSphere(pos, [0.13, 0.2, 0.1], 0xc084fc);
    disease.kidney.add(glow);
  });
  addToActiveLayer(disease.kidney);

  Object.values(disease).forEach((item) => {
    if (item) item.visible = false;
  });
}

function createBloodParticles() {
  const material = new THREE.MeshBasicMaterial({ color: 0xffd4d4, transparent: true, opacity: 0.82 });
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
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), material.clone());
    const t = i / 46;
    particle.position.copy(path.getPointAt(t));
    particle.userData = { t, path, speed: 0.45 + (i % 5) * 0.045, flow: true, baseScale: 1, pulse: i * 0.7 };
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
  createAnatomyLabel("الدماغ", "#a78bfa", [0.45, 2.64, 0.16]);
  createAnatomyLabel("الرئتان", "#48c7d8", [0.55, 1.37, 0.18]);
  createAnatomyLabel("القلب", "#ef4b5f", [-0.5, 1.18, 0.18]);
  createAnatomyLabel("الكبد", "#9a4d2f", [-0.62, 0.92, 0.18]);
  createAnatomyLabel("المعدة", "#ff9f80", [0.66, 0.92, 0.2]);
  createAnatomyLabel("البنكرياس", "#f4b740", [-0.5, 0.7, 0.18]);
  createAnatomyLabel("الكلى", "#c084fc", [0.55, 0.62, 0.18]);
  createAnatomyLabel("الأمعاء", "#ffb3a7", [0.55, 0.34, 0.18]);
  createAnatomyLabel("المثانة", "#ff77aa", [0.5, -0.12, 0.18]);
  createAnatomyLabel("الأوعية", "#ff5d73", [-0.6, 0.5, 0.18]);
}

function addBrainFolds() {
  const foldMat = new THREE.LineBasicMaterial({ color: 0xefe7ff, transparent: true, opacity: 0.42 });
  for (let i = 0; i < 5; i += 1) {
    const points = [];
    for (let j = 0; j < 24; j += 1) {
      const u = (j / 23) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(u) * (0.06 + i * 0.014), 2.62 + Math.sin(u * 2 + i) * 0.01, 0.02 + Math.sin(u) * (0.04 + i * 0.01)));
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
  const vectors = points.map(vectorFromPoint);
  const curve = new THREE.CatmullRomCurve3(vectors);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 18, false), material);
  mesh.name = name;
  mesh.castShadow = true;
  addToActiveLayer(mesh);
  addVesselFlow(vectors, radius, material, name);
  return mesh;
}

function vectorFromPoint(point) {
  return point?.isVector3 ? point.clone() : new THREE.Vector3(...point);
}

function shouldShowVesselFlow(name = "") {
  return /(aorta|artery|vein|carotid|vascular|hand-|foot-)/i.test(name) && !/nerve/i.test(name);
}

function addVesselFlow(points, radius, material, name) {
  if (!shouldShowVesselFlow(name)) return;
  const length = points.reduce((sum, point, index) => (index === 0 ? 0 : sum + point.distanceTo(points[index - 1])), 0);
  const count = Math.max(2, Math.min(10, Math.round(length * 4.2)));
  const isVein = /vein/i.test(name);
  const flowDirection = isVein ? -1 : 1;
  const color = isVein ? 0x6ee7ff : 0xff7a86;
  const flowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: isVein ? 0.92 : 0.95,
    depthWrite: false
  });
  const curve = new THREE.CatmullRomCurve3(points);
  for (let i = 0; i < count; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius * 1.8, 0.012), 12, 12), flowMaterial.clone());
    const t = i / count;
    particle.position.copy(curve.getPointAt(t));
    particle.userData = {
      t,
      path: curve,
      speed: (isVein ? 0.34 : 0.48) + (i % 4) * 0.035,
      flowDirection,
      flowKind: isVein ? "vein" : "artery",
      flow: true,
      vesselName: name,
      baseScale: isVein ? 0.9 : 1.05,
      pulse: i * 0.8,
      color
    };
    bloodParticles.push(particle);
    addToActiveLayer(particle);
  }
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
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.24,
    emissive,
    emissiveIntensity
  });
  material.userData.flowColor = color;
  return material;
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
    updateOrganLinks(state);
  }
  renderSensors(state.sensors);
  renderInterventions(state.interventions);
  renderImaging(state.imaging);
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
      selectedOrganKey = sensorOrganMap[sensor.id] || selectedOrganKey;
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
    ["دقة النموذج", `${prediction.modelConfidence || 72}%`, "مدعومة بالمؤشرات وصور الأشعة"],
    ["خطر السكري", `${Math.round(prediction.diabetesProbability * 100)}%`, "محاكاة أيضية"],
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

function renderImaging(imaging = {}) {
  if (!dom.imagingList || !dom.imagingConfidence || !dom.imagingStatus) return;
  const confidence = imaging.modelConfidence || 72;
  dom.imagingConfidence.textContent = `دقة ${confidence}%`;
  dom.imagingStatus.textContent =
    Date.now() < imagingStatusOverrideUntil ? imagingStatusOverride : imaging.note || "لم يتم رفع صور أشعة بعد";
  const studies = imaging.studies || [];
  if (dom.clearImagingBtn) dom.clearImagingBtn.disabled = !studies.length;
  dom.imagingList.innerHTML = studies.length
    ? studies
        .map(
          (study) => `
    <article class="imaging-item">
      <span class="imaging-modality">${escapeHtml(study.modalityLabel)}</span>
      <span class="item-main">
        <strong>${escapeHtml(study.regionLabel)} · ${escapeHtml(study.detectedOrganLabel || "عضو غير محدد")} · ${escapeHtml(study.fileName)}</strong>
        <small>${escapeHtml(study.finding)}</small>
      </span>
      <span class="sensor-value">${study.confidence}%</span>
    </article>
  `
        )
        .join("")
    : `<article class="imaging-empty">ارفع صورة وسيحدد OpenAI: CT · MRI · X-Ray · Ultrasound</article>`;
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
  document.addEventListener("fullscreenchange", updateSceneToolState);
  dom.loginForm?.addEventListener("submit", handleLoginSubmit);
  dom.togglePasswordBtn?.addEventListener("click", togglePasswordVisibility);
  dom.logoutBtn?.addEventListener("click", () => setAuthenticated(false));
  dom.refreshBtn.addEventListener("click", handleRefreshClick);
  dom.resetCameraBtn.addEventListener("click", toggleSceneFullscreen);
  dom.askBtn.addEventListener("click", () => askAi());
  dom.clearImagingBtn?.addEventListener("click", clearImagingUpload);
  dom.imagingFile?.addEventListener("change", () => {
    const file = dom.imagingFile.files?.[0];
    if (!file) return;
    setTemporaryImagingStatus(`تم اختيار ${file.name} · جاري تحديد النوع والمنطقة بالذكاء الاصطناعي...`);
    handleImagingUpload();
  });
  dom.layerToggles.forEach((input) => {
    input.addEventListener("change", () => {
      layerState[input.dataset.layerToggle] = input.checked;
      applyLayerVisibility();
    });
  });
  dom.paletteButtons.forEach((button) => {
    button.addEventListener("click", () => setAnatomyPalette(button.dataset.anatomyPalette));
  });
  dom.skinOpacityRange?.addEventListener("input", () => setAppearanceOpacity("skin", dom.skinOpacityRange.value));
  dom.organOpacityRange?.addEventListener("input", () => setAppearanceOpacity("organs", dom.organOpacityRange.value));
  dom.cutawayToggle?.addEventListener("change", () => {
    cutawayEnabled = dom.cutawayToggle.checked;
    applyCutawayMode();
  });
  dom.teachingModeToggle?.addEventListener("change", () => {
    teachingModeEnabled = dom.teachingModeToggle.checked;
    applyTeachingMode();
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
    const meshes = [...sensorMeshes.values()]
      .filter((group) => isObjectVisibleInScene(group))
      .flatMap((group) => group.children.filter(isObjectVisibleInScene));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const sensorId = hit?.object?.userData?.sensorId;
    if (sensorId) {
      selectedSensorId = sensorId;
      selectedOrganKey = sensorOrganMap[sensorId] || selectedOrganKey;
      renderTwin(twinState);
      return;
    }
    const organHit = raycaster.intersectObjects(organMeshes(), true)[0];
    const organKey = selectableOrganKey(organHit?.object?.userData?.organKey);
    if (organKey) {
      selectOrgan(organKey);
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
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  controls?.target.copy(DEFAULT_CAMERA_TARGET);
  controls?.update();
}

async function toggleSceneFullscreen() {
  const isFullscreen = document.fullscreenElement === dom.scenePanel || document.body.classList.contains("scene-expanded");
  try {
    if (isFullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen();
      document.body.classList.remove("scene-expanded");
    } else if (dom.scenePanel?.requestFullscreen) {
      await dom.scenePanel.requestFullscreen();
    } else {
      document.body.classList.add("scene-expanded");
    }
  } catch {
    document.body.classList.toggle("scene-expanded", !isFullscreen);
  }
  resetCamera();
  updateSceneToolState();
  setTimeout(resize, 80);
}

function updateSceneToolState() {
  const expanded = document.fullscreenElement === dom.scenePanel || document.body.classList.contains("scene-expanded");
  dom.resetCameraBtn.classList.toggle("is-active", expanded);
  dom.resetCameraBtn.setAttribute("aria-pressed", String(expanded));
  dom.resetCameraBtn.title = expanded ? "إغلاق عرض النموذج" : "تكبير عرض النموذج";
  dom.resetCameraBtn.setAttribute("aria-label", dom.resetCameraBtn.title);
  dom.resetCameraBtn.innerHTML = `<i data-lucide="${expanded ? "minimize-2" : "maximize-2"}"></i>`;
  refreshIcons();
}

async function handleRefreshClick() {
  dom.refreshBtn.disabled = true;
  dom.refreshBtn.classList.add("is-busy");
  try {
    await refreshTwin();
  } finally {
    setTimeout(() => {
      dom.refreshBtn.disabled = false;
      dom.refreshBtn.classList.remove("is-busy");
    }, 240);
  }
}

async function handleImagingUpload() {
  const file = dom.imagingFile?.files?.[0];
  if (!file) {
    if (dom.imagingStatus) setTemporaryImagingStatus("اختر صورة أشعة أولاً");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setTemporaryImagingStatus("حجم الصورة أكبر من 5MB");
    return;
  }

  setImagingControlsBusy(true);
  setTemporaryImagingStatus(`جاري تحليل ${file.name} بواسطة OpenAI لتحديد نوع الأشعة والعضو...`);
  try {
    const imageData = file.type.startsWith("image/") ? await readFileAsDataUrl(file) : null;
    const response = await fetch("/api/imaging/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        imageData
      })
    });
    if (!response.ok) throw new Error("Upload failed");
    twinState = await response.json();
    renderTwin(twinState);
    const latest = twinState?.imaging?.latest;
    const detected = latest
      ? `${latest.modalityLabel} · ${latest.regionLabel} · ${latest.detectedOrganLabel || "عضو غير محدد"}`
      : fileExtension(file.name);
    setTemporaryImagingStatus(`تم تحليل ${file.name}: ${detected}`);
    askAi("حلل حالة التوأم الرقمي بعد إضافة دليل تصوير الأشعة.");
  } catch {
    setTemporaryImagingStatus("تعذر تحليل صورة الأشعة الآن");
  } finally {
    setImagingControlsBusy(false);
  }
}

async function clearImagingUpload() {
  setImagingControlsBusy(true);
  setTemporaryImagingStatus("جاري مسح صورة الأشعة...");
  try {
    const response = await fetch("/api/imaging/clear", { method: "POST" });
    if (!response.ok) throw new Error("Clear failed");
    twinState = await response.json();
    if (dom.imagingFile) dom.imagingFile.value = "";
    renderTwin(twinState);
    setTemporaryImagingStatus("تم مسح صور الأشعة المرفوعة");
  } catch {
    setTemporaryImagingStatus("تعذر مسح صورة الأشعة الآن");
  } finally {
    setImagingControlsBusy(false);
  }
}

function setTemporaryImagingStatus(message, duration = 6000) {
  imagingStatusOverride = message;
  imagingStatusOverrideUntil = Date.now() + duration;
  if (dom.imagingStatus) dom.imagingStatus.textContent = message;
}

function setImagingControlsBusy(busy) {
  if (dom.imagingFile) dom.imagingFile.disabled = busy;
  if (dom.clearImagingBtn) dom.clearImagingBtn.disabled = busy || !(twinState?.imaging?.studies || []).length;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileExtension(name = "") {
  const match = String(name).match(/\.([^.]+)$/);
  return match ? match[1].toUpperCase() : "بدون امتداد";
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    camera.position.copy(MOBILE_CAMERA_POSITION);
    controls?.target.copy(DEFAULT_CAMERA_TARGET);
    camera.userData.mobileLayout = true;
  } else if (!mobileLayout && camera.userData.mobileLayout) {
    resetCamera();
    camera.userData.mobileLayout = false;
  }
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  updateDebugHelpers();
  controls?.update();

  if (humanGroup) {
    animateLungBreathing(elapsed);
    const bpm = Math.max(45, twinState?.summary?.heartRate || 72);
    const beat = Math.exp(-Math.pow(((elapsed % (60 / bpm)) / (60 / bpm) - 0.08) / 0.075, 2)) * 0.08;
    if (bodyParts.heart) applyOrganDisplayScale(bodyParts.heart, [1 + beat * 1.4, 1 + beat * 1.4, 1 + beat * 1.4]);
  }

  animateParticles(delta, elapsed);
  animateDiseaseLayers(elapsed);
  animateSensors(elapsed);
  renderer.render(scene, camera);
  markWebglReadyIfCanvasHasSignal();
  requestAnimationFrame(animate);
}

function animateLungBreathing(elapsed) {
  const lungs = bodyParts.lungs;
  if (!lungs) return;
  const inhale = (Math.sin(elapsed * LUNG_BREATH_RATE - Math.PI / 2) + 1) * 0.5;
  const softPulse = Math.sin(elapsed * LUNG_BREATH_RATE * 2) * 0.006;
  const expansion = Math.max(0, inhale + softPulse);
  applyOrganDisplayScale(lungs, [
    1 + expansion * LUNG_EXPANSION_X,
    1 + expansion * LUNG_EXPANSION_Y,
    1 + expansion * LUNG_EXPANSION_Z
  ]);
  const base = lungs.userData.basePosition;
  if (base) lungs.position.set(base.x, base.y + expansion * 0.018, base.z + expansion * 0.022);
}

function animateParticles(delta, elapsed) {
  bloodParticles.forEach((particle) => {
    const isLegOrVein = /leg|foot|vein/i.test(particle.userData.vesselName || "");
    const clotDrag = twinState?.summary?.clotRisk > 65 && (particle.userData.t > 0.55 || isLegOrVein) ? 0.42 : 1;
    const direction = particle.userData.flowDirection || 1;
    particle.userData.t += delta * particle.userData.speed * 0.18 * clotDrag * direction;
    particle.userData.t = wrapFlowProgress(particle.userData.t);
    particle.position.copy(particle.userData.path.getPointAt(particle.userData.t));
    const lowOxygen = twinState?.summary?.oxygen < 94;
    particle.material.color.setHex(lowOxygen ? 0xef4b5f : particle.userData.color || 0xffd4d4);
    const pulse = particle.userData.baseScale * (1 + Math.sin(elapsed * 8 + particle.userData.pulse) * 0.22);
    particle.scale.setScalar(pulse);
    if (particle.material.transparent) particle.material.opacity = 0.58 + Math.sin(elapsed * 5 + particle.userData.pulse) * 0.18 + (clotDrag < 1 ? -0.18 : 0);
  });

  glucoseParticles.forEach((particle) => {
    particle.position.y = particle.userData.baseY + Math.sin(elapsed * particle.userData.speed + particle.userData.phase) * 0.08;
    particle.rotation.y += delta;
  });
}

function wrapFlowProgress(value) {
  if (value >= 1 || value < 0) return ((value % 1) + 1) % 1;
  return value;
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
