import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4321);
const host = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const defaultOpenAiModel = "gpt-4o-mini";

let activeScenario = "baseline";
let activeIntervention = "observe";
let scenarioUpdatedAt = Date.now();
let interventionUpdatedAt = Date.now();
let imagingStudies = [];

const scenarios = {
  baseline: {
    label: "جسم مستقر",
    shortLabel: "مستقر",
    description: "محاكاة صحية رقمية لجسم افتراضي بمؤشرات أيضية ووعائية ضمن النطاق.",
    severity: 0.08,
    disease: "baseline",
    modifiers: {}
  },
  diabetes_risk: {
    label: "خطر السكري",
    shortLabel: "سكري",
    description: "ارتفاع محاكى في سكر الدم ومقاومة الإنسولين مع ضغط على البنكرياس والكلى.",
    severity: 0.52,
    disease: "diabetes",
    modifiers: {
      glucose: 78,
      hba1c: 1.4,
      insulinResistance: 44,
      bmi: 5.4,
      triglycerides: 62,
      ldl: 24,
      egfr: -11,
      inflammation: 2.2,
      systolic: 10,
      diastolic: 4
    }
  },
  hypertension: {
    label: "ارتفاع ضغط الدم",
    shortLabel: "ضغط",
    description: "ارتفاع محاكى في الضغط الشرياني مع إجهاد على القلب والكلى والأوعية.",
    severity: 0.56,
    disease: "hypertension",
    modifiers: {
      systolic: 44,
      diastolic: 22,
      heartRate: 14,
      ldl: 18,
      egfr: -8,
      neuroPerfusion: -5,
      vascularStiffness: 38,
      clotRisk: 12,
      inflammation: 1.4
    }
  },
  thrombosis: {
    label: "خطر جلطة",
    shortLabel: "جلطات",
    description: "ارتفاع محاكى في قابلية التخثر مع خثرة في وريد الساق واحتمال انتقالها للرئة.",
    severity: 0.76,
    disease: "thrombosis",
    modifiers: {
      clotRisk: 62,
      dDimer: 780,
      oxygen: -4,
      heartRate: 26,
      systolic: -4,
      neuroPerfusion: -4,
      splenicPerfusion: -8,
      spleenSize: 0.6,
      plateletCount: 92,
      inflammation: 4.2,
      legFlow: -42,
      painScore: 5
    }
  },
  stroke_risk: {
    label: "خطر سكتة",
    shortLabel: "سكتة",
    description: "نقص تروية دماغي محاكى مع إجهاد في الشرايين السباتية وعوامل وعائية مرتفعة.",
    severity: 0.82,
    disease: "stroke",
    modifiers: {
      neuroPerfusion: -28,
      systolic: 34,
      diastolic: 18,
      ldl: 52,
      clotRisk: 36,
      dDimer: 420,
      heartRate: 18,
      plateletCount: 54,
      vascularStiffness: 46,
      oxygen: -2,
      inflammation: 3.8
    }
  },
  cardio_metabolic: {
    label: "متلازمة أيضية",
    shortLabel: "أيضي",
    description: "تجمع محاكى لعوامل السكر والضغط والدهون، ما يرفع مخاطر القلب والجلطات.",
    severity: 0.68,
    disease: "metabolic",
    modifiers: {
      glucose: 46,
      hba1c: 0.8,
      insulinResistance: 34,
      systolic: 28,
      diastolic: 12,
      ldl: 44,
      triglycerides: 86,
      bmi: 7.2,
      clotRisk: 28,
      vascularStiffness: 34,
      spleenSize: 0.5,
      plateletCount: 38,
      egfr: -9,
      inflammation: 3
    }
  }
};

const interventions = {
  observe: {
    label: "مراقبة",
    description: "لا يوجد تدخل في المحاكاة. تستخدم كخط أساس للمقارنة.",
    modifiers: {}
  },
  lifestyle: {
    label: "نمط حياة",
    description: "يحاكي تحسنًا تدريجيًا مع النشاط والغذاء المتوازن وخفض الوزن.",
    modifiers: {
      glucose: -18,
      hba1c: -0.25,
      insulinResistance: -14,
      bmi: -1.2,
      triglycerides: -18,
      systolic: -6,
      diastolic: -3,
      inflammation: -0.8
    }
  },
  glucose_control: {
    label: "ضبط السكر",
    description: "يحاكي متابعة السكر وتقليل الارتفاعات الحادة في النموذج.",
    modifiers: {
      glucose: -42,
      hba1c: -0.45,
      insulinResistance: -18,
      egfr: 4,
      inflammation: -0.7
    }
  },
  pressure_control: {
    label: "ضبط الضغط",
    description: "يحاكي تقليل الضغط الشرياني وإجهاد الأوعية.",
    modifiers: {
      systolic: -26,
      diastolic: -12,
      vascularStiffness: -18,
      neuroPerfusion: 5,
      egfr: 5,
      clotRisk: -6
    }
  },
  clot_pathway: {
    label: "مسار الجلطات",
    description: "يحاكي مسار تقييم الجلطات وتقليل خطر الانتشار داخل النموذج.",
    modifiers: {
      clotRisk: -28,
      dDimer: -260,
      legFlow: 24,
      oxygen: 2,
      painScore: -2,
      splenicPerfusion: 4,
      plateletCount: -22,
      inflammation: -1.1
    }
  }
};

const sensorTemplates = [
  { id: "glucose", name: "سكر الدم", metric: "glucose", unit: "mg/dL", base: 96, amplitude: 7, decimals: 0, phase: 0.6, zone: "البنكرياس", position: [0.04, 0.61, 0.16], warningHigh: 126, criticalHigh: 180, warningLow: 70, criticalLow: 55 },
  { id: "hba1c", name: "السكر التراكمي", metric: "hba1c", unit: "%", base: 5.3, amplitude: 0.08, decimals: 1, phase: 2.3, zone: "الأيض", position: [0.17, 0.62, 0.15], warningHigh: 5.7, criticalHigh: 6.5 },
  { id: "insulinResistance", name: "مقاومة الإنسولين", metric: "insulinResistance", unit: "%", base: 18, amplitude: 3, decimals: 0, phase: 1.2, zone: "الأيض", position: [-0.12, 0.66, 0.15], warningHigh: 45, criticalHigh: 70 },
  { id: "systolic", name: "ضغط الدم الانقباضي", metric: "systolic", unit: "mmHg", base: 118, amplitude: 5, decimals: 0, phase: 1.8, zone: "الأوعية", position: [0, 1.5, 0.08], warningHigh: 130, criticalHigh: 180, warningLow: 90, criticalLow: 75 },
  { id: "diastolic", name: "ضغط الدم الانبساطي", metric: "diastolic", unit: "mmHg", base: 76, amplitude: 3, decimals: 0, phase: 2.8, zone: "الأوعية", position: [0.18, 1.28, 0.08], warningHigh: 80, criticalHigh: 120, warningLow: 55, criticalLow: 45 },
  { id: "heartRate", name: "معدل النبض", metric: "heartRate", unit: "bpm", base: 72, amplitude: 4, decimals: 0, phase: 0.4, zone: "القلب", position: [-0.12, 1.12, 0.14], warningHigh: 110, criticalHigh: 140, warningLow: 50, criticalLow: 38 },
  { id: "oxygen", name: "تشبع الأكسجين", metric: "oxygen", unit: "%", base: 98, amplitude: 0.8, decimals: 0, phase: 3.1, zone: "الرئتان", position: [0.36, 1.44, 0.09], warningLow: 94, criticalLow: 90 },
  { id: "ldl", name: "LDL كوليسترول", metric: "ldl", unit: "mg/dL", base: 96, amplitude: 8, decimals: 0, phase: 4.2, zone: "الدهون", position: [-0.3, 0.82, 0.12], warningHigh: 130, criticalHigh: 190 },
  { id: "triglycerides", name: "الدهون الثلاثية", metric: "triglycerides", unit: "mg/dL", base: 118, amplitude: 12, decimals: 0, phase: 1.7, zone: "الدهون", position: [-0.18, 0.72, 0.12], warningHigh: 150, criticalHigh: 300 },
  { id: "bmi", name: "مؤشر كتلة الجسم", metric: "bmi", unit: "BMI", base: 25, amplitude: 0.4, decimals: 1, phase: 3.6, zone: "الجسم", position: [0, 0.15, 0.08], warningHigh: 30, criticalHigh: 40 },
  { id: "clotRisk", name: "قابلية التخثر", metric: "clotRisk", unit: "%", base: 16, amplitude: 3, decimals: 0, phase: 2.1, zone: "الأوردة", position: [-0.18, -1, 0.02], warningHigh: 35, criticalHigh: 65 },
  { id: "dDimer", name: "D-dimer محاكى", metric: "dDimer", unit: "ng/mL", base: 260, amplitude: 42, decimals: 0, phase: 4.5, zone: "التخثر", position: [-0.2, -1.42, 0.02], warningHigh: 500, criticalHigh: 1000 },
  { id: "splenicPerfusion", name: "تروية الطحال", metric: "splenicPerfusion", unit: "%", base: 97, amplitude: 2, decimals: 0, phase: 3.4, zone: "الطحال", position: [0.33, 0.8, 0.13], warningLow: 85, criticalLow: 70 },
  { id: "spleenSize", name: "حجم الطحال", metric: "spleenSize", unit: "cm", base: 11.2, amplitude: 0.25, decimals: 1, phase: 1.1, zone: "الطحال", position: [0.39, 0.72, 0.13], warningHigh: 13, criticalHigh: 15 },
  { id: "plateletCount", name: "الصفائح الدموية", metric: "plateletCount", unit: "K/uL", base: 245, amplitude: 14, decimals: 0, phase: 2.7, zone: "الطحال", position: [0.29, 0.64, 0.14], warningHigh: 450, criticalHigh: 650, warningLow: 150, criticalLow: 50 },
  { id: "legFlow", name: "تدفق أوردة الساق", metric: "legFlow", unit: "%", base: 96, amplitude: 3, decimals: 0, phase: 0.9, zone: "الساق", position: [-0.22, -1.78, 0.02], warningLow: 70, criticalLow: 45 },
  { id: "egfr", name: "وظائف الكلى eGFR", metric: "egfr", unit: "mL/min", base: 98, amplitude: 3, decimals: 0, phase: 2.6, zone: "الكلى", position: [-0.27, 0.56, -0.12], warningLow: 60, criticalLow: 30 },
  { id: "neuroPerfusion", name: "تروية الدماغ", metric: "neuroPerfusion", unit: "%", base: 98, amplitude: 2, decimals: 0, phase: 1.4, zone: "الدماغ", position: [0, 2.48, 0.06], warningLow: 85, criticalLow: 70 },
  { id: "vascularStiffness", name: "تيبس الأوعية", metric: "vascularStiffness", unit: "%", base: 18, amplitude: 3, decimals: 0, phase: 5.1, zone: "الأوعية", position: [0.18, 0.95, 0.08], warningHigh: 45, criticalHigh: 70 },
  { id: "inflammation", name: "التهاب CRP", metric: "inflammation", unit: "mg/L", base: 1.1, amplitude: 0.25, decimals: 1, phase: 2.2, zone: "التهاب", position: [0.06, 0.08, 0.08], warningHigh: 3, criticalHigh: 10 },
  { id: "painScore", name: "ألم/تنميل محاكى", metric: "painScore", unit: "/10", base: 0, amplitude: 0.3, decimals: 0, phase: 0.3, zone: "الأعراض", position: [-0.38, -0.7, 0.04], warningHigh: 4, criticalHigh: 7 }
];

const anatomy = [
  { id: "brain", name: "الدماغ", color: "#a78bfa", region: "nervous" },
  { id: "heart", name: "القلب", color: "#ef4b5f", region: "cardio" },
  { id: "lungs", name: "الرئتان", color: "#48c7d8", region: "respiratory" },
  { id: "liver", name: "الكبد", color: "#9a4d2f", region: "digestive" },
  { id: "spleen", name: "الطحال", color: "#9254de", region: "immune" },
  { id: "stomach", name: "المعدة", color: "#ff9f80", region: "digestive" },
  { id: "pancreas", name: "البنكرياس", color: "#f4b740", region: "metabolic" },
  { id: "intestines", name: "الأمعاء", color: "#ffb3a7", region: "digestive" },
  { id: "kidneys", name: "الكلى", color: "#c084fc", region: "renal" },
  { id: "bladder", name: "المثانة", color: "#ff77aa", region: "renal" },
  { id: "vessels", name: "الأوعية", color: "#ff5d73", region: "vascular" }
];

const imagingModalities = {
  ct: { id: "ct", label: "CT", weight: 10, focus: ["الرئتان", "الأوعية", "البطن"] },
  mri: { id: "mri", label: "MRI", weight: 12, focus: ["الدماغ", "الأعصاب", "الأنسجة"] },
  xray: { id: "xray", label: "X-Ray", weight: 7, focus: ["الصدر", "العظام", "الرئتان"] },
  ultrasound: { id: "ultrasound", label: "Ultrasound", weight: 8, focus: ["الكبد", "الكلى", "البطن"] }
};

const imagingRegions = {
  brain: { id: "brain", label: "الدماغ", systems: ["brain", "vessels"], risk: "stroke" },
  chest: { id: "chest", label: "الصدر", systems: ["lungs", "heart", "vessels"], risk: "cardio" },
  abdomen: { id: "abdomen", label: "البطن", systems: ["liver", "spleen", "stomach", "pancreas", "intestines"], risk: "metabolic" },
  pelvis: { id: "pelvis", label: "الحوض", systems: ["kidneys", "bladder", "vessels"], risk: "renal" },
  vascular: { id: "vascular", label: "الأوعية", systems: ["vessels", "heart"], risk: "vascular" },
  wholeBody: { id: "wholeBody", label: "كامل الجسم", systems: ["brain", "heart", "lungs", "kidneys", "vessels"], risk: "global" }
};

const imagingOrgans = {
  brain: { id: "brain", label: "الدماغ", region: "brain" },
  lungs: { id: "lungs", label: "الرئتان", region: "chest" },
  heart: { id: "heart", label: "القلب", region: "chest" },
  liver: { id: "liver", label: "الكبد", region: "abdomen" },
  spleen: { id: "spleen", label: "الطحال", region: "abdomen" },
  stomach: { id: "stomach", label: "المعدة", region: "abdomen" },
  pancreas: { id: "pancreas", label: "البنكرياس", region: "abdomen" },
  kidneys: { id: "kidneys", label: "الكلى", region: "pelvis" },
  bladder: { id: "bladder", label: "المثانة", region: "pelvis" },
  intestines: { id: "intestines", label: "الأمعاء", region: "abdomen" },
  vessels: { id: "vessels", label: "الأوعية", region: "vascular" },
  bones: { id: "bones", label: "العظام", region: "wholeBody" },
  unknown: { id: "unknown", label: "غير محدد", region: "wholeBody" }
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json"
};

function currentScenario() {
  return scenarios[activeScenario] || scenarios.baseline;
}

function currentIntervention() {
  return interventions[activeIntervention] || interventions.observe;
}

function oscillate(template, t) {
  const scenario = currentScenario();
  const intervention = currentIntervention();
  const wave = Math.sin(t / 3800 + template.phase) * template.amplitude;
  const micro = Math.sin(t / 950 + template.phase * 0.7) * template.amplitude * 0.14;
  let value = template.base + wave + micro + (scenario.modifiers[template.metric] || 0) + (intervention.modifiers[template.metric] || 0);

  if (activeScenario === "thrombosis" && template.metric === "dDimer") value += Math.max(0, Math.sin(t / 1200) * 160);
  if (activeScenario === "stroke_risk" && template.metric === "neuroPerfusion") value -= Math.max(0, Math.sin(t / 1400) * 7);
  if (activeScenario === "diabetes_risk" && template.metric === "glucose") value += Math.max(0, Math.sin(t / 1600) * 18);

  if (["glucose", "ldl", "triglycerides", "dDimer"].includes(template.metric)) value = clamp(value, 0, 1500);
  if (["oxygen", "clotRisk", "legFlow", "neuroPerfusion", "vascularStiffness", "insulinResistance", "splenicPerfusion"].includes(template.metric)) value = clamp(value, 0, 100);
  if (template.metric === "spleenSize") value = clamp(value, 7, 25);
  if (template.metric === "plateletCount") value = clamp(value, 0, 1000);
  if (template.metric === "hba1c") value = clamp(value, 3.8, 15);
  if (template.metric === "bmi") value = clamp(value, 16, 55);
  if (template.metric === "egfr") value = clamp(value, 5, 130);
  if (template.metric === "painScore") value = clamp(value, 0, 10);

  const factor = 10 ** template.decimals;
  return Math.round(value * factor) / factor;
}

function sensorStatus(sensor) {
  const value = sensor.value;
  if (typeof sensor.criticalLow === "number" && value <= sensor.criticalLow) return "critical";
  if (typeof sensor.warningLow === "number" && value <= sensor.warningLow) return "warning";
  if (typeof sensor.criticalHigh === "number" && value >= sensor.criticalHigh) return "critical";
  if (typeof sensor.warningHigh === "number" && value >= sensor.warningHigh) return "warning";
  return "normal";
}

function severityWeight(status) {
  if (status === "critical") return 1;
  if (status === "warning") return 0.52;
  return 0.05;
}

function buildTwinState() {
  const now = Date.now();
  const scenario = currentScenario();
  const intervention = currentIntervention();
  const sensors = sensorTemplates.map((template) => {
    const value = oscillate(template, now);
    return {
      ...template,
      value,
      status: sensorStatus({ ...template, value }),
      trend: Number((Math.sin(now / 5000 + template.phase) * template.amplitude * 0.3).toFixed(template.decimals))
    };
  });

  const byId = Object.fromEntries(sensors.map((sensor) => [sensor.id, sensor]));
  const openAlerts = sensors.filter((sensor) => sensor.status !== "normal");
  const sensorRisk = sensors.reduce((sum, sensor) => sum + severityWeight(sensor.status) * 5.4, 0);
  const imaging = buildImagingSummary();
  const risk = clamp(Math.round(9 + scenario.severity * 42 + sensorRisk), 0, 100);
  const vascularRisk = clamp(Math.round((byId.systolic.value - 100) * 0.55 + byId.ldl.value * 0.18 + byId.clotRisk.value * 0.38 + byId.vascularStiffness.value * 0.5), 0, 100);
  const metabolicRisk = clamp(Math.round((byId.glucose.value - 80) * 0.34 + (byId.hba1c.value - 4.8) * 16 + byId.insulinResistance.value * 0.42 + Math.max(0, byId.bmi.value - 24) * 2.2), 0, 100);
  const perfusionIndex = clamp(Math.round((byId.oxygen.value * 0.34 + byId.neuroPerfusion.value * 0.44 + byId.legFlow.value * 0.22) / 1.0), 0, 100);
  const health = clamp(Math.round(100 - risk * 0.56 - Math.max(0, 94 - byId.oxygen.value) - Math.max(0, 70 - byId.egfr.value) * 0.4), 0, 100);

  return {
    generatedAt: new Date(now).toISOString(),
    disclaimer: "تم إنشاء التوأم الرقمي بواسطة المهندس سعد الشهري.",
    scenario: {
      id: activeScenario,
      updatedAt: new Date(scenarioUpdatedAt).toISOString(),
      ...scenario
    },
    intervention: {
      id: activeIntervention,
      updatedAt: new Date(interventionUpdatedAt).toISOString(),
      ...intervention
    },
    asset: {
      id: "BODY-TWIN-DEMO-001",
      name: "توأم رقمي للجسم البشري",
      subject: "حالة افتراضية للمحاكاة الصحية",
      location: "مختبر محاكاة",
      model: "AI + API + 3D",
      uptimeMinutes: Math.round((now - scenarioUpdatedAt + 1000 * 60 * 45) / 60000),
      health
    },
    summary: {
      risk,
      health,
      vascularRisk,
      metabolicRisk,
      perfusionIndex,
      glucose: byId.glucose.value,
      hba1c: byId.hba1c.value,
      bloodPressure: `${byId.systolic.value}/${byId.diastolic.value}`,
      heartRate: byId.heartRate.value,
      oxygen: byId.oxygen.value,
      ldl: byId.ldl.value,
      clotRisk: byId.clotRisk.value,
      dDimer: byId.dDimer.value,
      neuroPerfusion: byId.neuroPerfusion.value,
      egfr: byId.egfr.value,
      modelConfidence: imaging.modelConfidence,
      openAlerts: openAlerts.length
    },
    anatomy,
    sensors,
    lesions: buildLesions(byId, scenario),
    interventions: buildInterventionOptions(),
    imaging,
    events: buildEvents(openAlerts, scenario, intervention, imaging),
    prediction: buildPrediction(byId, risk, metabolicRisk, vascularRisk, scenario, imaging),
    recommendations: buildRecommendations(byId, risk, metabolicRisk, vascularRisk, scenario, imaging)
  };
}

function buildLesions(byId, scenario) {
  const lesions = [];
  if (scenario.disease === "diabetes" || byId.glucose.value >= 126 || byId.hba1c.value >= 5.7) {
    lesions.push({ id: "pancreas-stress", type: "diabetes", label: "إجهاد البنكرياس", severity: clamp((byId.glucose.value - 110) / 110, 0.18, 1), position: [-0.04, 0.66, 0.13], color: "#f4b740" });
    lesions.push({ id: "glucose-field", type: "glucose", label: "ارتفاع السكر حول الأوعية", severity: clamp((byId.glucose.value - 110) / 120, 0.12, 1), position: [0, 0.55, 0.08], color: "#ffd166" });
  }
  if (scenario.disease === "hypertension" || byId.systolic.value >= 130 || byId.vascularStiffness.value >= 45) {
    lesions.push({ id: "arterial-pressure", type: "hypertension", label: "ضغط عال على الشرايين", severity: clamp((byId.systolic.value - 120) / 75, 0.18, 1), position: [0, 1.1, 0.1], color: "#ef4b5f" });
  }
  if (scenario.disease === "thrombosis" || byId.clotRisk.value >= 35 || byId.dDimer.value >= 500) {
    lesions.push({ id: "leg-thrombus", type: "clot", label: "خثرة محاكاة في وريد الساق", severity: clamp(byId.clotRisk.value / 100, 0.2, 1), position: [-0.18, -1.58, 0.02], color: "#6f1d1b" });
    if (byId.oxygen.value < 95) lesions.push({ id: "lung-risk", type: "lung-clot", label: "تنبيه رئوي محاكى", severity: clamp((96 - byId.oxygen.value) / 10, 0.1, 1), position: [0.22, 1.42, 0.08], color: "#ff7b7b" });
  }
  if (scenario.disease === "stroke" || byId.neuroPerfusion.value <= 85) {
    lesions.push({ id: "brain-perfusion", type: "stroke", label: "نقص تروية دماغي محاكى", severity: clamp((95 - byId.neuroPerfusion.value) / 35, 0.16, 1), position: [0, 2.48, 0.04], color: "#a78bfa" });
    lesions.push({ id: "carotid-plaque", type: "carotid", label: "إجهاد الشريان السباتي", severity: clamp((byId.ldl.value - 110) / 120, 0.12, 1), position: [-0.08, 2.24, 0.03], color: "#ffbe55" });
  }
  if (byId.egfr.value <= 75 || ["diabetes", "hypertension", "metabolic"].includes(scenario.disease)) {
    lesions.push({ id: "kidney-stress", type: "kidney", label: "ضغط على الكلى", severity: clamp((95 - byId.egfr.value) / 55, 0.1, 1), position: [-0.28, 0.34, -0.08], color: "#c084fc" });
  }
  return lesions;
}

function buildInterventionOptions() {
  return Object.entries(interventions).map(([id, value]) => ({
    id,
    label: value.label,
    description: value.description,
    active: id === activeIntervention
  }));
}

async function registerImagingStudy(upload = {}) {
  const analysis = await analyzeImagingUpload(upload);
  const modality = imagingModalities[analysis.modality] || imagingModalities.xray;
  const region = imagingRegions[analysis.region] || imagingRegions.wholeBody;
  const organ = imagingOrgans[analysis.organ] || imagingOrgans.unknown;
  const fileSize = clamp(Number(upload.fileSize || 0), 0, 12 * 1024 * 1024);
  const qualityScore = clamp(Math.round(Number(analysis.qualityScore || estimateImagingQuality(upload, fileSize))), 35, 95);
  const confidence = clamp(Math.round(Number(analysis.confidence || 58 + modality.weight * 1.8 + qualityScore * 0.24)), 45, 96);
  const affectedSystems = [...new Set([organ.id, ...region.systems].filter((item) => item && item !== "unknown"))];
  const study = {
    id: `IMG-${Date.now().toString(36).toUpperCase()}`,
    modality: modality.id,
    modalityLabel: modality.label,
    region: region.id,
    regionLabel: region.label,
    detectedOrgan: organ.id,
    detectedOrganLabel: organ.label,
    fileName: sanitizeFileName(upload.fileName || `${modality.label}-image`),
    fileType: String(upload.fileType || "image/medical"),
    fileSize,
    qualityScore,
    confidence,
    analysisSource: analysis.source,
    affectedSystems,
    finding: analysis.finding || buildImagingFinding(modality, region, organ, qualityScore, analysis.source),
    modelImpact: `رفع موثوقية التوأم الرقمي عبر تحليل ${modality.label} لمنطقة ${region.label} وربطها بعضو ${organ.label}.`,
    aiReason: analysis.reason || "",
    createdAt: new Date().toISOString()
  };
  imagingStudies = [study, ...imagingStudies].slice(0, 6);
  return study;
}

async function analyzeImagingUpload(upload = {}) {
  const openAiAnalysis = await classifyImagingWithOpenAi(upload);
  if (openAiAnalysis) return openAiAnalysis;
  return inferImagingLocally(upload);
}

async function classifyImagingWithOpenAi(upload = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const imageData = typeof upload.imageData === "string" ? upload.imageData : "";
  if (!apiKey || !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageData)) return null;

  const model = (process.env.OPENAI_MODEL || defaultOpenAiModel).trim() || defaultOpenAiModel;
  const timeoutMs = clamp(Number(process.env.OPENAI_TIMEOUT_MS || 15000), 3000, 30000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You classify medical imaging screenshots for a non-diagnostic digital-twin demo. Return valid JSON only. Do not diagnose disease. Choose modality from: ct, mri, xray, ultrasound. Choose region from: brain, chest, abdomen, pelvis, vascular, wholeBody. Choose organ from: brain, lungs, heart, liver, stomach, pancreas, kidneys, bladder, intestines, vessels, bones, unknown. Provide Arabic finding and reason. Keys: modality, region, organ, confidence, qualityScore, finding, reason."
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  fileName: sanitizeFileName(upload.fileName || "medical-image"),
                  fileType: upload.fileType || "image/medical",
                  instruction: "حدد نوع الصورة والمنطقة والعضو المرتبط بها فقط، بدون تشخيص."
                })
              },
              { type: "input_image", image_url: imageData }
            ]
          }
        ]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.output_text || extractResponseText(data);
    if (!text) return null;
    return normalizeImagingAnalysis(parseAiJson(text), "openai", upload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeImagingAnalysis(parsed = {}, source, upload = {}) {
  const inferred = inferImagingLocally(upload);
  const modality = imagingModalities[parsed.modality] ? parsed.modality : inferred.modality;
  const organ = imagingOrgans[parsed.organ] ? parsed.organ : inferred.organ;
  const regionFromOrgan = imagingOrgans[organ]?.region;
  const region = imagingRegions[parsed.region] ? parsed.region : regionFromOrgan || inferred.region;
  const confidenceValue = Number(parsed.confidence);
  const confidence = confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue;
  return {
    source,
    modality,
    region,
    organ,
    confidence: clamp(Math.round(confidence || inferred.confidence), 45, 96),
    qualityScore: clamp(Math.round(Number(parsed.qualityScore || inferred.qualityScore)), 35, 95),
    finding:
      typeof parsed.finding === "string" && parsed.finding.trim()
        ? parsed.finding.trim().slice(0, 260)
        : "",
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, 220)
        : ""
  };
}

function inferImagingLocally(upload = {}) {
  const text = `${upload.fileName || ""} ${upload.fileType || ""}`.toLowerCase();
  const modality = /mri|magnetic|رنين/.test(text)
    ? "mri"
    : /ct|computed|scan|مقط/.test(text)
      ? "ct"
      : /ultra|usg|sonar|سونار|موجات/.test(text)
        ? "ultrasound"
        : /xray|x-ray|ray|اشع|أشع/.test(text)
          ? "xray"
          : "xray";
  const organ = /brain|head|دماغ|راس|رأس/.test(text)
    ? "brain"
    : /lung|chest|صدر|رئ/.test(text)
      ? "lungs"
      : /heart|cardio|قلب/.test(text)
        ? "heart"
        : /kidney|renal|كلى|كلية/.test(text)
          ? "kidneys"
          : /bladder|مثان/.test(text)
            ? "bladder"
            : /liver|كبد/.test(text)
              ? "liver"
              : /pancreas|بنكرياس/.test(text)
                ? "pancreas"
                : /abdomen|بطن|stomach|معدة/.test(text)
                  ? "stomach"
                  : /vessel|vascular|doppler|وع/.test(text)
                    ? "vessels"
                    : "unknown";
  const region = imagingOrgans[organ]?.region || "wholeBody";
  const fileSize = clamp(Number(upload.fileSize || 0), 0, 12 * 1024 * 1024);
  return {
    source: "local-fallback",
    modality,
    region,
    organ,
    confidence: organ === "unknown" ? 52 : 62,
    qualityScore: estimateImagingQuality(upload, fileSize),
    finding: "",
    reason: "تم الاستدلال محليًا لأن تحليل OpenAI للصورة غير متاح."
  };
}

function buildImagingSummary() {
  const studies = imagingStudies.slice(0, 6);
  const qualityAverage = studies.length
    ? Math.round(studies.reduce((sum, study) => sum + study.qualityScore, 0) / studies.length)
    : 0;
  const modelConfidence = studies.length ? clamp(72 + studies.length * 4 + Math.round(qualityAverage * 0.14), 72, 96) : 72;
  const coveredSystems = [...new Set(studies.flatMap((study) => study.affectedSystems))];
  return {
    acceptedModalities: Object.values(imagingModalities).map((item) => item.label),
    studies,
    latest: studies[0] || null,
    count: studies.length,
    qualityAverage,
    modelConfidence,
    coveredSystems,
    note: studies.length
      ? ""
      : "لم تتم إضافة صور أشعة بعد. ارفع صورة CT أو MRI أو X-Ray أو Ultrasound وسيحدد الذكاء الاصطناعي النوع والمنطقة تلقائيًا."
  };
}

function estimateImagingQuality(upload, fileSize) {
  const hasImagePayload = typeof upload.imageData === "string" && upload.imageData.startsWith("data:");
  const sizeScore = fileSize >= 500000 ? 30 : fileSize >= 120000 ? 22 : fileSize > 0 ? 14 : 8;
  const typeScore = /^image\//i.test(String(upload.fileType || "")) || /\.dcm$/i.test(String(upload.fileName || "")) ? 24 : 14;
  const payloadScore = hasImagePayload ? 18 : 6;
  return clamp(sizeScore + typeScore + payloadScore + 18, 35, 95);
}

function buildImagingFinding(modality, region, organ, qualityScore, source = "local-fallback") {
  const qualityLabel = qualityScore >= 78 ? "جودة عالية" : qualityScore >= 58 ? "جودة متوسطة" : "جودة محدودة";
  const sourceLabel = source === "openai" ? "OpenAI" : "تحليل محلي مبدئي";
  return `${qualityLabel}: حدد ${sourceLabel} أن الصورة أقرب إلى ${modality.label} لمنطقة ${region.label} وعضو ${organ.label} لتقوية مطابقة الأعضاء والمؤشرات داخل النموذج.`;
}

function sanitizeFileName(name) {
  return String(name).replace(/[^\p{L}\p{N}._ -]/gu, "").trim().slice(0, 96) || "medical-image";
}

function buildEvents(alerts, scenario, intervention, imaging) {
  const scenarioEvent = {
    level: "info",
    title: scenario.label,
    message: scenario.description,
    timestamp: new Date(scenarioUpdatedAt).toISOString()
  };
  const interventionEvent = {
    level: activeIntervention === "observe" ? "info" : "watch",
    title: `تدخل محاكى: ${intervention.label}`,
    message: intervention.description,
    timestamp: new Date(interventionUpdatedAt).toISOString()
  };
  const imagingEvent = imaging?.latest
    ? {
        level: "watch",
        title: `دليل تصوير: ${imaging.latest.modalityLabel}`,
        message: `${imaging.latest.regionLabel} · ${imaging.latest.detectedOrganLabel || "عضو غير محدد"} · ثقة ${imaging.latest.confidence}% · ${imaging.latest.fileName}`,
        timestamp: imaging.latest.createdAt
      }
    : null;
  const alertEvents = alerts.map((sensor, index) => ({
    level: sensor.status,
    title: sensor.status === "critical" ? "إنذار حرج" : "تنبيه",
    message: `${sensor.name}: ${sensor.value} ${sensor.unit}`,
    timestamp: new Date(Date.now() - (index + 1) * 45000).toISOString()
  }));
  return [scenarioEvent, interventionEvent, imagingEvent, ...alertEvents].filter(Boolean).slice(0, 8);
}

function buildPrediction(byId, risk, metabolicRisk, vascularRisk, scenario, imaging) {
  const diabetesProbability = clamp(Number(((metabolicRisk / 100) * 0.72 + (byId.hba1c.value >= 6.5 ? 0.18 : 0.03)).toFixed(2)), 0.03, 0.96);
  const hypertensionProbability = clamp(Number(((vascularRisk / 100) * 0.62 + (byId.systolic.value >= 140 ? 0.18 : 0.04)).toFixed(2)), 0.03, 0.96);
  const clotProbability = clamp(Number((byId.clotRisk.value * 0.009 + (byId.dDimer.value >= 500 ? 0.18 : 0.03) + (scenario.disease === "thrombosis" ? 0.2 : 0)).toFixed(2)), 0.03, 0.96);
  const strokeSignalProbability = clamp(Number(((100 - byId.neuroPerfusion.value) * 0.018 + vascularRisk * 0.004 + (scenario.disease === "stroke" ? 0.22 : 0.02)).toFixed(2)), 0.03, 0.94);
  return {
    riskAfter30Min: clamp(Math.round(risk + (byId.neuroPerfusion.value < 80 ? 12 : 2) + (byId.clotRisk.value > 65 ? 10 : 0)), 0, 100),
    diabetesProbability,
    hypertensionProbability,
    clotProbability,
    strokeSignalProbability,
    modelConfidence: imaging?.modelConfidence || 72,
    suggestedMonitoring: risk >= 70 ? "مراقبة محاكاة دقيقة كل دقيقة" : risk >= 40 ? "مراقبة نشطة كل 5 دقائق" : "مراقبة روتينية"
  };
}

function buildRecommendations(byId, risk, metabolicRisk, vascularRisk, scenario, imaging) {
  const recs = ["استخدم النتائج كمؤشرات مساندة للقرار ولا تعتمد عليها وحدها لتشخيص أو علاج حالة حقيقية."];
  if (!imaging?.count) {
    recs.push("يمكن رفع صور CT أو MRI أو X-Ray أو Ultrasound لإضافة دليل تصوير يرفع موثوقية التوأم الرقمي.");
  } else {
    recs.push(`آخر دليل تصوير: ${imaging.latest.modalityLabel} لمنطقة ${imaging.latest.regionLabel} رفع موثوقية النموذج إلى ${imaging.modelConfidence}%.`);
  }
  if (scenario.disease === "diabetes" || metabolicRisk >= 55) {
    recs.push("ارتفاع السكر أو السكر التراكمي في الواقع يحتاج تأكيدًا بفحوصات مخبرية ومراجعة مختص.");
    recs.push("في المحاكاة: جرّب تدخل ضبط السكر أو نمط الحياة ولاحظ أثره على البنكرياس والكلى.");
  }
  if (scenario.disease === "hypertension" || byId.systolic.value >= 130 || vascularRisk >= 55) {
    recs.push("ارتفاع الضغط عامل خطر مهم للقلب والسكتة، ويحتاج قياسات متكررة وتقييمًا طبيًا في الواقع.");
    recs.push("في المحاكاة: جرّب ضبط الضغط ولاحظ تغير تروية الدماغ والكلى.");
  }
  if (scenario.disease === "thrombosis" || byId.clotRisk.value >= 35) {
    recs.push("علامات الجلطة الحقيقية مثل تورم/ألم ساق مفاجئ أو ضيق نفس تستدعي رعاية طبية عاجلة.");
    recs.push("في المحاكاة: جرّب مسار الجلطات وشاهد أثره على تدفق الساق والأكسجة.");
  }
  if (scenario.disease === "stroke" || byId.neuroPerfusion.value <= 85) {
    recs.push("علامات السكتة مثل ضعف الوجه أو الذراع أو اضطراب الكلام حالة طارئة وليست مجالًا للتجربة.");
  }
  if (risk < 35) recs.push("الحالة مستقرة في النموذج. انتقل إلى سيناريو السكري أو الضغط أو الجلطات لرؤية استجابة الجسم.");
  return recs.slice(0, 6);
}

function localBodyAnalyst(question, state) {
  const focus = inferFocus(question);
  const careFocus = focus === "general" ? inferFocusFromState(state) : focus;
  const carePathway = isCarePathwayQuestion(question) ? buildCarePathway(careFocus, state) : null;
  const alerts = state.sensors.filter((sensor) => sensor.status !== "normal");
  const strongest = alerts[0] || state.sensors.find((sensor) => sensor.id === "glucose");
  const intro =
    state.summary.risk >= 70
      ? "المحاكاة تعرض حالة عالية الخطورة."
      : state.summary.risk >= 40
        ? "المحاكاة تعرض حالة متوسطة الخطورة."
        : "المحاكاة تعرض حالة مستقرة نسبيًا.";

  const focusLine = buildFocusLine(focus, state, strongest);
  const answer = [
    intro,
    `السيناريو الحالي: ${state.scenario.label}. مؤشر الصحة ${state.summary.health}% ومؤشر المخاطر ${state.summary.risk}%.`,
    focusLine,
    carePathway?.answer || state.recommendations[1] || state.recommendations[0],
    "تنبيه: هذه مخرجات محاكاة بحثية داعمة للتحليل ولا تمثل قرارًا علاجيًا نهائيًا دون اعتماد مختص."
  ].join(" ");

  return {
    source: "local-ai",
    answer,
    confidence: state.summary.risk >= 70 ? 0.85 : 0.77,
    severity: state.summary.risk >= 70 ? "critical" : state.summary.risk >= 40 ? "watch" : "stable",
    actions: carePathway?.actions || state.recommendations.slice(0, 3),
    evidence: [
      `موثوقية النموذج: ${state.summary.modelConfidence}%`,
      state.imaging.latest ? `آخر تصوير: ${state.imaging.latest.modalityLabel} - ${state.imaging.latest.regionLabel}` : "لا توجد صور أشعة مرفوعة بعد",
      `سكر الدم: ${state.summary.glucose} mg/dL`,
      `ضغط الدم: ${state.summary.bloodPressure} mmHg`,
      `قابلية التخثر: ${state.summary.clotRisk}%`,
      `تروية الدماغ: ${state.summary.neuroPerfusion}%`
    ]
  };
}

function isCarePathwayQuestion(question = "") {
  return /علاج|علاجي|الإجراء|اجراء|خطة|تدخل|تصرف|care|treatment|procedure|management|therapy/i.test(question);
}

function inferFocusFromState(state) {
  if (state.scenario?.disease === "thrombosis" || state.summary.clotRisk >= 35 || state.summary.dDimer >= 500) return "clot";
  if (state.scenario?.disease === "stroke" || state.summary.neuroPerfusion <= 85) return "stroke";
  if (state.scenario?.disease === "hypertension" || Number(String(state.summary.bloodPressure).split("/")[0]) >= 130) return "pressure";
  if (state.scenario?.disease === "diabetes" || state.summary.glucose >= 126 || state.summary.hba1c >= 5.7) return "diabetes";
  return "general";
}

function buildCarePathway(focus, state) {
  const emergencyPrefix =
    state.summary.risk >= 70
      ? "بما أن المؤشرات في المحاكاة عالية الخطورة، فالمسار الآمن يكون بتقييم طبي عاجل."
      : "الإجراء يعتمد على الفحص السريري والتصوير والتحاليل، وليس على الديمو وحده.";

  if (focus === "clot") {
    return {
      answer:
        `${emergencyPrefix} في مسار الجلطات المحتمل: يتم تقييم أعراض مثل تورم أو ألم الساق أو ضيق النفس، ثم قد يطلب الطبيب فحص دوبلر للأوردة أو CT للرئة مع D-dimer وتحاليل التخثر. إذا تأكدت جلطة، فالخيارات التي يناقشها الفريق الطبي قد تشمل مضادات التخثر، أو إذابة/قسطرة للجلطة في الحالات الشديدة، مع أكسجين ومراقبة عند وجود نقص أكسجة. لا يبدأ أي دواء أو جرعة بدون طبيب.`,
      actions: [
        "إذا ظهر ضيق نفس، ألم صدر، إغماء، أو تورم ساق مفاجئ: التوجه للطوارئ فورًا.",
        "طلب تقييم طبي مع فحص دوبلر/CT حسب مكان الاشتباه وتحاليل التخثر.",
        "مناقشة مضادات التخثر أو القسطرة/إذابة الجلطة فقط إذا أكد الطبيب التشخيص."
      ]
    };
  }

  if (focus === "stroke") {
    return {
      answer:
        `${emergencyPrefix} في مسار السكتة المحتملة: أي ضعف مفاجئ في الوجه أو الذراع، اضطراب الكلام، صداع شديد مفاجئ، أو تشوش رؤية يستدعي الطوارئ. الإجراء الطبي يبدأ بتحديد وقت بداية الأعراض، CT أو MRI للدماغ، فحوصات سكر وضغط وتخثر، ثم قد يناقش الفريق الطبي إذابة جلطة أو قسطرة إزالة الخثرة إذا كانت الحالة مناسبة زمنياً وطبيًا.`,
      actions: [
        "عند أعراض سكتة مفاجئة: الاتصال بالإسعاف فورًا وعدم الانتظار.",
        "تحديد وقت بداية الأعراض وتجهيز الأدوية/الأمراض السابقة للطبيب.",
        "التقييم بالتصوير CT/MRI قبل أي قرار علاجي."
      ]
    };
  }

  if (focus === "pressure") {
    return {
      answer:
        `${emergencyPrefix} في مسار ارتفاع الضغط: يعاد القياس بطريقة صحيحة، وتراجع الأعراض المصاحبة مثل ألم الصدر أو ضيق النفس أو ضعف عصبي. إذا كان الضغط شديدًا أو معه أعراض، فالتقييم العاجل مهم. الطبيب قد يناقش أدوية خفض الضغط، تحاليل كلى وأملاح، وتخطيط قلب، مع متابعة نمط الحياة حسب الحالة.`,
      actions: [
        "إعادة قياس الضغط بعد راحة وبوضعية صحيحة.",
        "الطوارئ عند ألم صدر، ضيق نفس، ضعف عصبي، أو قراءات شديدة جدًا.",
        "مراجعة الطبيب لاختيار أدوية وفحوصات مناسبة دون بدء علاج عشوائي."
      ]
    };
  }

  if (focus === "diabetes") {
    return {
      answer:
        `${emergencyPrefix} في مسار ارتفاع السكر: يتم تأكيد القراءة، مراجعة الأعراض مثل عطش شديد أو قيء أو خمول، وفحص الكيتونات عند الارتفاع الشديد. الطبيب قد يناقش تعديل الخطة الغذائية والدوائية أو الإنسولين حسب الحالة والتحاليل، مع متابعة HbA1c ووظائف الكلى.`,
      actions: [
        "تأكيد قراءة السكر ومراجعة الأعراض العامة.",
        "التقييم العاجل عند قيء، خمول شديد، تنفس غير طبيعي، أو سكر مرتفع جدًا.",
        "مراجعة الطبيب لتعديل الخطة العلاجية بناءً على التحاليل."
      ]
    };
  }

  return {
    answer:
      `${emergencyPrefix} المسار العام يكون: تحديد الأعراض، قياس العلامات الحيوية، مراجعة صور الأشعة والتحاليل، ثم اختيار التدخل المناسب بواسطة الطبيب. النموذج البحثي يساعد على ترتيب الأولويات ومحاكاة مسارات القرار ولا يحدد علاجًا شخصيًا بذاته.`,
    actions: [
      "حدد العرض الأساسي ومدة بدايته.",
      "اربط المؤشرات الحيوية بنتائج الأشعة والتحاليل.",
      "راجع الطبيب لاختيار الإجراء العلاجي المناسب."
    ]
  };
}

function withCarePathwayIfRequested(analysis, question, state) {
  if (!analysis || !isCarePathwayQuestion(question)) return analysis;
  const focus = inferFocus(question);
  const careFocus = focus === "general" ? inferFocusFromState(state) : focus;
  const carePathway = buildCarePathway(careFocus, state);
  const alreadySpecific = /دوبلر|قسطرة|مضادات التخثر|CT|MRI|الطوارئ|إذابة/i.test(analysis.answer || "");
  return {
    ...analysis,
    answer: alreadySpecific ? analysis.answer : `${analysis.answer} ${carePathway.answer}`,
    actions: uniqueStrings([...(analysis.actions || []), ...carePathway.actions]).slice(0, 5),
    evidence: analysis.evidence || []
  };
}

function uniqueStrings(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (typeof item !== "string" || !item.trim()) return false;
    const key = item.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFocusLine(focus, state, strongest) {
  if (focus === "diabetes") return `خطر السكري المحاكى ${Math.round(state.prediction.diabetesProbability * 100)}%، مع سكر دم ${state.summary.glucose} mg/dL وسكر تراكمي ${state.summary.hba1c}%.`;
  if (focus === "pressure") return `خطر الضغط المحاكى ${Math.round(state.prediction.hypertensionProbability * 100)}%، والضغط الحالي ${state.summary.bloodPressure} mmHg.`;
  if (focus === "clot") return `خطر الجلطة المحاكى ${Math.round(state.prediction.clotProbability * 100)}%، مع قابلية تخثر ${state.summary.clotRisk}% وD-dimer ${state.summary.dDimer}.`;
  if (focus === "stroke") return `خطر إشارات السكتة المحاكى ${Math.round(state.prediction.strokeSignalProbability * 100)}%، وتروية الدماغ ${state.summary.neuroPerfusion}%.`;
  return `أبرز مؤشر يستحق الانتباه الآن: ${strongest.name} بقيمة ${strongest.value} ${strongest.unit}.`;
}

function inferFocus(question = "") {
  if (/سكر|سكري|جلوكوز|diabetes|glucose|hba1c/i.test(question)) return "diabetes";
  if (/ضغط|hypertension|pressure|blood pressure/i.test(question)) return "pressure";
  if (/جلط|خثر|تخثر|clot|thrombus|dvt/i.test(question)) return "clot";
  if (/سكت|دماغ|stroke|brain/i.test(question)) return "stroke";
  return "general";
}

async function openAiBodyAnalyst(question, state) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = (process.env.OPENAI_MODEL || defaultOpenAiModel).trim() || defaultOpenAiModel;
  const timeoutMs = clamp(Number(process.env.OPENAI_TIMEOUT_MS || 15000), 3000, 30000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are an Arabic human-body digital twin clinical decision-support analyst. Analyze the simulated sensor values, organs, scenario, intervention, trend, risk predictions, and imaging evidence. Do not provide a diagnosis, prescription, medication dose, or personalized treatment plan. If the user asks about العلاج, الإجراء العلاجي, treatment, procedure, or management, answer with a practical care pathway: urgent red flags, likely clinical assessments, imaging/labs a clinician may request, and possible clinician-supervised options. Never tell the user to start/stop a medicine. If values look urgent, clearly advise seeking emergency or real medical care. Return valid JSON only with keys: answer, severity, confidence, actions, evidence. The answer key is required and must contain a complete Arabic paragraph. severity must be stable, watch, or critical. confidence must be a number from 0 to 1. Keep answer and lists in Arabic."
          },
          { role: "user", content: JSON.stringify({ question, state: buildOpenAiContext(state) }) }
        ]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.output_text || extractResponseText(data);
    if (!text) return null;
    return normalizeOpenAiAnalysis(parseAiJson(text), model);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAiContext(state) {
  const keySensorIds = [
    "glucose",
    "hba1c",
    "insulinResistance",
    "systolic",
    "diastolic",
    "heartRate",
    "oxygen",
    "ldl",
    "triglycerides",
    "bmi",
    "clotRisk",
    "dDimer",
    "splenicPerfusion",
    "spleenSize",
    "plateletCount",
    "legFlow",
    "egfr",
    "neuroPerfusion",
    "vascularStiffness",
    "inflammation",
    "painScore"
  ];
  const sensorsById = new Map(state.sensors.map((sensor) => [sensor.id, sensor]));
  const keySensors = keySensorIds.map((id) => sensorsById.get(id)).filter(Boolean).map(formatSensorForAi);
  const activeAlerts = state.sensors
    .filter((sensor) => sensor.status !== "normal")
    .sort((a, b) => severityRank(b.status) - severityRank(a.status))
    .slice(0, 8)
    .map(formatSensorForAi);

  return {
    scenario: pickFields(state.scenario, ["label", "shortLabel", "description", "disease", "severity"]),
    intervention: pickFields(state.intervention, ["label", "description"]),
    summary: state.summary,
    prediction: state.prediction,
    imaging: {
      count: state.imaging.count,
      modelConfidence: state.imaging.modelConfidence,
      latest: state.imaging.latest
        ? pickFields(state.imaging.latest, ["modalityLabel", "regionLabel", "detectedOrganLabel", "confidence", "analysisSource", "finding", "modelImpact"])
        : null,
      coveredSystems: state.imaging.coveredSystems
    },
    keySensors,
    activeAlerts,
    organFindings: state.lesions.map((lesion) => pickFields(lesion, ["id", "type", "label", "severity"])),
    recentEvents: state.events.map((event) => pickFields(event, ["level", "title", "message"])),
    recommendations: state.recommendations
  };
}

function formatSensorForAi(sensor) {
  return pickFields(sensor, ["id", "name", "value", "unit", "status", "trend", "zone"]);
}

function pickFields(source, fields) {
  const picked = {};
  for (const field of fields) {
    if (source && source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
}

function severityRank(status) {
  if (status === "critical") return 3;
  if (status === "warning") return 2;
  return 1;
}

function parseAiJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("OpenAI response was not JSON");
  }
}

function normalizeOpenAiAnalysis(parsed, model) {
  const severity = ["stable", "watch", "critical"].includes(parsed.severity) ? parsed.severity : "watch";
  const actions = toStringList(parsed.actions).slice(0, 5);
  const evidence = toStringList(parsed.evidence).slice(0, 6);
  const answer =
    typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : buildOpenAiFallbackAnswer(actions, evidence);
  return {
    source: "openai",
    model,
    answer,
    confidence: clamp(Number(parsed.confidence || 0.8), 0, 1),
    severity,
    actions,
    evidence
  };
}

function buildOpenAiFallbackAnswer(actions, evidence) {
  const evidenceLine = evidence.length
    ? `تم تحليل المؤشرات، وأبرز الدلائل: ${evidence.slice(0, 3).join("، ")}.`
    : "تم تحليل المؤشرات الحيوية والسيناريو الحالي.";
  const actionLine = actions.length
    ? `الخطوة المقترحة: ${actions[0]}`
    : "يوصى بمراجعة مسار الرعاية المناسب وربط المؤشرات بنتائج الفحص والتصوير.";
  return `${evidenceLine} ${actionLine}`;
}

function toStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function extractResponseText(data) {
  const chunks = [];
  for (const output of data.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

async function readJsonBody(request, maxBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Payload too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contents = await readFile(filePath);
  const noStore = [".html", ".js", ".css"].includes(ext);
  response.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": noStore ? "no-store" : "public, max-age=3600"
  });
  response.end(contents);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/twin") {
      sendJson(response, 200, buildTwinState());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/scenarios") {
      sendJson(response, 200, scenarios);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/interventions") {
      sendJson(response, 200, interventions);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/twin/simulate") {
      const body = await readJsonBody(request);
      if (!scenarios[body.scenario]) {
        sendJson(response, 400, { error: "Unknown scenario", scenarios: Object.keys(scenarios) });
        return;
      }
      activeScenario = body.scenario;
      activeIntervention = "observe";
      scenarioUpdatedAt = Date.now();
      interventionUpdatedAt = Date.now();
      sendJson(response, 200, buildTwinState());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/twin/intervene") {
      const body = await readJsonBody(request);
      if (!interventions[body.intervention]) {
        sendJson(response, 400, { error: "Unknown intervention", interventions: Object.keys(interventions) });
        return;
      }
      activeIntervention = body.intervention;
      interventionUpdatedAt = Date.now();
      sendJson(response, 200, buildTwinState());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/imaging/upload") {
      const body = await readJsonBody(request, 8 * 1024 * 1024);
      if (!body.fileName && !body.imageData) {
        sendJson(response, 400, { error: "Missing imaging file" });
        return;
      }
      await registerImagingStudy(body);
      sendJson(response, 200, buildTwinState());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/imaging/clear") {
      imagingStudies = [];
      sendJson(response, 200, buildTwinState());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/ai/ask") {
      const body = await readJsonBody(request);
      const state = buildTwinState();
      const question = String(body.question || "حلل حالة التوأم الرقمي للجسم الآن.");
      const aiAnswer = await openAiBodyAnalyst(question, state);
      sendJson(response, 200, withCarePathwayIfRequested(aiAnswer, question, state) || localBodyAnalyst(question, state));
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: "Server error", detail: error.message });
  }
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Digital Body Twin demo running at http://${displayHost}:${port}`);
});
