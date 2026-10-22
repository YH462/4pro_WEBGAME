import * as THREE from "three";
import { battlePreview } from "./battle-preview";

/** Procedural armored turtle inspired by main:battle.html's cyber_turtle. */
export function buildBoss() {
  const boss = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: 0x403840, metalness: .72, roughness: .48, flatShading: true });
  const trim = new THREE.MeshStandardMaterial({ color: 0xe6dde1, metalness: .45, roughness: .3 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xdc263b, emissive: 0xd71c35, emissiveIntensity: 1.8, metalness: .35, roughness: .4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x231e28, roughness: .65 });
  const part = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    boss.add(mesh);
    return mesh;
  };
  const shell = part(new THREE.IcosahedronGeometry(1.06, 1), armor, [0, 1.08, -.13]);
  shell.scale.set(1.25, .84, 1.12);
  part(new THREE.BoxGeometry(.72, .52, .75), armor, [0, .86, 1.03]);
  part(new THREE.BoxGeometry(.82, .15, .65), trim, [0, .62, 1.14]);
  part(new THREE.BoxGeometry(.83, .11, .13), glow, [0, .96, 1.43]);
  part(new THREE.BoxGeometry(.17, .11, .16), dark, [0, .96, 1.45]);
  const ring = part(new THREE.TorusGeometry(1.15, .035, 6, 64), glow, [0, .94, -.13]);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1.1, 1.06, 1);
  const core = part(new THREE.CylinderGeometry(.44, .44, .09, 6), trim, [0, 1.9, -.13]);
  core.rotation.y = Math.PI / 6;
  part(new THREE.CylinderGeometry(.29, .29, .11, 6), glow, [0, 1.96, -.13]);
  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      const z = front > 0 ? .65 : -.82;
      part(new THREE.BoxGeometry(.4, .52, .48), armor, [side * .86, .35, z]);
      part(new THREE.BoxGeometry(.46, .15, .59), trim, [side * .87, .13, z + .04]);
      part(new THREE.BoxGeometry(.43, .065, .5), glow, [side * .86, .47, z]);
    }
    const horn = part(new THREE.ConeGeometry(.13, .55, 4), trim, [side * .56, 1.72, .42]);
    horn.rotation.z = side * -.35;
    const plate = part(new THREE.BoxGeometry(.09, .62, .72), trim, [side * .92, 1.25, -.1]);
    plate.rotation.z = side * -.45;
  }
  part(new THREE.ConeGeometry(.15, .6, 5), armor, [0, .7, -1.4]).rotation.x = -Math.PI / 2;
  boss.rotation.y = -.3;
  return boss;
}

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

  const boss = buildBoss();
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
