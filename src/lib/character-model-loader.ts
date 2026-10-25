import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { characterModel } from "./character-models";

/** Dispose unique resources, including the embedded GLB textures. */
export function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    texture.dispose();
    if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close();
  });
}

/** One template per character per arena. Clones share GPU assets, with independent transforms/rigs. */
export function createCharacterModelLibrary() {
  const loader = new GLTFLoader();
  const templates = new Map<string, Promise<THREE.Group>>();
  const loaded = new Set<THREE.Group>();
  let disposed = false;
  return {
    async load(characterId: string) {
      if (disposed) throw new Error("Character model library has been disposed.");
      const asset = characterModel(characterId);
      if (!asset) throw new Error(`No model for ${characterId}`);
      let template = templates.get(characterId);
      if (!template) {
        template = loader.loadAsync(asset.url).then((gltf) => {
          const root = new THREE.Group();
          const facing = new THREE.Group(); facing.rotation.y = asset.yaw;
          facing.add(gltf.scene); root.add(facing);
          const bounds = new THREE.Box3().setFromObject(root);
          const size = bounds.getSize(new THREE.Vector3());
          if (disposed || bounds.isEmpty() || !Number.isFinite(size.length()) || size.y <= 0) {
            disposeModel(root);
            throw new Error("Character model is unavailable or has invalid bounds.");
          }
          const center = bounds.getCenter(new THREE.Vector3());
          facing.position.set(-center.x, -bounds.min.y, -center.z);
          root.scale.setScalar(2 / size.y); // Feet at Y=0, front at +Z, height=2.
          root.updateMatrixWorld(true);
          loaded.add(root);
          return root;
        });
        templates.set(characterId, template);
      }
      const source = await template;
      if (disposed) throw new Error("Character model library has been disposed.");
      // Keep the normalized transform inside a wrapper so callers can size and animate it.
      const instance = new THREE.Group(); instance.add(clone(source));
      return instance;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loaded.forEach(disposeModel); loaded.clear(); templates.clear();
    },
  };
}
