import * as THREE from "three";
import { buildBoss } from "./battle-arena";
import type { ShowcaseCue } from "./raid-showcase-scenes";

const clamp = THREE.MathUtils.clamp;
const ease = (value: number) => 1 - (1 - clamp(value, 0, 1)) ** 3;

/** PC-only presentation arena. Mobile battle renderers retain their existing behavior. */
export function createShowcaseArena(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 60);
  const baseCamera = new THREE.Vector3(3.25, 2.65, 7.3);
  const look = new THREE.Vector3(0, .95, 0);
  camera.position.copy(baseCamera); camera.lookAt(look);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x66515d, 3));
  const key = new THREE.DirectionalLight(0xfff4df, 4);
  key.position.set(-4, 7, 5); scene.add(key);
  const rim = new THREE.PointLight(0xff1845, 15, 12);
  rim.position.set(0, 3, -2); scene.add(rim);
  const impactLight = new THREE.PointLight(0xffb63d, 0, 10);
  impactLight.position.set(.3, 1.7, 2); scene.add(impactLight);

  const boss = buildBoss();
  boss.scale.setScalar(1.35); scene.add(boss);
  const armor = new THREE.MeshStandardMaterial({ color: 0x302c36, roughness: .42, metalness: .65, flatShading: true });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf8e8dc, roughness: .44, metalness: .2 });
  const red = new THREE.MeshBasicMaterial({ color: 0xff3258 });
  // Additional plates and silhouette spikes belong only to the presentation model.
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    const plate = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), armor);
    plate.position.set(Math.cos(angle) * .89, 1.43 + (i % 2) * .16, Math.sin(angle) * .78 - .13);
    plate.scale.set(1.1, .42, .85); boss.add(plate);
    if (i % 2 === 0) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(.13, .48, 4), ivory);
      spike.position.copy(plate.position).add(new THREE.Vector3(0, .28, 0));
      spike.rotation.z = -Math.cos(angle) * .4; boss.add(spike);
    }
  }
  const cracks = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(.025, .48, .025), red);
    line.position.set((i - 3) * .22, 1.48 + Math.sin(i) * .17, .69 - Math.abs(i - 3) * .07);
    line.rotation.z = i % 2 ? .5 : -.5; cracks.add(line);
  }
  boss.add(cracks);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.8, 96), new THREE.MeshBasicMaterial({ color: 0xfff5f9, transparent: true, opacity: .52 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.12; scene.add(floor);
  const grid = new THREE.GridHelper(24, 48, 0xd28fa6, 0xe8c5d2);
  grid.position.y = -.1;
  (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = .35; scene.add(grid);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.13, 96), new THREE.MeshBasicMaterial({ color: 0xf884a4, transparent: true, opacity: .5, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = -.08; scene.add(floorRing);

  const glowCanvas = document.createElement("canvas"); glowCanvas.width = 128; glowCanvas.height = 128;
  const ctx = glowCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "#ffffffff"); gradient.addColorStop(.16, "#fffffff0"); gradient.addColorStop(.45, "#ffffff70"); gradient.addColorStop(1, "#ffffff00");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const starCanvas = document.createElement("canvas"); starCanvas.width = 128; starCanvas.height = 128;
  const starCtx = starCanvas.getContext("2d")!;
  starCtx.drawImage(glowCanvas, 0, 0);
  starCtx.fillStyle = "#ffffff";
  starCtx.beginPath();
  starCtx.moveTo(64, 2); starCtx.lineTo(71, 55); starCtx.lineTo(126, 64); starCtx.lineTo(71, 72);
  starCtx.lineTo(64, 126); starCtx.lineTo(56, 72); starCtx.lineTo(2, 64); starCtx.lineTo(56, 55);
  starCtx.closePath(); starCtx.fill();
  const starTexture = new THREE.CanvasTexture(starCanvas);
  const sprite = (color: number) => {
    const material = new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    const item = new THREE.Sprite(material); scene.add(item); return item;
  };
  const flare = sprite(0xffd567);
  const halo = sprite(0xff9c22);
  const impact = new THREE.Vector3(.95, 1.9, 1.75);
  impactLight.position.copy(impact).add(new THREE.Vector3(0, .3, .5));
  const paths = [-1, 1].map((side) => new THREE.CubicBezierCurve3(
    new THREE.Vector3(side * 5.5, .2, 4), new THREE.Vector3(side * 4, 2.5, 2.6),
    new THREE.Vector3(side * 2, 2.6, 1.7), impact,
  ));
  const trails = paths.map((path) => {
    const geometry = new THREE.TubeGeometry(path, 80, .075, 6, false);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffde7c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.TubeGeometry(path, 80, .018, 5, false), new THREE.MeshBasicMaterial({ color: 0xfffff0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    const bloom = new THREE.Mesh(new THREE.TubeGeometry(path, 80, .17, 6, false), new THREE.MeshBasicMaterial({ color: 0xffae28, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(mesh, core, bloom); return { mesh, core, bloom, orb: sprite(0xffd55a), path };
  });
  const shock = new THREE.Mesh(new THREE.RingGeometry(.7, .708, 96), new THREE.MeshBasicMaterial({ color: 0xffd469, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  shock.position.copy(impact); shock.quaternion.copy(camera.quaternion); scene.add(shock);
  const groundShock = new THREE.Mesh(new THREE.RingGeometry(.7, .708, 96), new THREE.MeshBasicMaterial({ color: 0xffd469, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  groundShock.rotation.x = -Math.PI / 2; groundShock.position.y = -.06; scene.add(groundShock);

  const sparkGeometry = new THREE.BufferGeometry();
  const sparkCount = 360;
  const sparkPositions = new Float32Array(sparkCount * 3);
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({ color: 0xffe8aa, size: .12, map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial); sparks.frustumCulled = false; scene.add(sparks);
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(sparkCount * 3);
  const starColors = new Float32Array(sparkCount * 3);
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const starMaterial = new THREE.PointsMaterial({ size: .19, map: starTexture, vertexColors: true, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const glitter = new THREE.Points(starGeometry, starMaterial); glitter.frustumCulled = false; glitter.renderOrder = 4; scene.add(glitter);
  const streakGeometry = new THREE.BufferGeometry();
  const streakPositions = new Float32Array(120 * 6);
  streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3));
  const streakMaterial = new THREE.LineBasicMaterial({ color: 0xffdf8e, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial); streaks.frustumCulled = false; streaks.renderOrder = 3; scene.add(streaks);
  const debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.12), armor, 36);
  debris.frustumCulled = false; scene.add(debris);
  const transform = new THREE.Object3D();
  const seeds = Array.from({ length: sparkCount }, (_, i) => ({
    x: Math.sin(i * 19.7) * 3.4, y: .5 + (Math.sin(i * 5.3) + 1) * 1.5, z: Math.cos(i * 12.3) * 2.4,
  }));

  const allies = [-2.5, -.9, .9, 2.5].map((x, i) => {
    const ally = new THREE.Group();
    const color = [0xffb532, 0xee447a, 0x36c68b, 0x36a5e7][i];
    const suit = new THREE.MeshStandardMaterial({ color, metalness: .35, roughness: .48 });
    const torso = new THREE.Mesh(new THREE.ConeGeometry(.15, .4, 5), suit);
    torso.position.y = .36; ally.add(torso);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 1), ivory);
    head.position.y = .67; ally.add(head);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.09, .24, .12), armor);
      leg.position.set(side * .09, .12, 0); ally.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.09, .28, .1), suit);
      arm.position.set(side * .2, .42, -.06); arm.rotation.x = -.75; ally.add(arm);
    }
    ally.scale.setScalar(.8); ally.position.set(x * .9, 0, 2.75 + Math.abs(x) * .08); ally.rotation.y = Math.atan2(-x, 3.5); scene.add(ally); return ally;
  });
  const healing = new THREE.Mesh(new THREE.RingGeometry(.43, .49, 64), new THREE.MeshBasicMaterial({ color: 0x46ffae, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  healing.rotation.x = -Math.PI / 2; healing.position.copy(allies[2].position).add(new THREE.Vector3(0, .02, 0)); scene.add(healing);
  const healingGlow = sprite(0x38ff9d);
  healingGlow.position.copy(allies[2].position).add(new THREE.Vector3(0, .55, 0));
  const water = new THREE.Mesh(new THREE.TorusGeometry(.9, .17, 8, 72), new THREE.MeshBasicMaterial({ color: 0x73e2ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(water);
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(.075, .16), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 100);
  confetti.frustumCulled = false;
  for (let i = 0; i < 100; i++) confetti.setColorAt(i, new THREE.Color([0xffc849, 0xff496d, 0x65e4ce, 0xffffff][i % 4]));
  scene.add(confetti);

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cue: ShowcaseCue = "idle";
  let startedAt = performance.now();
  let pausedAt: number | null = null;
  let frame = 0; let disposed = false; let lastDraw = 0;
  const draw = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden || now - lastDraw < 1000 / 40) return;
    lastDraw = now;
    const time = ((pausedAt ?? now) - startedAt) / 1000;
    const reduced = motion.matches;
    const attacking = cue === "attack" || cue === "critical";
    const critical = cue === "critical";
    const hit = time - .65;
    // Hold the first impact briefly before the recoil and fragments accelerate.
    const burst = Math.max(0, hit - (hit > .09 ? .09 : hit));
    const envelope = hit >= 0 ? Math.max(0, 1 - burst / 1.5) : 0;
    const color = critical ? 0xffc345 : 0x65dcff;
    boss.position.set(0, reduced ? 0 : Math.sin(time * 2.5) * .045, 0);
    boss.rotation.set(0, -.2 + (reduced ? 0 : Math.sin(time * .7) * .035), 0);
    boss.scale.setScalar(1.35);
    cracks.visible = cue === "weaken" || cue === "victory";
    if (attacking && hit >= 0 && !reduced) {
      boss.rotation.z = -Math.sin(Math.min(burst * 4, Math.PI)) * (critical ? .17 : .07);
      boss.position.z = -Math.sin(Math.min(burst * 4, Math.PI)) * (critical ? .4 : .15);
    }
    if (cue === "weaken" && !reduced) { boss.position.y -= .16; boss.rotation.z = Math.sin(time * 8) * .025; }
    if (cue === "victory") {
      boss.position.y -= ease(time / 1.4) * .6;
      boss.rotation.z = ease(time / 1.4) * -.65;
      boss.scale.setScalar(1.35 * (1 - ease(Math.max(0, time - 1.5) / 1.5) * .3));
    }
    camera.position.copy(baseCamera);
    if (attacking && critical && hit >= 0 && hit < .7 && !reduced) {
      camera.position.x += Math.sin(hit * 65) * .065 * envelope;
      camera.position.y += Math.cos(hit * 73) * .04 * envelope;
    }
    camera.lookAt(look);
    trails.forEach(({ mesh, core, bloom, orb, path }, i) => {
      const visible = attacking && time < 2 && (critical || i === 0);
      mesh.visible = core.visible = bloom.visible = orb.visible = visible;
      const progress = clamp(time / .65, 0, 1);
      for (const trail of [mesh, core, bloom]) trail.geometry.setDrawRange(0, Math.floor(progress * 80) * (trail === core ? 5 : 6) * 6);
      mesh.material.color.set(color); mesh.material.opacity = time < .65 ? .85 : envelope * .65;
      core.material.opacity = (time < .65 ? 1 : envelope) * .95;
      bloom.material.color.set(color); bloom.material.opacity = (time < .65 ? 1 : envelope) * .2;
      orb.position.copy(path.getPoint(progress)); orb.scale.setScalar((critical ? .65 : .4) * (time < .65 ? 1 : envelope));
      orb.material.color.set(color); orb.material.opacity = reduced ? .25 : .85;
    });
    for (const item of [flare, halo]) { item.visible = attacking && hit >= 0; item.position.copy(impact); item.material.color.set(color); }
    flare.scale.setScalar((critical ? 3.4 : 1.8) * (reduced ? .25 : envelope));
    halo.scale.setScalar((critical ? 5.8 : 2.4) * (reduced ? .2 : envelope));
    flare.material.opacity = envelope; halo.material.opacity = envelope * .35;
    impactLight.intensity = attacking && !reduced ? envelope * (critical ? 30 : 12) : 0;
    impactLight.color.set(color);
    shock.visible = groundShock.visible = attacking && hit >= 0 && !reduced;
    shock.scale.setScalar(1 + ease(burst / 1.2) * (critical ? 5 : 2.5)); shock.material.opacity = envelope * .8; shock.material.color.set(color);
    groundShock.scale.setScalar(1 + ease(burst / 1.2) * (critical ? 5 : 2.5)); groundShock.material.opacity = envelope * .7; groundShock.material.color.set(color);
    sparks.visible = attacking && hit >= 0;
    sparkMaterial.color.set(color); sparkMaterial.opacity = envelope;
    sparkGeometry.setDrawRange(0, critical ? sparkCount : 100);
    for (let i = 0; i < sparkCount; i++) {
      const travel = reduced ? .1 : burst * (critical ? 1.35 : 1);
      sparkPositions[i * 3] = impact.x + seeds[i].x * travel;
      sparkPositions[i * 3 + 1] = impact.y + seeds[i].y * travel - travel * travel * 1.7;
      sparkPositions[i * 3 + 2] = impact.z + seeds[i].z * travel;
    }
    sparkGeometry.attributes.position.needsUpdate = true;
    // Four-point glints and radial streaks retain detail around the bright impact core.
    const glitterCount = critical ? sparkCount : attacking ? 130 : cue === "heal" ? 100 : cue === "victory" ? 240 : 36;
    starGeometry.setDrawRange(0, glitterCount);
    starMaterial.size = attacking ? .2 : .13;
    starMaterial.opacity = attacking ? envelope : cue === "heal" || cue === "victory" ? .8 : .28;
    glitter.visible = !reduced && (!attacking || hit >= 0);
    for (let i = 0; i < glitterCount; i++) {
      const seed = seeds[i];
      const spread = .1 + burst * (1 + (i % 7) * .13);
      if (attacking) {
        starPositions[i * 3] = impact.x + seed.x * spread;
        starPositions[i * 3 + 1] = impact.y + seed.y * spread - spread * spread * .8;
        starPositions[i * 3 + 2] = impact.z + seed.z * spread;
      } else if (cue === "heal") {
        starPositions[i * 3] = allies[2].position.x + Math.sin(i * 2.3 + time) * .5;
        starPositions[i * 3 + 1] = (i * .07 + time * .65) % 2.3;
        starPositions[i * 3 + 2] = allies[2].position.z + Math.cos(i * 2.3 + time) * .5;
      } else {
        starPositions[i * 3] = seed.x * 1.5;
        starPositions[i * 3 + 1] = (seed.y + time * .14 + i * .03) % 4;
        starPositions[i * 3 + 2] = seed.z + 1;
      }
      const twinkle = .5 + .5 * Math.sin(time * 5 + i * 2.7) ** 6;
      starColors[i * 3] = (cue === "heal" ? .45 : 1) * twinkle;
      starColors[i * 3 + 1] = (cue === "heal" ? 1 : critical || cue === "victory" ? .72 + (i % 3) * .13 : .95) * twinkle;
      starColors[i * 3 + 2] = (cue === "heal" ? .7 : critical || cue === "victory" ? .2 + (i % 4) * .22 : 1) * twinkle;
    }
    starGeometry.attributes.position.needsUpdate = true; starGeometry.attributes.color.needsUpdate = true;
    streaks.visible = attacking && hit >= 0 && !reduced;
    streakGeometry.setDrawRange(0, critical ? 240 : 80);
    streakMaterial.color.set(critical ? 0xffe29c : 0xc9f8ff); streakMaterial.opacity = envelope * .8;
    for (let i = 0; i < 120; i++) {
      const seed = seeds[i];
      const travel = .05 + burst * (critical ? 1.5 : 1);
      const tail = Math.max(0, travel - .13 - i % 5 * .035);
      for (let point = 0; point < 2; point++) {
        const t = point ? travel : tail;
        streakPositions[i * 6 + point * 3] = impact.x + seed.x * t;
        streakPositions[i * 6 + point * 3 + 1] = impact.y + seed.y * t - t * t * .9;
        streakPositions[i * 6 + point * 3 + 2] = impact.z + seed.z * t;
      }
    }
    streakGeometry.attributes.position.needsUpdate = true;
    debris.visible = attacking && critical && hit >= 0 && hit < 2 && !reduced;
    for (let i = 0; i < 36; i++) {
      transform.position.set(impact.x + seeds[i].x * burst, impact.y + seeds[i].y * burst - burst * burst * 1.7, impact.z + seeds[i].z * burst);
      transform.rotation.set(i + burst * 3, i * .3 + burst, burst * 2);
      transform.scale.setScalar(envelope * (.4 + i % 3 * .3)); transform.updateMatrix(); debris.setMatrixAt(i, transform.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;
    const heal = cue === "heal" ? Math.max(0, Math.sin(clamp(time / 3, 0, 1) * Math.PI)) : 0;
    healing.material.opacity = heal; healing.scale.setScalar(1 + heal * .35);
    healingGlow.material.opacity = heal * .7; healingGlow.scale.set(1.4, 2.2, 1);
    allies.forEach((ally, i) => { ally.position.y = reduced ? 0 : cue === "victory" ? Math.abs(Math.sin(time * 5 + i)) * .15 : Math.sin(time * 3 + i) * .02; });
    water.visible = cue === "counter";
    const waterT = clamp((time - .6) / 1.5, 0, 1);
    water.position.set(0, 1.2, .8 + waterT * 7); water.quaternion.copy(camera.quaternion);
    water.scale.setScalar(.2 + waterT * 4); water.material.opacity = reduced ? .2 : Math.sin(waterT * Math.PI) * .8;
    if (cue === "counter" && !reduced) boss.rotation.x = -Math.sin(clamp(time / 2.5, 0, 1) * Math.PI) * .15;
    confetti.visible = cue === "victory";
    for (let i = 0; i < 100; i++) {
      transform.position.set(Math.sin(i * 17.1) * 6, 4.5 - ((time * (reduced ? .05 : .8) + i * .17) % 5), Math.cos(i * 13.7) * 3);
      transform.rotation.set(time + i, i * 2, time * .8 + i); transform.scale.setScalar(1); transform.updateMatrix(); confetti.setMatrixAt(i, transform.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(draw);
  return {
    play(next: ShowcaseCue) { cue = next; startedAt = performance.now(); pausedAt = null; },
    pause(value: boolean) {
      if (value && pausedAt === null) pausedAt = performance.now();
      else if (!value && pausedAt !== null) { startedAt += performance.now() - pausedAt; pausedAt = null; }
    },
    resize(width: number, height: number) {
      if (disposed || width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    },
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame);
      const materials = new Set<THREE.Material>(); const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((object) => {
        const item = object as THREE.Mesh;
        if (item.geometry) geometries.add(item.geometry);
        if (item.material) for (const material of Array.isArray(item.material) ? item.material : [item.material]) materials.add(material);
      });
      materials.forEach((material) => material.dispose()); geometries.forEach((geometry) => geometry.dispose());
      glowTexture.dispose(); starTexture.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
