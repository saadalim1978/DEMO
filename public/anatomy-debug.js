// Anatomy Debug Overlay
// Press D = toggle bounding boxes, A = toggle axes, T = toggle tweak panel, E = export JSON.
// Drop this file at public/anatomy-debug.js and import it from app.js.

import * as THREE from "three";

const DEBUG_STATE = {
  enabled: false,
  showBoxes: false,
  showAxes: false,
  showPanel: false,
  selectedKey: null,
  helpers: new Map(), // key -> { box, axes }
  panelEl: null,
  bodyParts: null,
  manifest: null
};

const BOX_COLORS = {
  brain: 0xa78bfa,
  heart: 0xef4b5f,
  lungs: 0x48c7d8,
  liver: 0x9a4d2f,
  stomach: 0xff9f80,
  pancreas: 0xf4b740,
  leftKidney: 0xc084fc,
  rightKidney: 0xc084fc,
  smallIntestine: 0xffb3a7,
  largeIntestine: 0xd68a7c,
  bladder: 0xff77aa
};

export function initAnatomyDebug({ scene, bodyParts, manifestRef }) {
  DEBUG_STATE.bodyParts = bodyParts;
  DEBUG_STATE.manifest = manifestRef;

  window.addEventListener("keydown", (event) => {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
    const k = event.key.toLowerCase();
    if (k === "d") toggleBoxes(scene);
    else if (k === "a") toggleAxes(scene);
    else if (k === "t") togglePanel();
    else if (k === "e") exportManifest();
  });

  console.info(
    "%c[Anatomy Debug] D=boxes  A=axes  T=tweak panel  E=export JSON",
    "background:#1f2937;color:#a7f3d0;padding:4px 8px;border-radius:4px;"
  );
}

function toggleBoxes(scene) {
  DEBUG_STATE.showBoxes = !DEBUG_STATE.showBoxes;
  rebuildHelpers(scene);
}

function toggleAxes(scene) {
  DEBUG_STATE.showAxes = !DEBUG_STATE.showAxes;
  rebuildHelpers(scene);
}

function rebuildHelpers(scene) {
  // Clear old helpers
  for (const { box, axes } of DEBUG_STATE.helpers.values()) {
    if (box) scene.remove(box);
    if (axes) scene.remove(axes);
  }
  DEBUG_STATE.helpers.clear();

  if (!DEBUG_STATE.showBoxes && !DEBUG_STATE.showAxes) return;

  const parts = DEBUG_STATE.bodyParts;
  if (!parts) return;

  for (const [key, object] of Object.entries(parts)) {
    if (!object || !object.isObject3D) continue;
    const helpers = {};

    if (DEBUG_STATE.showBoxes) {
      const color = BOX_COLORS[key] || 0xffffff;
      const helper = new THREE.BoxHelper(object, color);
      helper.material.transparent = true;
      helper.material.opacity = 0.85;
      helper.material.depthTest = false;
      helper.renderOrder = 999;
      scene.add(helper);
      helpers.box = helper;
    }

    if (DEBUG_STATE.showAxes) {
      const axes = new THREE.AxesHelper(0.3);
      axes.material.depthTest = false;
      axes.renderOrder = 1000;
      object.getWorldPosition(axes.position);
      scene.add(axes);
      helpers.axes = axes;
    }

    DEBUG_STATE.helpers.set(key, helpers);
  }
}

export function updateDebugHelpers() {
  if (!DEBUG_STATE.showBoxes && !DEBUG_STATE.showAxes) return;
  for (const [key, { box, axes }] of DEBUG_STATE.helpers) {
    const target = DEBUG_STATE.bodyParts[key];
    if (!target) continue;
    if (box) box.update();
    if (axes) target.getWorldPosition(axes.position);
  }
}

function togglePanel() {
  DEBUG_STATE.showPanel = !DEBUG_STATE.showPanel;
  if (DEBUG_STATE.showPanel) buildPanel();
  else if (DEBUG_STATE.panelEl) DEBUG_STATE.panelEl.remove();
}

function buildPanel() {
  const parts = DEBUG_STATE.bodyParts;
  const manifest = DEBUG_STATE.manifest?.value;
  if (!parts || !manifest) return;

  const wrap = document.createElement("div");
  wrap.id = "anatomy-debug-panel";
  Object.assign(wrap.style, {
    position: "fixed",
    top: "12px",
    insetInlineEnd: "12px",
    width: "320px",
    maxHeight: "82vh",
    overflowY: "auto",
    background: "rgba(15,18,24,0.96)",
    color: "#e5e7eb",
    border: "1px solid #374151",
    borderRadius: "10px",
    padding: "12px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    zIndex: "9999",
    direction: "ltr"
  });

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong style="color:#a7f3d0;">Anatomy Tweak</strong>
      <span style="opacity:0.7;font-size:10px;">D boxes • A axes • E export</span>
    </div>
    <div id="anatomy-debug-list"></div>
  `;
  document.body.appendChild(wrap);
  DEBUG_STATE.panelEl = wrap;

  const list = wrap.querySelector("#anatomy-debug-list");

  // Brain entry first (it's a special case in app.js)
  if (parts.brain && manifest.brain) {
    list.appendChild(buildEntry("brain", parts.brain, manifest.brain));
  }
  // Then organs
  for (const organ of manifest.organs || []) {
    const obj = parts[organ.key];
    if (obj) list.appendChild(buildEntry(organ.key, obj, organ));
  }
}

function buildEntry(key, object, asset) {
  const row = document.createElement("details");
  row.style.cssText = "margin-bottom:6px;border:1px solid #374151;border-radius:6px;padding:6px 8px;";
  const color = BOX_COLORS[key] || 0xffffff;
  const hex = `#${color.toString(16).padStart(6, "0")}`;

  const pos = asset.position || [0, 0, 0];
  const fit = asset.fit || asset.size || [0.2, 0.2, 0.2];
  const rot = asset.rotation || [0, 0, 0];

  row.innerHTML = `
    <summary style="cursor:pointer;color:${hex};font-weight:600;">${asset.label || key}</summary>
    <div style="margin-top:6px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 6px;">
      ${slider("posX", "X", pos[0], -1, 1, 0.005)}
      ${slider("posY", "Y", pos[1], -2.5, 3, 0.01)}
      ${slider("posZ", "Z", pos[2], -0.5, 0.5, 0.005)}
      ${slider("fitX", "fitX", fit[0], 0.02, 1.2, 0.01)}
      ${slider("fitY", "fitY", fit[1], 0.02, 1.2, 0.01)}
      ${slider("fitZ", "fitZ", fit[2], 0.02, 1.2, 0.01)}
      ${slider("rotY", "rotY", rot[1], -3.2, 3.2, 0.05)}
    </div>
  `;

  row.querySelectorAll("input[type=range]").forEach((input) => {
    input.addEventListener("input", () => {
      const value = parseFloat(input.value);
      const valueEl = input.parentElement.nextElementSibling;
      if (valueEl) valueEl.textContent = value.toFixed(3);
      applyTweak(key, object, asset, input.dataset.field, value);
    });
  });

  return row;
}

function slider(field, label, value, min, max, step) {
  return `
    <span style="opacity:0.7;">${label}</span>
    <input type="range" data-field="${field}" min="${min}" max="${max}" step="${step}" value="${value}" style="width:100%;">
    <span style="opacity:0.85;width:50px;text-align:left;">${value.toFixed(3)}</span>
  `;
}

function applyTweak(key, object, asset, field, value) {
  if (field === "posX") { asset.position[0] = value; object.position.x = value; }
  else if (field === "posY") { asset.position[1] = value; object.position.y = value; }
  else if (field === "posZ") { asset.position[2] = value; object.position.z = value; }
  else if (field === "rotY") { asset.rotation[1] = value; object.rotation.y = value; }
  else if (field.startsWith("fit")) {
    const idx = { fitX: 0, fitY: 1, fitZ: 2 }[field];
    const target = asset.fit || asset.size;
    if (!target) return;
    const oldVal = target[idx];
    target[idx] = value;
    // Live rescale: scale child mesh to match new fit/old fit ratio on this axis
    const child = object.children.find((c) => c.isMesh || c.isGroup || c.isObject3D);
    if (child && oldVal > 0) {
      const ratio = value / oldVal;
      const axis = ["x", "y", "z"][idx];
      child.scale[axis] *= ratio;
    }
  }
}

function exportManifest() {
  const manifest = DEBUG_STATE.manifest?.value;
  if (!manifest) {
    console.warn("[Anatomy Debug] No manifest to export");
    return;
  }
  const json = JSON.stringify(manifest, null, 2);
  console.log("%c[Anatomy Debug] Current manifest:", "color:#a7f3d0;font-weight:bold;");
  console.log(json);

  // Also offer download
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "anatomy-manifest.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
