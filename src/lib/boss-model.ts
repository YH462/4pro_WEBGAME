import * as THREE from "three";
import { boss } from "./boss";
import { createCharacterModelLibrary } from "./character-model-loader";
import { createCharacterMotionPlayer } from "./character-motion-player";

/** Keep the asset inside a wrapper so battle effects animate the whole boss. */
export function createBossModel(canvas: HTMLCanvasElement) {
  const root = new THREE.Group();
  const library = createCharacterModelLibrary();
  let disposed = false;
  let motionPlayer: ReturnType<typeof createCharacterMotionPlayer> | undefined;
  canvas.dataset.bossModel = "loading";
  const ready = library.load("des-dragoon", { url: boss.modelUrl, yaw: boss.yaw }).then((model) => {
    if (disposed) return;
    root.add(model);
    motionPlayer = createCharacterMotionPlayer(model, library, boss.motions);
    void motionPlayer.ready.then(()=>{if(!disposed)canvas.dataset.bossMotionsReady="true";});
    canvas.dataset.bossModel = "ready";
    canvas.dataset.bossModelUrl = boss.modelUrl;
  });
  return {
    root,
    ready,
    sample(attacking: boolean, progress: number) {
      const active = motionPlayer?.sample(attacking ? "attack" : null, progress);
      canvas.dataset.bossMotion = active ? "attack" : "idle";
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.clear();
      motionPlayer?.dispose();
      library.dispose();
    },
  };
}
