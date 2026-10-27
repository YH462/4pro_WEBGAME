import * as THREE from "three";
import { battlePreview } from "./battle-preview";
import { createBossModel } from "./boss-model";

export function createBattleArena(canvas: HTMLCanvasElement, { framing = "default" }: { framing?: "default" | "raid" } = {}) {
  const options = { alpha: true, antialias: true, powerPreference: "low-power" } as const;
  const context = canvas.getContext("webgl2", options) as WebGL2RenderingContext | null;
  if (!context) throw new Error("WebGL2 is unavailable; use the illustration fallback.");
  const renderer = new THREE.WebGLRenderer({ canvas, context, ...options });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, framing === "raid" ? 1.25 : 1.75));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 50);
  camera.position.set(3.9, 3.0, 6.6);
  camera.lookAt(0, .9, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c7380, 2.6));
  const key = new THREE.DirectionalLight(0xfff7f0, 3.8);
  key.position.set(-3, 6, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xff304d, 11, 12);
  rim.position.set(2, 3, -2);
  scene.add(rim);

  const bossModel = createBossModel(canvas);
  const boss = bossModel.root;
  scene.add(boss);
  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0xe8dce3, metalness: .4, roughness: .6 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.95, .08, 6), platformMaterial);
  platform.position.y = -.04;
  platform.rotation.y = Math.PI / 6;
  scene.add(platform);
  const grid = new THREE.GridHelper(16, 32, 0xd79eae, 0xead4de);
  grid.position.y = -.09;
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = .5;
  scene.add(grid);

  const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xdf2638, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const pulse = new THREE.Mesh(new THREE.RingGeometry(.65, .72, 48), pulseMaterial);
  pulse.position.set(0, 1.1, 1.4);
  pulse.lookAt(camera.position);
  scene.add(pulse);

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let attackAt: number | null = null;
  let frame = 0;
  let disposed = false;
  let lastDraw = -Infinity;
  let needsDraw = true;
  const motionChanged = () => { needsDraw = true; };
  motion.addEventListener("change", motionChanged);
  const draw = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden || (!needsDraw && (motion.matches || (framing === "raid" && now - lastDraw < 30)))) return;
    lastDraw = now; needsDraw = false;
    const elapsed = attackAt === null ? 2 : (now - attackAt) / battlePreview.animationMs;
    if (!motion.matches) {
      boss.position.y = Math.sin(now / 800) * .035;
      boss.rotation.y = -.3 + Math.sin(now / 1800) * .08;
      boss.position.x = elapsed < 1 ? Math.sin(elapsed * Math.PI * 18) * (1 - elapsed) * .1 : 0;
      pulseMaterial.opacity = elapsed < 1 ? (1 - elapsed) * .8 : 0;
      pulse.scale.setScalar(1 + Math.max(0, Math.min(elapsed, 1)) * 2.2);
    } else {
      boss.position.set(0, 0, 0);
      pulseMaterial.opacity = 0;
    }
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(draw);
  return {
    ready: bossModel.ready.then(() => { needsDraw = true; }),
    resize(width: number, height: number) {
      if (disposed || width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      needsDraw = true;
      camera.aspect = width / height;
      if (framing === "raid") {
        const target = new THREE.Vector3(0, .92, 0);
        const distance = Math.max(2.4, 3.7 / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        camera.position.copy(new THREE.Vector3(3.8, 2.1, 6).normalize().multiplyScalar(distance).add(target));
        camera.lookAt(target);
      }
      camera.updateProjectionMatrix();
    },
    attack() { attackAt = performance.now(); needsDraw = true; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", motionChanged);
      bossModel.dispose();
      // A remount or route change must release geometry, materials and the GL context.
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const renderable = object as THREE.Mesh;
        renderable.geometry?.dispose();
        if (renderable.material) for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) materials.add(material);
      });
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
