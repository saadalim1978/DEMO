import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4321);
const host = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");

let activeScenario = "baseline";
let activeIntervention = "observe";
let scenarioUpdatedAt = Date.now();
let interventionUpdatedAt = Date.now();

const scenarios = {
  baseline: {
    label: "جسم مستقر",
    shortLabel: "مستقر",
    description: "محاكاة تعليمية لجسم افتراضي بمؤشرات أيضية ووعائية ضمن النطاق.",
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
      inflammation: -1.1
    }
  }
};

const sensorTemplates = [
  { id: "glucose", name: "سكر الدم", metric: "glucose", unit: "mg/dL", base: 96, amplitude: 7, decimals: 0, phase: 0.6, zone: "البنكرياس", position: [-0.28, 0.95, 0.48], warningHigh: 126, criticalHigh: 180, warningLow: 70, criticalLow: 55 },
  { id: "hba1c", name: "السكر التراكمي", metric: "hba1c", unit: "%", base: 5.3, amplitude: 0.08, decimals: 1, phase: 2.3, zone: "الأيض", position: [-0.62, 0.82, 0.5], warningHigh: 5.7, criticalHigh: 6.5 },
  { id: "insulinResistance", name: "مقاومة الإنسولين", metric: "insulinResistance", unit: "%", base: 18, amplitude: 3, decimals: 0, phase: 1.2, zone: "الأيض", position: [0.28, 0.9, 0.5], warningHigh: 45, criticalHigh: 70 },
  { id: "systolic", name: "ضغط الدم الانقباضي", metric: "systolic", unit: "mmHg", base: 118, amplitude: 5, decimals: 0, phase: 1.8, zone: "الأوعية", position: [0.0, 1.6, 0.62], warningHigh: 130, criticalHigh: 180, warningLow: 90, criticalLow: 75 },
  { id: "diastolic", name: "ضغط الدم الانبساطي", metric: "diastolic", unit: "mmHg", base: 76, amplitude: 3, decimals: 0, phase: 2.8, zone: "الأوعية", position: [0.22, 1.35, 0.62], warningHigh: 80, criticalHigh: 120, warningLow: 55, criticalLow: 45 },
  { id: "heartRate", name: "معدل النبض", metric: "heartRate", unit: "bpm", base: 72, amplitude: 4, decimals: 0, phase: 0.4, zone: "القلب", position: [-0.18, 1.45, 0.72], warningHigh: 110, criticalHigh: 140, warningLow: 50, criticalLow: 38 },
  { id: "oxygen", name: "تشبع الأكسجين", metric: "oxygen", unit: "%", base: 98, amplitude: 0.8, decimals: 0, phase: 3.1, zone: "الرئتان", position: [0.48, 1.65, 0.45], warningLow: 94, criticalLow: 90 },
  { id: "ldl", name: "LDL كوليسترول", metric: "ldl", unit: "mg/dL", base: 96, amplitude: 8, decimals: 0, phase: 4.2, zone: "الدهون", position: [0.72, 0.68, 0.34], warningHigh: 130, criticalHigh: 190 },
  { id: "triglycerides", name: "الدهون الثلاثية", metric: "triglycerides", unit: "mg/dL", base: 118, amplitude: 12, decimals: 0, phase: 1.7, zone: "الدهون", position: [0.55, 0.48, 0.38], warningHigh: 150, criticalHigh: 300 },
  { id: "bmi", name: "مؤشر كتلة الجسم", metric: "bmi", unit: "BMI", base: 25, amplitude: 0.4, decimals: 1, phase: 3.6, zone: "الجسم", position: [0.0, 0.25, 0.6], warningHigh: 30, criticalHigh: 40 },
  { id: "clotRisk", name: "قابلية التخثر", metric: "clotRisk", unit: "%", base: 16, amplitude: 3, decimals: 0, phase: 2.1, zone: "الأوردة", position: [-0.42, -1.0, 0.36], warningHigh: 35, criticalHigh: 65 },
  { id: "dDimer", name: "D-dimer محاكى", metric: "dDimer", unit: "ng/mL", base: 260, amplitude: 42, decimals: 0, phase: 4.5, zone: "التخثر", position: [-0.62, -1.42, 0.28], warningHigh: 500, criticalHigh: 1000 },
  { id: "legFlow", name: "تدفق أوردة الساق", metric: "legFlow", unit: "%", base: 96, amplitude: 3, decimals: 0, phase: 0.9, zone: "الساق", position: [-0.52, -1.78, 0.2], warningLow: 70, criticalLow: 45 },
  { id: "egfr", name: "وظائف الكلى eGFR", metric: "egfr", unit: "mL/min", base: 98, amplitude: 3, decimals: 0, phase: 2.6, zone: "الكلى", position: [-0.5, 0.34, 0.28], warningLow: 60, criticalLow: 30 },
  { id: "neuroPerfusion", name: "تروية الدماغ", metric: "neuroPerfusion", unit: "%", base: 98, amplitude: 2, decimals: 0, phase: 1.4, zone: "الدماغ", position: [0.0, 2.96, 0.08], warningLow: 85, criticalLow: 70 },
  { id: "vascularStiffness", name: "تيبس الأوعية", metric: "vascularStiffness", unit: "%", base: 18, amplitude: 3, decimals: 0, phase: 5.1, zone: "الأوعية", position: [0.36, 1.02, 0.58], warningHigh: 45, criticalHigh: 70 },
  { id: "inflammation", name: "التهاب CRP", metric: "inflammation", unit: "mg/L", base: 1.1, amplitude: 0.25, decimals: 1, phase: 2.2, zone: "التهاب", position: [0.18, 0.08, 0.48], warningHigh: 3, criticalHigh: 10 },
  { id: "painScore", name: "ألم/تنميل محاكى", metric: "painScore", unit: "/10", base: 0, amplitude: 0.3, decimals: 0, phase: 0.3, zone: "الأعراض", position: [-0.78, -0.7, 0.24], warningHigh: 4, criticalHigh: 7 }
];

const anatomy = [
  { id: "brain", name: "الدماغ", color: "#a78bfa", region: "nervous" },
  { id: "heart", name: "القلب", color: "#ef4b5f", region: "cardio" },
  { id: "lungs", name: "الرئتان", color: "#48c7d8", region: "respiratory" },
  { id: "pancreas", name: "البنكرياس", color: "#f4b740", region: "metabolic" },
  { id: "kidneys", name: "الكلى", color: "#c084fc", region: "renal" },
  { id: "vessels", name: "الأوعية", color: "#ff5d73", region: "vascular" }
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
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
  if (["oxygen", "clotRisk", "legFlow", "neuroPerfusion", "vascularStiffness", "insulinResistance"].includes(template.metric)) value = clamp(value, 0, 100);
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
  const risk = clamp(Math.round(9 + scenario.severity * 42 + sensorRisk), 0, 100);
  const vascularRisk = clamp(Math.round((byId.systolic.value - 100) * 0.55 + byId.ldl.value * 0.18 + byId.clotRisk.value * 0.38 + byId.vascularStiffness.value * 0.5), 0, 100);
  const metabolicRisk = clamp(Math.round((byId.glucose.value - 80) * 0.34 + (byId.hba1c.value - 4.8) * 16 + byId.insulinResistance.value * 0.42 + Math.max(0, byId.bmi.value - 24) * 2.2), 0, 100);
  const perfusionIndex = clamp(Math.round((byId.oxygen.value * 0.34 + byId.neuroPerfusion.value * 0.44 + byId.legFlow.value * 0.22) / 1.0), 0, 100);
  const health = clamp(Math.round(100 - risk * 0.56 - Math.max(0, 94 - byId.oxygen.value) - Math.max(0, 70 - byId.egfr.value) * 0.4), 0, 100);

  return {
    generatedAt: new Date(now).toISOString(),
    disclaimer:
      "هذه محاكاة تعليمية وليست جهازًا طبيًا أو أداة تشخيص. أي أعراض حقيقية مثل ألم صدر، ضيق نفس، علامات سكتة، أو تورم/ألم ساق مفاجئ تحتاج تواصلًا فوريًا مع الطوارئ أو الطبيب.",
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
      subject: "حالة افتراضية تعليمية",
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
      openAlerts: openAlerts.length
    },
    anatomy,
    sensors,
    lesions: buildLesions(byId, scenario),
    interventions: buildInterventionOptions(),
    events: buildEvents(openAlerts, scenario, intervention),
    prediction: buildPrediction(byId, risk, metabolicRisk, vascularRisk, scenario),
    recommendations: buildRecommendations(byId, risk, metabolicRisk, vascularRisk, scenario)
  };
}

function buildLesions(byId, scenario) {
  const lesions = [];
  if (scenario.disease === "diabetes" || byId.glucose.value >= 126 || byId.hba1c.value >= 5.7) {
    lesions.push({ id: "pancreas-stress", type: "diabetes", label: "إجهاد البنكرياس", severity: clamp((byId.glucose.value - 110) / 110, 0.18, 1), position: [-0.28, 0.92, 0.48], color: "#f4b740" });
    lesions.push({ id: "glucose-field", type: "glucose", label: "ارتفاع السكر حول الأوعية", severity: clamp((byId.glucose.value - 110) / 120, 0.12, 1), position: [0.0, 1.0, 0.45], color: "#ffd166" });
  }
  if (scenario.disease === "hypertension" || byId.systolic.value >= 130 || byId.vascularStiffness.value >= 45) {
    lesions.push({ id: "arterial-pressure", type: "hypertension", label: "ضغط عال على الشرايين", severity: clamp((byId.systolic.value - 120) / 75, 0.18, 1), position: [0.0, 1.35, 0.58], color: "#ef4b5f" });
  }
  if (scenario.disease === "thrombosis" || byId.clotRisk.value >= 35 || byId.dDimer.value >= 500) {
    lesions.push({ id: "leg-thrombus", type: "clot", label: "خثرة محاكاة في وريد الساق", severity: clamp(byId.clotRisk.value / 100, 0.2, 1), position: [-0.38, -1.62, 0.2], color: "#6f1d1b" });
    if (byId.oxygen.value < 95) lesions.push({ id: "lung-risk", type: "lung-clot", label: "تنبيه رئوي محاكى", severity: clamp((96 - byId.oxygen.value) / 10, 0.1, 1), position: [0.42, 1.65, 0.42], color: "#ff7b7b" });
  }
  if (scenario.disease === "stroke" || byId.neuroPerfusion.value <= 85) {
    lesions.push({ id: "brain-perfusion", type: "stroke", label: "نقص تروية دماغي محاكى", severity: clamp((95 - byId.neuroPerfusion.value) / 35, 0.16, 1), position: [0.0, 2.96, 0.08], color: "#a78bfa" });
    lesions.push({ id: "carotid-plaque", type: "carotid", label: "إجهاد الشريان السباتي", severity: clamp((byId.ldl.value - 110) / 120, 0.12, 1), position: [-0.18, 2.25, 0.24], color: "#ffbe55" });
  }
  if (byId.egfr.value <= 75 || ["diabetes", "hypertension", "metabolic"].includes(scenario.disease)) {
    lesions.push({ id: "kidney-stress", type: "kidney", label: "ضغط على الكلى", severity: clamp((95 - byId.egfr.value) / 55, 0.1, 1), position: [-0.42, 0.32, 0.28], color: "#c084fc" });
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

function buildEvents(alerts, scenario, intervention) {
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
  const alertEvents = alerts.map((sensor, index) => ({
    level: sensor.status,
    title: sensor.status === "critical" ? "إنذار حرج" : "تنبيه",
    message: `${sensor.name}: ${sensor.value} ${sensor.unit}`,
    timestamp: new Date(Date.now() - (index + 1) * 45000).toISOString()
  }));
  return [scenarioEvent, interventionEvent, ...alertEvents].slice(0, 8);
}

function buildPrediction(byId, risk, metabolicRisk, vascularRisk, scenario) {
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
    suggestedMonitoring: risk >= 70 ? "مراقبة محاكاة دقيقة كل دقيقة" : risk >= 40 ? "مراقبة نشطة كل 5 دقائق" : "مراقبة روتينية"
  };
}

function buildRecommendations(byId, risk, metabolicRisk, vascularRisk, scenario) {
  const recs = ["استخدم النتائج كعرض تعليمي فقط، ولا تعتمد عليها لتشخيص أو علاج حالة حقيقية."];
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
    state.recommendations[1] || state.recommendations[0],
    "تنبيه: هذا شرح تعليمي وليس تشخيصًا طبيًا."
  ].join(" ");

  return {
    source: "local-ai",
    answer,
    confidence: state.summary.risk >= 70 ? 0.85 : 0.77,
    severity: state.summary.risk >= 70 ? "critical" : state.summary.risk >= 40 ? "watch" : "stable",
    actions: state.recommendations.slice(0, 3),
    evidence: [
      `سكر الدم: ${state.summary.glucose} mg/dL`,
      `ضغط الدم: ${state.summary.bloodPressure} mmHg`,
      `قابلية التخثر: ${state.summary.clotRisk}%`,
      `تروية الدماغ: ${state.summary.neuroPerfusion}%`
    ]
  };
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
  try {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
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
              "You are an Arabic educational human-body digital twin analyst. Do not provide diagnosis or treatment instructions. Return concise JSON only with keys: answer, severity, confidence, actions, evidence."
          },
          { role: "user", content: JSON.stringify({ question, state }) }
        ]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.output_text || extractResponseText(data);
    if (!text) return null;
    const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, ""));
    return {
      source: "openai",
      answer: parsed.answer,
      confidence: Number(parsed.confidence || 0.8),
      severity: parsed.severity || "watch",
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : []
    };
  } catch {
    return null;
  }
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

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
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
    if (request.method === "POST" && url.pathname === "/api/ai/ask") {
      const body = await readJsonBody(request);
      const state = buildTwinState();
      const question = String(body.question || "حلل حالة التوأم الرقمي للجسم الآن.");
      const aiAnswer = await openAiBodyAnalyst(question, state);
      sendJson(response, 200, aiAnswer || localBodyAnalyst(question, state));
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: "Server error", detail: error.message });
  }
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Digital Body Twin demo running at http://${displayHost}:${port}`);
});
