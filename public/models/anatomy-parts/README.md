# Human Anatomy GLB Files

18 separate GLB files representing a complete human anatomical model.
Each file uses the **same world coordinate system** — load them all into a
scene at origin (0, 0, 0) and they reassemble into a complete body.

## Coordinate system
- Units: **meters**
- Y axis: **up** (head ≈ +0.91, feet ≈ -0.91)
- X axis: **left/right** (subject's left = +X, right = -X)
- Z axis: **front/back** (front of body = +Z)
- Total body height: ~1.83 m (Visible Human Male reference)

## Files

### Skin & body
- `skin.glb` — translucent outer skin (alpha = 38/255, ≈15% opacity baked in)

### Organs
- `brain.glb` — Allen Brain Atlas (3D)
- `lungs.glb` — both lungs (semi-transparent)
- `heart.glb`
- `liver.glb`
- `spleen.glb` — rescaled to 62% of source for anatomical accuracy
- `pancreas.glb`
- `small_intestine.glb`
- `large_intestine.glb`
- `kidney_left.glb`, `kidney_right.glb`
- `bladder.glb`

### Cardiovascular system
- `trunk_arteries.glb` — head, chest, abdomen arteries (HuBMAP, real medical data)
- `trunk_veins.glb` — head, chest, abdomen veins (HuBMAP, real medical data)
- `arm_arteries.glb` — both arms (programmatically modeled, anatomically approximate)
- `arm_veins.glb` — both arms (programmatic)
- `leg_arteries.glb` — both legs (programmatic)
- `leg_veins.glb` — both legs (programmatic)

## Three.js example

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ORGANS = [
  'skin', 'brain', 'lungs', 'heart', 'liver', 'spleen', 'pancreas',
  'small_intestine', 'large_intestine', 'kidney_left', 'kidney_right',
  'bladder', 'trunk_arteries', 'trunk_veins',
  'arm_arteries', 'arm_veins', 'leg_arteries', 'leg_veins'
];

const loader = new GLTFLoader();
const scene = new THREE.Scene();
const parts = {};

await Promise.all(ORGANS.map(name => new Promise(resolve => {
  loader.load(`./anatomy_parts/${name}.glb`, gltf => {
    parts[name] = gltf.scene;
    scene.add(gltf.scene);   // Each part loads at its correct world position
    resolve();
  });
})));

// Toggle visibility of any organ:
parts.spleen.visible = false;

// Adjust skin transparency:
parts.skin.traverse(child => {
  if (child.isMesh) {
    child.material.opacity = 0.05;
    child.material.transparent = true;
  }
});
```

## Vertex colors

Every mesh has baked vertex colors. To use them in Three.js make sure your
material has `vertexColors: true`, or rely on the GLTFLoader default which
preserves them.

## License & attribution

- Real-world organ meshes (skin, brain, lungs, heart, liver, spleen,
  pancreas, intestines, kidneys, bladder, trunk vasculature) are derived
  from the **HuBMAP CCF 3D Reference Object Library v1.2**, licensed under
  **CC BY 4.0**. Please cite:
  > Browne, K., Schlehlein, H., Herr II, B. W., Quardokus, E., Bueckle, A.,
  > Börner, K. (2022). *HuBMAP CCF 3D Reference Object Library*.
  > https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html

- Source data: NIH Visible Human Project (NLM) and Allen Human Reference Atlas.
- Limb vessel meshes (arm/leg arteries and veins) are anatomically
  approximate, built procedurally for visual completeness only — not
  suitable for medical or surgical reference.
