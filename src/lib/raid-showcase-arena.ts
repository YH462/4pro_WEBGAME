import * as THREE from "three";
import { buildBoss } from "./battle-arena";
import { counterImpactMs, counterLaunchMs, showcaseCounterFrame, type ShowcaseFrame } from "./raid-showcase-playback";
import { showcaseImpactMs } from "./raid-showcase-scenes";
import { characterColors, raidMemberPosition, type RaidArenaContext } from "./raid-screen-playback";

const clamp = THREE.MathUtils.clamp;
const ease = (value: number) => 1 - (1 - clamp(value, 0, 1)) ** 3;

/** Shared screen arena; the standalone demo uses its original four-player fixture. */
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

  const allies = Array.from({ length: 20 }, (_, i) => {
    const x = [-2.5, -.9, .9, 2.5][i % 4];
    const ally = new THREE.Group();
    const body = new THREE.Group(); body.position.y = .24; ally.add(body);
    const color = [0xffb532, 0xee447a, 0x36c68b, 0x36a5e7][i % 4];
    const suit = new THREE.MeshStandardMaterial({ color, metalness: .35, roughness: .48 });
    const torso = new THREE.Mesh(new THREE.ConeGeometry(.15, .4, 5), suit);
    torso.position.y = .12; body.add(torso);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 1), ivory);
    head.position.y = .43; body.add(head);
    const legs: THREE.Mesh[] = [];
    const arms: THREE.Mesh[] = [];
    const hands: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.09, .24, .12), armor);
      leg.position.set(side * .09, .12, 0); ally.add(leg);
      legs.push(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.09, .28, .1), suit);
      arm.position.set(side * .2, .18, -.06); arm.rotation.x = -.75; body.add(arm); arms.push(arm);
      const hand = new THREE.Object3D(); hand.position.y = -.14; arm.add(hand); hands.push(hand);
    }
    ally.scale.setScalar(.8); ally.position.set(x * .9, 0, 2.75 + Math.abs(x) * .08); ally.rotation.y = Math.atan2(-x, 3.5); ally.visible = i < 4; scene.add(ally);
    return { root: ally, body, arms, hands, legs, suit, home: ally.position.clone() };
  });
  let actorIndex = 2;
  let attacker = allies[actorIndex];
  const castArmAngle = 1.05;
  // Derive both origins from the actual hands in the held casting pose.
  // Keeping that pose during flight avoids rebuilding tube geometry each frame.
  attacker.arms.forEach((arm) => { arm.rotation.x = castArmAngle; });
  attacker.root.updateWorldMatrix(true, true);
  const paths = attacker.hands.map((hand, i) => {
    const origin = hand.getWorldPosition(new THREE.Vector3());
    const side = i === 0 ? -1 : 1;
    return new THREE.CubicBezierCurve3(
      origin, origin.clone().add(new THREE.Vector3(side * .35, .65, -.2)),
      impact.clone().add(new THREE.Vector3(side * .55, .3, .15)), impact,
    );
  });
  attacker.arms.forEach((arm) => { arm.rotation.x = -.75; });
  const trails = paths.map((path, i) => {
    const geometry = new THREE.TubeGeometry(path, 80, .075, 6, false);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffde7c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.TubeGeometry(path, 80, .018, 5, false), new THREE.MeshBasicMaterial({ color: 0xfffff0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    const bloom = new THREE.Mesh(new THREE.TubeGeometry(path, 80, .17, 6, false), new THREE.MeshBasicMaterial({ color: 0xffae28, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const launchGlow = sprite(0x65dcff); attacker.hands[i].add(launchGlow);
    scene.add(mesh, core, bloom); return { mesh, core, bloom, orb: sprite(0xffd55a), launchGlow, path };
  });
  const healing = new THREE.Mesh(new THREE.RingGeometry(.43, .49, 64), new THREE.MeshBasicMaterial({ color: 0x46ffae, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  healing.rotation.x = -Math.PI / 2; healing.position.copy(allies[2].home).add(new THREE.Vector3(0, .02, 0)); scene.add(healing);
  const healingGlow = sprite(0x38ff9d);
  healingGlow.position.copy(allies[2].home).add(new THREE.Vector3(0, .55, 0));
  // Reused pools: every participant has their own hand origins and healing ring.
  const teamBeams = allies.flatMap((ally, index) => ally.hands.map((hand, side) => {
    const path = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), impact.clone(), impact.clone());
    const make = (radius: number, color: number, additive = true) => {
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 80, radius, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      mesh.visible = false; scene.add(mesh); return mesh;
    };
    const glow = sprite(0x65dcff); hand.add(glow); glow.visible = false;
    return { index, side, path, mesh: make(.055, 0x65dcff), core: make(.015, 0xffffff, false), bloom: make(.12, 0x65dcff), glow, orb: sprite(0x65dcff) };
  }));
  const teamHealing = allies.map(() => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.36, .42, 48), new THREE.MeshBasicMaterial({ color: 0x46ffae, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; scene.add(ring); return { ring, glow: sprite(0x38ff9d) };
  });

  const breath = new THREE.Group(); scene.add(breath);
  const mouth = new THREE.Vector3(-.32, 1.17, 1.95);
  let targets = allies.slice(0, 4).map(({ home }) => home.clone().add(new THREE.Vector3(0, .38, 0)));
  const teamCenter = new THREE.Vector3(0, .38, 2.9);
  const fanEdge = new THREE.CatmullRomCurve3(targets);
  // Every point on the widening front reaches the team at the same playback time.
  const sampleFan = (progress: number, across: number, point: THREE.Vector3) => {
    fanEdge.getPoint(across, point);
    point.lerpVectors(mouth, point, progress);
    point.y += Math.sin(progress * Math.PI) * .18;
    return point;
  };
  const blueMaterial = (color: number, additive = false) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
  });
  const fanRows = 40, fanColumns = 32;
  const fanGeometry = new THREE.BufferGeometry();
  const fanPositions: number[] = [], fanColors: number[] = [], fanIndices: number[] = [];
  const point = new THREE.Vector3();
  for (let row = 0; row <= fanRows; row++) {
    for (let column = 0; column <= fanColumns; column++) {
      sampleFan(row / fanRows, column / fanColumns, point);
      fanPositions.push(point.x, point.y, point.z);
      const shine = Math.sin(column / fanColumns * Math.PI);
      fanColors.push(.25 + shine * .4, .75 + shine * .2, 1);
      if (row < fanRows && column < fanColumns) {
        const a = row * (fanColumns + 1) + column, b = a + fanColumns + 1;
        fanIndices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  fanGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fanPositions, 3));
  fanGeometry.setAttribute("color", new THREE.Float32BufferAttribute(fanColors, 3));
  fanGeometry.setIndex(fanIndices);
  const fanMaterial = blueMaterial(0xffffff); fanMaterial.vertexColors = true;
  const fanSheet = new THREE.Mesh(fanGeometry, fanMaterial); breath.add(fanSheet);
  const breathStrands = Array.from({ length: 7 }, (_, i) => {
    const end = sampleFan(1, i / 6, new THREE.Vector3());
    const middle = mouth.clone().lerp(end, .5); middle.y += .36;
    const path = new THREE.QuadraticBezierCurve3(mouth, middle, end);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 40, .022, 5, false), blueMaterial(i % 2 ? 0xb9faff : 0x67d8ff));
    breath.add(mesh); return mesh;
  });
  const breathWaves = Array.from({ length: 7 }, () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2 * (fanColumns + 1) * 3), 3));
    geometry.setIndex(fanIndices.slice(0, fanColumns * 6));
    const wave = new THREE.Mesh(geometry, blueMaterial(0x9aeaff));
    wave.frustumCulled = false; breath.add(wave); return wave;
  });
  const chargeGlow = sprite(0x32b8ff);
  const chargeCore = sprite(0xeaffff);
  chargeGlow.position.copy(mouth); chargeCore.position.copy(mouth);
  const chargeRings = [0, 1].map(() => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .015, 6, 64), blueMaterial(0x64d9ff));
    ring.position.copy(mouth); scene.add(ring); return ring;
  });
  const counterLight = new THREE.PointLight(0x5bd8ff, 0, 5); scene.add(counterLight);
  const counterImpacts = allies.map(({ home }) => {
    const target = home.clone().add(new THREE.Vector3(0, .38, 0));
    const flash = sprite(0xc5faff); flash.position.copy(target);
    const halo = sprite(0x30baff); halo.position.copy(target);
    const splash = new THREE.Mesh(new THREE.RingGeometry(.38, .405, 64), blueMaterial(0x58cfff));
    splash.rotation.x = -Math.PI / 2; splash.position.copy(target); splash.position.y = .025; scene.add(splash);
    return { flash, halo, splash };
  });
  const splashStreaks = new THREE.InstancedMesh(new THREE.ConeGeometry(.045, .5, 4), blueMaterial(0x96eaff), 80);
  splashStreaks.frustumCulled = false; scene.add(splashStreaks);
  const direction = new THREE.Vector3();
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(.075, .16), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 100);
  confetti.frustumCulled = false;
  for (let i = 0; i < 100; i++) confetti.setColorAt(i, new THREE.Color([0xffc849, 0xff496d, 0x65e4ce, 0xffffff][i % 4]));
  scene.add(confetti);

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false;
  let contextKey = "";
  let counterIndices = [0, 1, 2, 3];
  const syncContext = (context: RaidArenaContext) => {
    const nextKey = JSON.stringify([context.members.map((member) => [member.id, member.characterId]), context.actorId, context.counterIds, context.actions]);
    if (nextKey === contextKey) return;
    contextKey = nextKey;
    allies.forEach((ally, i) => {
      const member = context.members[i]; ally.root.visible = Boolean(member);
      if (!member) return;
      const position = raidMemberPosition(i, context.members.length);
      ally.home.set(position.x, 0, position.z);
      ally.root.position.copy(ally.home); ally.root.rotation.y = Math.atan2(-position.x, 3.5);
      ally.root.scale.setScalar(context.members.length > 10 ? .6 : .8);
      ally.suit.color.set(characterColors[member.characterId] ?? 0xb18aff);
    });
    actorIndex = context.members.findIndex((member) => member.id === context.actorId);
    attacker = allies[Math.max(0, actorIndex)];
    attacker.root.position.copy(attacker.home);
    attacker.body.rotation.set(0, 0, 0); attacker.body.position.y = .24;
    attacker.arms.forEach((arm) => { arm.rotation.set(castArmAngle, 0, 0); });
    attacker.root.updateWorldMatrix(true, true);
    trails.forEach((trail, i) => {
      const origin = attacker.hands[i].getWorldPosition(new THREE.Vector3());
      const side = i === 0 ? -1 : 1;
      trail.path.v0.copy(origin); trail.path.v1.copy(origin).add(new THREE.Vector3(side * .35, .65, -.2));
      trail.path.updateArcLengths();
      for (const [mesh, radius, segments] of [[trail.mesh, .075, 6], [trail.core, .018, 5], [trail.bloom, .17, 6]] as const) {
        mesh.geometry.dispose(); mesh.geometry = new THREE.TubeGeometry(trail.path, 80, radius, segments, false);
      }
      attacker.hands[i].add(trail.launchGlow);
    });
    if (context.actions) {
      allies.forEach((ally) => { ally.body.rotation.set(0, 0, 0); ally.body.position.y = .24; ally.arms.forEach((arm) => arm.rotation.set(castArmAngle, 0, 0)); ally.root.updateWorldMatrix(true, true); });
      teamBeams.forEach((beam) => {
        const origin = allies[beam.index].hands[beam.side].getWorldPosition(new THREE.Vector3());
        const side = beam.side ? 1 : -1;
        beam.path.v0.copy(origin); beam.path.v1.copy(origin).add(new THREE.Vector3(side * .35, .65, -.2));
        beam.path.v2.copy(impact).add(new THREE.Vector3(side * .55, .3, .15)); beam.path.updateArcLengths();
        for (const [mesh, radius] of [[beam.mesh, .055], [beam.core, .015], [beam.bloom, .12]] as const) { mesh.geometry.dispose(); mesh.geometry = new THREE.TubeGeometry(beam.path, 80, radius, 6, false); }
      });
    }
    counterIndices = context.members.flatMap((member, i) => context.counterIds.includes(member.id) ? [i] : []);
    // A narrow front for a single target; the demo retains its full-team fan.
    targets = (counterIndices.length ? counterIndices : [Math.max(0, actorIndex)]).map((i) => allies[i].home.clone().add(new THREE.Vector3(0, .38, 0)));
    const sorted = [...targets].sort((a, b) => a.x - b.x);
    fanEdge.points = sorted.length === 1 ? [sorted[0].clone().add(new THREE.Vector3(-.18, 0, 0)), sorted[0].clone().add(new THREE.Vector3(.18, 0, 0))] : sorted;
    const positions = fanGeometry.attributes.position;
    for (let row = 0; row <= fanRows; row++) for (let column = 0; column <= fanColumns; column++) {
      sampleFan(row / fanRows, column / fanColumns, point);
      positions.setXYZ(row * (fanColumns + 1) + column, point.x, point.y, point.z);
    }
    positions.needsUpdate = true; fanGeometry.computeBoundingSphere();
    breathStrands.forEach((mesh, i) => {
      const end = sampleFan(1, i / 6, new THREE.Vector3());
      const middle = mouth.clone().lerp(end, .5); middle.y += .36;
      mesh.geometry.dispose(); mesh.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(mouth, middle, end), 40, .022, 5, false);
    });
    counterImpacts.forEach(({ flash, halo, splash }, i) => {
      const target = targets[i] ?? targets[0];
      flash.position.copy(target); halo.position.copy(target); splash.position.copy(target); splash.position.y = .025;
    });
    teamCenter.set(0, 0, 0); targets.forEach((target) => teamCenter.add(target)); teamCenter.divideScalar(targets.length);
  };
  const draw = (frame: ShowcaseFrame, context?: RaidArenaContext) => {
    if (disposed) return;
    if (context) syncContext(context);
    const cue = frame.cue;
    const time = frame.visualMs / 1000;
    const reduced = motion.matches;
    const attacking = cue === "attack" || cue === "critical";
    const critical = cue === "critical";
    const counter = cue === "counter";
    const counterFrame = showcaseCounterFrame(frame.visualMs);
    const hit = time - showcaseImpactMs / 1000;
    const burst = Math.max(0, hit);
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
    if (context) { camera.position.z += 1.2 + Math.max(0, context.members.length - 10) * .03; camera.position.y += .25; }
    if (counter) {
      const wide = reduced ? 1 : ease(time / .65) * (1 - ease((time - 2.7) / .7));
      camera.position.z += wide * 1.5;
      camera.position.y += wide * .35;
    }
    if (attacking && critical && hit >= 0 && hit < .7 && !reduced) {
      camera.position.x += Math.sin(hit * 65) * .065 * envelope;
      camera.position.y += Math.cos(hit * 73) * .04 * envelope;
    }
    if (counter && !reduced) {
      // A single short impulse at arrival, fading before the player regains balance.
      const kick = counterFrame.impact;
      camera.position.x += Math.sin(counterFrame.afterHit * 61) * .085 * kick;
      camera.position.y += Math.sin(counterFrame.afterHit * 79) * .05 * kick;
      camera.position.z += kick * .1;
      boss.rotation.x = -.09 * counterFrame.charge + .08 * counterFrame.beam;
    }
    camera.lookAt(look);
    trails.forEach(({ mesh, core, bloom, orb, launchGlow, path }, i) => {
      const visible = !context?.actions && attacking && actorIndex >= 0 && time < showcaseImpactMs / 1000 + 1.5 && (critical || i === 0);
      mesh.visible = core.visible = bloom.visible = orb.visible = visible;
      const progress = clamp(frame.visualMs / showcaseImpactMs, 0, 1);
      for (const trail of [mesh, core, bloom]) trail.geometry.setDrawRange(0, Math.floor(progress * 80) * (trail === core ? 5 : 6) * 6);
      mesh.material.color.set(color); mesh.material.opacity = frame.phase === "flight" ? .85 : envelope * .65;
      core.material.opacity = (frame.phase === "flight" ? 1 : envelope) * .95;
      bloom.material.color.set(color); bloom.material.opacity = (frame.phase === "flight" ? 1 : envelope) * .2;
      orb.position.copy(path.getPoint(progress)); orb.scale.setScalar((critical ? .65 : .4) * (frame.phase === "flight" ? 1 : envelope));
      orb.material.color.set(color); orb.material.opacity = reduced ? .25 : .85;
      launchGlow.visible = visible && frame.phase === "flight";
      launchGlow.material.color.set(color); launchGlow.material.opacity = (1 - progress) * (reduced ? .15 : .9);
      launchGlow.scale.setScalar(critical ? .65 : .45);
    });
    teamBeams.forEach((beam) => {
      const member = context?.members[beam.index];
      const action = context?.actions?.find((item) => item.participantId === member?.id && item.action === "attack");
      const active = Boolean(action && attacking && time < 2.15 && (action.multiplier === 2 || beam.side === 0));
      beam.mesh.visible = beam.core.visible = beam.bloom.visible = beam.orb.visible = active;
      beam.glow.visible = active && frame.phase === "flight";
      if (!active || !action) return;
      const tint = action.multiplier === 2 ? 0xffc345 : 0x65dcff;
      const strength = action.multiplier === .5 ? .55 : 1;
      const progress = clamp(frame.visualMs / showcaseImpactMs, 0, 1);
      for (const mesh of [beam.mesh, beam.core, beam.bloom]) mesh.geometry.setDrawRange(0, Math.floor(progress * 80) * 6 * 6);
      beam.mesh.material.color.set(tint); beam.bloom.material.color.set(tint); beam.orb.material.color.set(tint); beam.glow.material.color.set(tint);
      const opacity = (frame.phase === "flight" ? 1 : envelope) * strength;
      beam.mesh.material.opacity = opacity * .8; beam.core.material.opacity = opacity; beam.bloom.material.opacity = opacity * .18;
      beam.orb.position.copy(beam.path.getPoint(progress)); beam.orb.scale.setScalar(action.multiplier === 2 ? .55 : .35); beam.orb.material.opacity = opacity * .85;
      beam.glow.scale.setScalar(.5); beam.glow.material.opacity = (1 - progress) * strength;
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
    const glitterCount = critical || counter ? sparkCount : attacking ? 130 : cue === "heal" ? 100 : cue === "victory" ? 240 : 36;
    starGeometry.setDrawRange(0, glitterCount);
    starMaterial.size = attacking || counter ? .2 : .13;
    starMaterial.opacity = attacking ? envelope : counter ? Math.max(counterFrame.charge * .85, counterFrame.beam, counterFrame.impact) : cue === "heal" || cue === "victory" ? .8 : .28;
    glitter.visible = !reduced && (!attacking || hit >= 0);
    for (let i = 0; i < glitterCount; i++) {
      const seed = seeds[i];
      const spread = .1 + burst * (1 + (i % 7) * .13);
      if (attacking) {
        starPositions[i * 3] = impact.x + seed.x * spread;
        starPositions[i * 3 + 1] = impact.y + seed.y * spread - spread * spread * .8;
        starPositions[i * 3 + 2] = impact.z + seed.z * spread;
      } else if (counter) {
        if (frame.visualMs < counterLaunchMs) {
          // Spiral inward rather than covering the boss with a solid flash.
          const radius = .12 + (1 - (i / sparkCount + time * .85) % 1) * 1.15;
          starPositions[i * 3] = mouth.x + Math.sin(i * 2.4 + time * 4) * radius;
          starPositions[i * 3 + 1] = mouth.y + Math.cos(i * 2.4 + time * 4) * radius * .75;
          starPositions[i * 3 + 2] = mouth.z + seed.z * radius * .25;
        } else if (frame.visualMs < counterImpactMs) {
          const progress = counterFrame.flight * ((i % 53) / 53);
          sampleFan(progress, ((i * 37) % sparkCount) / (sparkCount - 1), direction);
          starPositions[i * 3] = direction.x + Math.sin(i * 2.1 + time * 12) * .05;
          starPositions[i * 3 + 1] = direction.y + Math.cos(i * 2.1 + time * 12) * .14;
          starPositions[i * 3 + 2] = direction.z + seed.z * .035;
        } else {
          const target = targets[i % targets.length];
          const spread = .08 + counterFrame.afterHit * (1 + i % 7 * .12);
          starPositions[i * 3] = target.x + seed.x * spread * .45;
          starPositions[i * 3 + 1] = Math.max(.02, target.y + seed.y * spread - spread * spread * 2);
          starPositions[i * 3 + 2] = target.z + seed.z * spread * .6;
        }
      } else if (cue === "heal") {
        starPositions[i * 3] = attacker.home.x + Math.sin(i * 2.3 + time) * .5;
        starPositions[i * 3 + 1] = (i * .07 + time * .65) % 2.3;
        starPositions[i * 3 + 2] = attacker.home.z + Math.cos(i * 2.3 + time) * .5;
      } else {
        starPositions[i * 3] = seed.x * 1.5;
        starPositions[i * 3 + 1] = (seed.y + time * .14 + i * .03) % 4;
        starPositions[i * 3 + 2] = seed.z + 1;
      }
      const twinkle = .5 + .5 * Math.sin(time * 5 + i * 2.7) ** 6;
      starColors[i * 3] = (cue === "heal" ? .45 : counter ? .35 + (i % 4) * .2 : 1) * twinkle;
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
    const heal = !context?.actions && cue === "heal" ? Math.max(0, Math.sin(clamp(time / 3, 0, 1) * Math.PI)) : 0;
    healing.position.set(attacker.home.x, .02, attacker.home.z);
    healingGlow.position.set(attacker.home.x, .55, attacker.home.z);
    healing.material.opacity = heal; healing.scale.setScalar(1 + heal * .35);
    healingGlow.material.opacity = heal * .7; healingGlow.scale.set(1.4, 2.2, 1);
    teamHealing.forEach(({ ring, glow }, i) => {
      const action = context?.actions?.find((item) => item.participantId === context.members[i]?.id && item.action === "heal");
      const pulse = action ? cue === "heal" ? Math.max(0, Math.sin(clamp(time / 2.4, 0, 1) * Math.PI)) : attacking && frame.phase === "reaction" ? envelope : 0 : 0;
      ring.position.set(allies[i].home.x, .025, allies[i].home.z); glow.position.set(allies[i].home.x, .6, allies[i].home.z);
      ring.material.opacity = pulse; ring.scale.setScalar(1 + pulse * .7); glow.material.opacity = pulse * .6; glow.scale.set(1.1, 1.8, 1);
    });
    allies.forEach(({ root, body, arms, legs, home }, i) => {
      // All four react at arrival; vary the pose without staggering the hit.
      const recoil = counter && counterIndices.includes(i) && !reduced ? counterFrame.recoil * [.9, 1, .95, 1.08][i % 4] : 0;
      const slide = counter && counterIndices.includes(i) && !reduced ? counterFrame.slide : 0;
      const ownAction = context?.actions?.find((item) => item.participantId === context.members[i]?.id && item.action === "attack");
      const cast = attacking && (context?.actions ? Boolean(ownAction) : i === actorIndex) ? reduced ? 1 : 1 - ease((time - showcaseImpactMs / 1000 - 1.5) / .5) : 0;
      root.position.copy(home);
      root.position.y = reduced ? 0 : cue === "victory" ? Math.abs(Math.sin(time * 5 + i)) * .15 : Math.sin(time * 3 + i) * .02 * (1 - cast);
      root.position.x += slide * (home.x - mouth.x) * .07; root.position.z += slide * (.29 + i % 2 * .04);
      root.position.y += recoil * .1;
      body.rotation.x = recoil * .72;
      body.rotation.z = recoil * (i % 2 ? -.18 : .18);
      body.position.y = .24 - recoil * .045;
      arms.forEach((arm, index) => {
        arm.rotation.x = -.75 + ((context?.actions ? ownAction?.multiplier === 2 : critical) || index === 0 ? cast * (castArmAngle + .75) : 0) + recoil * 1.6;
        arm.rotation.z = (index ? 1 : -1) * recoil * .65;
      });
      legs.forEach((leg, index) => { leg.rotation.x = recoil * (index ? -.65 : .45); leg.position.z = index ? slide * -.12 : 0; });
    });
    breath.visible = counter;
    fanSheet.geometry.setDrawRange(0, Math.floor(counterFrame.flight * fanRows) * fanColumns * 6);
    fanMaterial.opacity = counterFrame.beam * (reduced ? .06 : .2);
    breathStrands.forEach((mesh) => {
      mesh.geometry.setDrawRange(0, Math.floor(counterFrame.flight * 40) * 5 * 6);
      mesh.material.opacity = counterFrame.beam * (reduced ? .08 : .68);
    });
    breathWaves.forEach((wave, i) => {
      const progress = ((frame.visualMs - counterLaunchMs) / (counterImpactMs - counterLaunchMs) - i * .13);
      wave.visible = counter && progress > 0 && progress <= 1;
      const positions = wave.geometry.attributes.position;
      for (let row = 0; row < 2; row++) for (let column = 0; column <= fanColumns; column++) {
        sampleFan(clamp(progress - row * .035, 0, 1), column / fanColumns, direction);
        positions.setXYZ(row * (fanColumns + 1) + column, direction.x, direction.y, direction.z);
      }
      positions.needsUpdate = true;
      wave.material.opacity = counterFrame.beam * (reduced ? .06 : .75);
    });
    const charge = counter ? counterFrame.charge : 0;
    chargeGlow.material.opacity = charge * (reduced ? .15 : .6);
    chargeCore.material.opacity = charge * (reduced ? .15 : .95);
    chargeGlow.scale.setScalar(.4 + charge * 1.5); chargeCore.scale.setScalar(.1 + charge * .46);
    chargeRings.forEach((ring, i) => {
      ring.visible = counter && charge > 0 && !reduced;
      ring.quaternion.copy(camera.quaternion); ring.rotateX(i ? .75 : -.6); ring.rotateY(time * (i ? -3 : 3));
      ring.scale.setScalar(.3 + charge * .8); ring.material.opacity = charge * .7;
    });
    counterLight.position.copy(counterFrame.impact > 0 ? teamCenter : mouth);
    counterLight.intensity = counter && !reduced ? charge * 6 + counterFrame.impact * 24 : 0;
    counterImpacts.forEach(({ flash, halo, splash }, i) => {
      flash.visible = halo.visible = counter && i < targets.length;
      flash.scale.setScalar(reduced ? .3 : .35 + counterFrame.impact * .95);
      halo.scale.setScalar(reduced ? .4 : .8 + counterFrame.impact * 1.4);
      flash.material.opacity = counterFrame.impact * (reduced ? .1 : .8);
      halo.material.opacity = counterFrame.impact * (reduced ? .06 : .25);
      splash.visible = counter && i < targets.length && !reduced;
      splash.scale.setScalar(1 + ease(counterFrame.afterHit / .75) * 2.8);
      splash.material.opacity = counterFrame.impact * .85;
    });
    splashStreaks.visible = counter && !reduced;
    splashStreaks.material.opacity = counterFrame.impact * .9;
    for (let i = 0; i < 80; i++) {
      const target = targets[i % targets.length];
      const travel = counterFrame.afterHit;
      transform.position.set(target.x + seeds[i].x * travel * .45, Math.max(.03, .2 + seeds[i].y * travel * 1.4 - travel * travel * 3), target.z + seeds[i].z * travel * .6);
      transform.rotation.set(seeds[i].z, i * .7, seeds[i].x);
      transform.scale.setScalar(counterFrame.impact * (.3 + i % 5 * .15)); transform.updateMatrix(); splashStreaks.setMatrixAt(i, transform.matrix);
    }
    splashStreaks.instanceMatrix.needsUpdate = true;
    confetti.visible = cue === "victory";
    for (let i = 0; i < 100; i++) {
      transform.position.set(Math.sin(i * 17.1) * 6, 4.5 - ((time * (reduced ? .05 : .8) + i * .17) % 5), Math.cos(i * 13.7) * 3);
      transform.rotation.set(time + i, i * 2, time * .8 + i); transform.scale.setScalar(1); transform.updateMatrix(); confetti.setMatrixAt(i, transform.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  };
  return {
    render: draw,
    resize(width: number, height: number) {
      if (disposed || width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
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
