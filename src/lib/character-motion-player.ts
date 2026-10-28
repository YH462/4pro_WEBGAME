import * as THREE from "three";
import type { createCharacterModelLibrary } from "./character-model-loader";
import type { CharacterMotions } from "./character-models";

export type CharacterMotionCue = { action: "attack" | "heal"; key: string };
export const raidMotionWindowMs = 2200;

/** One controller per participant. Only GPU resources/clips are shared; mixers,
 * bones, playback and visibility always belong to this individual instance. */
export function createCharacterMotionPlayer(base: THREE.Group, library: ReturnType<typeof createCharacterModelLibrary>, assets: CharacterMotions | undefined) {
  const originals = [...base.children];
  const variants = new Map<string, { model: THREE.Group; mixer: THREE.AnimationMixer; action: THREE.AnimationAction; duration: number }>();
  let disposed = false;
  let active: "attack" | "heal" | null = null;
  const ready = Promise.all((["attack", "heal"] as const).map(async kind => {
    const asset = assets?.[kind];
    if (!asset) return;
    try {
      const model = await library.load(`motion-${kind}`, asset, true);
      if (disposed) return;
      const clip = model.animations[0];
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      model.visible = false;
      base.add(model);
      variants.set(kind, { model, mixer, action, duration: clip.duration });
    } catch (error) { console.warn(`Could not load ${kind} motion; retaining original model.`, error); }
  }));
  return {
    ready,
    bounds(target: THREE.Box3) {
      target.makeEmpty();
      for (const variant of variants.values()) {
        const cached = variant.model.userData.motionBounds as { min:number[]; max:number[] } | undefined;
        if (!cached) continue;
        variant.model.updateWorldMatrix(true, false);
        const bounds = new THREE.Box3(new THREE.Vector3().fromArray(cached.min), new THREE.Vector3().fromArray(cached.max));
        target.union(bounds.applyMatrix4(variant.model.matrixWorld));
      }
      return !target.isEmpty();
    },
    sample(kind: "attack" | "heal" | null, progress: number) {
      const variant = kind && progress >= 0 && progress < 1 ? variants.get(kind) : undefined;
      originals.forEach(model => { model.visible = !variant; });
      for (const [name, item] of variants) {
        item.model.visible = name === kind && Boolean(variant);
        if (!item.model.visible && active === name) item.action.stop();
      }
      active = variant ? kind : null;
      base.userData.raidMotion = active ?? "idle";
      if (!variant) return false;
      variant.action.reset().play();
      variant.mixer.setTime(progress * variant.duration);
      variant.model.updateMatrixWorld(true);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { model, mixer } of variants.values()) {
        mixer.stopAllAction(); mixer.uncacheRoot(model); base.remove(model);
      }
      variants.clear();
      originals.forEach(model => { model.visible = true; });
    },
  };
}
