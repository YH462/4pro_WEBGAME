import * as THREE from "three";
import { characterModel, type CharacterModelAsset } from "./character-models";
import { createCharacterMotionPlayer, raidMotionWindowMs, type CharacterMotionCue } from "./character-motion-player";
import { createCharacterModelLibrary, disposeModel } from "./character-model-loader";

type Point = [number, number];
const palettes: Record<string, [number, number, number]> = {
  FOREST: [0x9ad3a5, 0x355b4a, 0xd8f6ad], THUNDER: [0xffd475, 0xd68a33, 0xfff6cb],
  FLAME: [0xff9e7d, 0xb64c51, 0xffe0b5], AQUA: [0x9bdce9, 0x398dad, 0xd9fbfc], LEGEND: [0xd8c3ff, 0x8266bf, 0xfff1b5],
};

/** Temporary solid models based on the existing original character illustrations. Front is +Z. */
export function buildRaidPartner(element: string) {
  const root = new THREE.Group();
  const [light, dark, accent] = palettes[element] ?? palettes.LEGEND;
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .08, flatShading: true });
  const body = material(light), side = material(dark), detail = material(accent);
  const polygon = (points: Point[], front = .3, depth = .35, face = body, raised = false) => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => { if (i) shape.lineTo((x - 120) / 70, (180 - y) / 70); else shape.moveTo((x - 120) / 70, (180 - y) / 70); });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .025, bevelThickness: .025 });
    geometry.translate(0, 0, -depth);
    const mesh = new THREE.Mesh(geometry, [face, side]); mesh.position.z = front; root.add(mesh);
    if (raised) {
      // A faceted, raised front makes the volume legible from a fixed front camera.
      const outline=points.map(([x,y])=>new THREE.Vector2((x-120)/70,(180-y)/70));
      if(THREE.ShapeUtils.isClockWise(outline)) outline.reverse();
      const center=outline.reduce((sum,p)=>sum.add(p),new THREE.Vector2()).divideScalar(outline.length);
      const vertices=outline.flatMap((p,i)=>[center.x,center.y,front+.18,p.x,p.y,front+.03,outline[(i+1)%outline.length].x,outline[(i+1)%outline.length].y,front+.03]);
      const cap=new THREE.BufferGeometry(); cap.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3)); cap.computeVertexNormals(); root.add(new THREE.Mesh(cap,face));
    }
    return mesh;
  };
  const eye = (x: number, y: number, width = 11, front = .96, face = detail, tilt = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width / 70, .065, .045), face);
    mesh.position.set((x - 120) / 70, (180 - y) / 70, front); mesh.rotation.z = tilt; root.add(mesh);
  };
  if (element === "FOREST") {
    polygon([[74,91],[51,108],[44,145],[66,152],[85,127]], .1, .45, side);
    polygon([[164,91],[189,108],[196,145],[174,152],[155,127]], .1, .45, side);
    polygon([[86,132],[81,170],[106,172],[116,136]], .25, .5, side);
    polygon([[125,136],[134,172],[160,170],[153,130]], .25, .5, side);
    polygon([[80,92],[100,79],[145,80],[166,94],[154,140],[88,140]], .42, .65, body, true);
    polygon([[88,57],[106,44],[144,50],[154,79],[137,99],[104,96],[85,80]], .72, .75, body, true);
    polygon([[96,52],[98,31],[116,43],[139,30],[142,53]], .48, .45, side);
    polygon([[106,108],[120,99],[134,108],[120,127]], .65, .08, detail);
    eye(106,72); eye(134,72);
    eye(65,123,12,.16,body,-.5); eye(174,123,12,.16,body,-.5);
  } else if (element === "THUNDER") {
    polygon([[140,138],[170,130],[195,102],[193,64],[172,92],[158,87],[168,109],[138,112]], -.08, .32);
    polygon([[93,111],[89,158],[107,170],[138,168],[155,145],[143,110]], .35, .65, body, true);
    polygon([[90,83],[81,38],[113,59],[138,59],[164,36],[158,87],[126,113]], .68, .6);
    polygon([[90,83],[113,59],[138,59],[158,87],[126,113]], .71, .04, body, true);
    polygon([[90,84],[126,113],[154,84],[127,92]], .94, .08, detail);
    polygon([[90,49],[101,75],[110,63]], .74, .06, side);
    polygon([[141,64],[155,48],[149,78]], .74, .06, side);
    eye(107,84,12,.99,side,-.2); eye(136,84,12,.99,side,.2);
    polygon([[119,96],[126,101],[133,96]], 1.02, .09, side);
    polygon([[106,131],[124,144],[118,157],[137,148],[120,132]], .59, .08, detail);
  } else if (element === "FLAME") {
    polygon([[99,100],[54,55],[40,116],[80,100],[87,135]], -.12, .16, side);
    polygon([[143,100],[186,55],[204,116],[165,99],[153,133]], -.12, .16, side);
    polygon([[54,67],[81,97],[51,106]], -.06, .05);
    polygon([[184,67],[159,97],[191,106]], -.06, .05);
    polygon([[147,152],[177,142],[191,123],[190,101],[183,92],[180,109],[182,125],[161,137]], -.1, .2);
    polygon([[183,99],[189,85],[198,101],[195,114]], -.02, .12, detail);
    polygon([[98,92],[82,142],[93,168],[147,168],[159,143],[143,92]], .4, .7, body, true);
    polygon([[100,114],[110,161],[134,161],[143,114]], .64, .08, detail);
    polygon([[94,56],[94,36],[112,51],[134,50],[151,34],[150,66],[157,86],[140,104],[104,102],[87,83]], .75, .65);
    polygon([[94,56],[134,50],[150,66],[157,86],[140,104],[104,102],[87,83]], .78, .03, body, true);
    eye(107,76,12,1.02,detail,-.25); eye(134,76,12,1.02,detail,.25);
  } else if (element === "AQUA") {
    const profile = [[.12,0],[.38,.07],[.55,.25],[.58,.55],[.55,.9],[.48,1.22],[.34,1.57],[.15,1.94],[0,2.17]].map(([x,y]) => new THREE.Vector2(x,y));
    root.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 16), body));
    polygon([[84,110],[60,116],[50,130],[60,138],[89,127]], .06, .18);
    polygon([[157,110],[178,117],[187,130],[178,139],[150,129]], .06, .18);
    eye(103,112,10,.59,side); eye(137,112,10,.59,side);
    polygon([[111,124],[120,130],[129,124],[125,133],[115,133]], .6, .04, side);
    for (const [x,y,r] of [[59,82,9],[181,65,6]]) {
      const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(r / 70, 1), body); bubble.position.set((x-120)/70,(180-y)/70,0); root.add(bubble);
    }
    polygon([[107,59],[98,76],[94,94],[99,95],[104,79],[112,65]], .4, .035, detail);
  } else {
    polygon([[82,95],[63,132],[82,142],[93,120]], .1, .45, side);
    polygon([[157,95],[178,132],[158,142],[147,122]], .1, .45, side);
    polygon([[93,95],[84,154],[105,173],[120,160],[137,173],[158,154],[146,95]], .35, .65);
    polygon([[88,64],[94,92],[119,108],[148,92],[154,64],[136,45],[106,45]], .7, .7, body, true);
    polygon([[94,50],[85,30],[108,40],[120,22],[133,40],[156,29],[145,51]], .65, .25, detail);
    eye(107,75); eye(134,75);
    polygon([[120,112],[137,130],[120,150],[103,130]], .43, .1, detail);
    eye(120,130,17,.58,side);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(.045,.26,.04),side); cross.position.set(0,50/70,.58); root.add(cross);
  }
  return root;
}

export function createRaidPartnerArena(canvas: HTMLCanvasElement, element: string, characterId?: string, onModelState?: (state: "loading" | "ready" | "fallback") => void, asset: CharacterModelAsset | null | undefined = characterId ? characterModel(characterId) : undefined) {
  const options = { alpha: true, antialias: true, powerPreference: "low-power" } as const;
  const context = canvas.getContext("webgl2", options) as WebGL2RenderingContext | null;
  if (!context) throw new Error("WebGL2 is unavailable.");
  const renderer = new THREE.WebGLRenderer({ canvas, context, ...options });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0xffffff,0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff,0x76818a,2.2));
  const key = new THREE.DirectionalLight(0xfffaf4,3); key.position.set(-3,5,6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff,1.3); rim.position.set(3,2,-2); scene.add(rim);
  let character: THREE.Object3D = buildRaidPartner(element); scene.add(character);
  const hasModel=Boolean(asset);
  character.visible=!hasModel;
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  const restBounds = new THREE.Box3(), motionBounds = new THREE.Box3();
  const camera = new THREE.OrthographicCamera(-2,2,2,-2,.1,50);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, disposed = false, imported = false, last = -Infinity, dirty = true;
  let motionPlayer: ReturnType<typeof createCharacterMotionPlayer> | undefined;
  let motionCue: (CharacterMotionCue & { startedAt: number }) | null = null;
  let width = 1, height = 1;
  const fit = () => {
    const aspect = width / height, half = Math.max(size.y * .57, size.x * .57 / aspect);
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.position.set(center.x, center.y, Math.max(8, size.z + 3)); camera.lookAt(center);
    camera.updateProjectionMatrix(); dirty = true;
  };
  const measure = () => {
    const bounds = new THREE.Box3().setFromObject(character);
    restBounds.copy(bounds);
    bounds.getSize(size); bounds.getCenter(center); fit();
  };
  measure(); // Fixed front: no automatic orbit.
  const library = createCharacterModelLibrary();
  if (characterId && asset) {
    onModelState?.("loading");
    void library.load(characterId,asset).then((model) => {
      if (disposed) return;
      scene.remove(character); disposeModel(character);
      character = model; imported = true; scene.add(character); measure();
      motionPlayer = createCharacterMotionPlayer(model, library, asset.motions);
      void motionPlayer.ready.then(()=>{
        if(disposed)return;
        // Keep one camera framing for idle, attack and heal. Changing it only
        // during an action made the character appear to jump/shrink on start.
        character.position.y=0;
        if(motionPlayer?.bounds(motionBounds)){
          motionBounds.union(restBounds);motionBounds.getSize(size);motionBounds.getCenter(center);fit();
        }
        canvas.dataset.raidMotionsReady="true";dirty=true;
      });
      renderer.render(scene,camera); // Reveal the canvas only after the first real-model frame is drawn.
      onModelState?.("ready");
    }).catch((error: unknown) => {
      if (!disposed) {
        console.warn(`Could not load character model: ${characterId}`, error);
        character.visible=true; dirty=true; renderer.render(scene,camera); onModelState?.("fallback");
      }
    });
  }
  const changed = () => { dirty = true; }; motion.addEventListener("change",changed);
  const draw = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden || (!dirty && (motion.matches || now-last<30))) return;
    dirty=false; last=now;
    const progress = motionCue ? (now - motionCue.startedAt) / raidMotionWindowMs : 1;
    const active = motionPlayer?.sample(motion.matches ? null : motionCue?.action ?? null, progress);
    canvas.dataset.raidMotion = active ? motionCue!.action : "idle";
    character.position.y = motion.matches ? 0 : Math.sin(now/900)*.015;
    renderer.render(scene,camera);
  };
  frame=requestAnimationFrame(draw);
  return {
    play(cue: CharacterMotionCue | null) {
      if (cue?.key === motionCue?.key && cue?.action === motionCue?.action) return;
      motionCue = cue ? { ...cue, startedAt: performance.now() } : null;
      dirty = true;
    },
    resize(nextWidth: number,nextHeight: number) {
      if (disposed || nextWidth<=0 || nextHeight<=0) return;
      width = nextWidth; height = nextHeight;
      renderer.setSize(width,height,false); fit();
    },
    dispose() {
      if (disposed) return;
      disposed=true; cancelAnimationFrame(frame); motion.removeEventListener("change",changed);
      // Imported resources belong to the library; the procedural fallback belongs to this arena.
      if (character.parent) scene.remove(character);
      if (!imported) disposeModel(character);
      motionPlayer?.dispose(); library.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
