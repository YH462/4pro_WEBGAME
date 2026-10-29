import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { characterModel, type CharacterModelAsset } from "./character-models";
import { combineCharacterMotion } from "./character-motion-clip";

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
    async load(characterId: string, asset: CharacterModelAsset | undefined = characterModel(characterId), animated = false) {
      if (disposed) throw new Error("Character model library has been disposed.");
      if (!asset) throw new Error(`No model for ${characterId}`);
      const key = `${asset.url}:${asset.yaw}:${animated}`;
      let template = templates.get(key);
      if (!template) {
        template = loader.loadAsync(asset.url).then((gltf) => {
          const root = new THREE.Group();
          const facing = new THREE.Group(); facing.rotation.y = asset.yaw;
          facing.add(gltf.scene); root.add(facing);
          const bodies: THREE.Object3D[] = [];
          if (animated) root.traverse(object => { if (object.userData.raidMotionBody === true) bodies.push(object); });
          const frameBounds = () => bodies.length
            ? bodies.reduce((bounds, body) => bounds.union(new THREE.Box3().setFromObject(body)), new THREE.Box3())
            : new THREE.Box3().setFromObject(root);
          let pose: THREE.AnimationMixer | undefined;
          if (animated) {
            try {
              const clip = combineCharacterMotion(gltf.animations);
              pose = new THREE.AnimationMixer(root);
              pose.clipAction(clip).play(); pose.setTime(0);
              root.updateMatrixWorld(true);
              // Measure the authored starting pose, not Blender's saved frame.
              root.animations = [clip];
            } catch (error) { disposeModel(root); throw error; }
          }
          const bounds = frameBounds();
          const size = bounds.getSize(new THREE.Vector3());
          if (disposed || bounds.isEmpty() || !Number.isFinite(size.length()) || size.y <= 0) {
            disposeModel(root);
            throw new Error("Character model is unavailable or has invalid bounds.");
          }
          const center = bounds.getCenter(new THREE.Vector3());
          facing.position.set(-center.x, -bounds.min.y, -center.z);
          root.scale.setScalar(2 / size.y); // Feet at Y=0, front at +Z, height=2.
          root.updateMatrixWorld(true);
          if (pose) {
            // Cache a conservative motion envelope once per shared template.
            // CPU skinning of every vertex on every mobile frame is expensive.
            const clip = root.animations[0], action = pose.clipAction(clip).setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            const envelope = new THREE.Box3();
            for (let step = 0; step <= 12; step++) {
              action.reset().play(); pose.setTime(clip.duration * step / 12);
              root.updateMatrixWorld(true);
              root.traverse(object=>{if(object instanceof THREE.SkinnedMesh)object.computeBoundingBox();});
              envelope.union(frameBounds());
            }
            if (bodies.length && envelope.min.y < -.001) {
              // Keep an authored jump/drop above the arena floor. Framing from
              // its airborne first pose must not bury the final pose below Y=0.
              const lift = -envelope.min.y;
              facing.position.y += lift / root.scale.y;
              envelope.translate(new THREE.Vector3(0, lift, 0));
              root.updateMatrixWorld(true);
            }
            envelope.expandByScalar(.15);
            root.userData.motionBounds = { min: envelope.min.toArray(), max: envelope.max.toArray() };
            pose.stopAllAction(); pose.uncacheRoot(root);
          }
          loaded.add(root);
          return root;
        });
        templates.set(key, template);
      }
      const source = await template;
      if (disposed) throw new Error("Character model library has been disposed.");
      // Keep the normalized transform inside a wrapper so callers can size and animate it.
      const instance = new THREE.Group(); instance.add(clone(source)); instance.animations = source.animations;
      if (source.userData.motionBounds) instance.userData.motionBounds = source.userData.motionBounds;
      return instance;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loaded.forEach(disposeModel); loaded.clear(); templates.clear();
    },
  };
}
