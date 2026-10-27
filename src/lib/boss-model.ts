import * as THREE from "three";
import { boss } from "./boss";
import { createCharacterModelLibrary } from "./character-model-loader";

/** Keep the asset inside a wrapper so battle effects animate the whole boss. */
export function createBossModel(canvas: HTMLCanvasElement) {
  const root = new THREE.Group();
  const library = createCharacterModelLibrary();
  let disposed = false;
  canvas.dataset.bossModel = "loading";
  const ready = library.load("des-dragoon", { url: boss.modelUrl, yaw: boss.yaw }).then((model) => {
    if (disposed) return;
    root.add(model);
    canvas.dataset.bossModel = "ready";
    canvas.dataset.bossModelUrl = boss.modelUrl;
  });
  return {
    root,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.clear();
      library.dispose();
    },
  };
}
