import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { combineCharacterMotion } from "../../src/lib/character-motion-clip";
import { createCharacterMotionPlayer } from "../../src/lib/character-motion-player";
import { createCharacterModelLibrary } from "../../src/lib/character-model-loader";
import { inspectCharacterGLB } from "../../src/lib/character-glb";
import { validateCharacterModel } from "../../src/lib/character-model-validation";
import manifest from "../../src/lib/bundled-character-motions.json";

describe("raid character motions", () => {
  it("bakes the M attack's different source facing into the asset instead of changing the DB model yaw", async () => {
    const rotations = [];
    for (const action of ["attack", "heal"]) {
      const {doc}=inspectCharacterGLB(await readFile(`public/models/motions/m-${action}.glb`));
      rotations.push(doc.nodes.find((node:{name?:string})=>node.name==="RaidMotionOrientation").rotation??[0,0,0,1]);
    }
    expect(rotations[0]).toEqual([0,0,0,1]);
    expect(rotations[1][1]).toBeCloseTo(-Math.SQRT1_2);
    expect(manifest["forest-golem"].baseYaw).toBe(-90);
    const {doc}=inspectCharacterGLB(await readFile("public/models/motions/s-heal.glb"));
    expect(doc.nodes.find((node:{name?:string})=>node.name==="RaidMotionOrientation").rotation??[0,0,0,1]).toEqual([0,0,0,1]);
    expect(manifest["flame-dragon"].baseYaw).toBe(-90);
  });
  it("combines object actions and removes leading empty time without editing shared clips", () => {
    const body = new THREE.VectorKeyframeTrack("body.position", [5, 6], [0, 0, 0, 1, 0, 0]);
    const arm = new THREE.VectorKeyframeTrack("arm.position", [5, 5.5, 6], [0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const fixed = new THREE.VectorKeyframeTrack("fixed.scale", [0], [1, 1, 1]);
    const combined = combineCharacterMotion([new THREE.AnimationClip("body", 6, [body, fixed]), new THREE.AnimationClip("arm", 6, [arm])]);
    expect(combined.duration).toBe(1);
    expect(combined.tracks).toHaveLength(3);
    expect([...combined.tracks[0].times]).toEqual([0, 1]);
    expect([...combined.tracks[1].times]).toEqual([0]);
    expect([...body.times]).toEqual([5, 6]);
  });

  it("keeps two participants' poses separate and restores the original at the end", async () => {
    const motion = () => {
      const group = new THREE.Group(), bone = new THREE.Group(); bone.name = "bone"; group.add(bone);
      group.animations = [new THREE.AnimationClip("motion", 1, [new THREE.VectorKeyframeTrack("bone.position", [0, 1], [0, 0, 0, 2, 0, 0])])];
      return group;
    };
    const library = { load: async () => motion() } as unknown as ReturnType<typeof createCharacterModelLibrary>;
    const first = new THREE.Group(), second = new THREE.Group();
    const firstStatic = new THREE.Group(), secondStatic = new THREE.Group(); first.add(firstStatic); second.add(secondStatic);
    const assets = { attack: { url: "/attack.glb", yaw: 0 }, heal: { url: "/heal.glb", yaw: 0 } };
    const one = createCharacterMotionPlayer(first, library, assets), two = createCharacterMotionPlayer(second, library, assets);
    await Promise.all([one.ready, two.ready]);
    expect(one.sample("attack", .8)).toBe(true); expect(two.sample("heal", .3)).toBe(true);
    const visibleBone = (root: THREE.Group) => root.children.find(child=>child.visible)!.getObjectByName("bone")!;
    expect(visibleBone(first).position.x).toBeCloseTo(1.6);
    expect(visibleBone(second).position.x).toBeCloseTo(.6);
    one.sample("attack", 1);
    expect(firstStatic.visible).toBe(true); expect(secondStatic.visible).toBe(false);
    expect(visibleBone(second).position.x).toBeCloseTo(.6);
    one.dispose(); two.dispose();
    expect(first.children).toEqual([firstStatic]); expect(second.children).toEqual([secondStatic]);
  });

  it("leaves models without motion assets unchanged", async () => {
    const base = new THREE.Group(), original = new THREE.Group(); base.add(original);
    const library = { load: () => { throw new Error("Should not load"); } } as unknown as ReturnType<typeof createCharacterModelLibrary>;
    const player = createCharacterMotionPlayer(base, library, undefined); await player.ready;
    expect(player.sample("attack", .5)).toBe(false); expect(original.visible).toBe(true);
    player.dispose(); expect(base.children).toEqual([original]);
  });

  it("uses one framing envelope for idle, attack and heal instead of changing the camera per action",async()=>{
    const library={load:async(id:string)=>{
      const model=new THREE.Group(),bone=new THREE.Group();bone.name="bone";model.add(bone);
      model.animations=[new THREE.AnimationClip("move",1,[new THREE.VectorKeyframeTrack("bone.position",[0,1],[0,0,0,1,0,0])])];
      model.userData.motionBounds=id==="motion-attack"?{min:[-2,0,-1],max:[2,3,1]}:{min:[-1,0,-2],max:[1,2,2]};
      return model;
    }} as unknown as ReturnType<typeof createCharacterModelLibrary>;
    const base=new THREE.Group();base.add(new THREE.Group());
    const player=createCharacterMotionPlayer(base,library,{attack:{url:"/attack.glb",yaw:0},heal:{url:"/heal.glb",yaw:0}});
    await player.ready;
    for(const kind of [null,"attack","heal",null] as const){
      player.sample(kind,.5);
      const bounds=new THREE.Box3();expect(player.bounds(bounds)).toBe(true);
      expect(bounds.min.toArray()).toEqual([-2,0,-2]);expect(bounds.max.toArray()).toEqual([2,3,2]);
    }
    player.dispose();
  });

  it("retains both mirrored halves and the skin in the boss attack",async()=>{
    const bytes=await readFile("public/models/motions/des-dragoon-red-attack.glb");
    await validateCharacterModel(bytes);
    const {doc}=inspectCharacterGLB(bytes);
    const body=doc.nodes.find((node:{name?:string})=>node.name==="Cube");
    expect(body.skin).toBeTypeOf("number");
    expect(doc.animations.length).toBeGreaterThan(0);
    const positions=doc.meshes[body.mesh].primitives.map((p:{attributes:{POSITION:number}})=>doc.accessors[p.attributes.POSITION]);
    expect(Math.min(...positions.map((p:{min:number[]})=>p.min[0]))).toBeLessThan(-.5);
    expect(Math.max(...positions.map((p:{max:number[]})=>p.max[0]))).toBeGreaterThan(.5);
  });

  for(const kind of ["attack","heal"]) it(`E ${kind} excludes the source-hidden construction meshes but retains the character and authored effects`,async()=>{
    const {doc}=inspectCharacterGLB(await readFile(`public/models/motions/e-${kind}.glb`));
    const names=doc.nodes.map((node:{name?:string})=>node.name);
    for(const name of ["立方体","ヘッドホン","平面","平面.001","平面.002","立方体.003","リュック","エンプティ","エンプティ.001","エンプティ.003"])expect(names).not.toContain(name);
    for(const name of ["doutai","asi","kao","me","mimi","atama","PC","tansi","ude","立方体.004","平面.003","平面.005"])expect(names).toContain(name);
    if(kind==="heal")for(const name of ["平面.007","平面.008","平面.009"])expect(names).toContain(name);
  });

  for (const [id, entry] of Object.entries(manifest)) for (const [kind, asset] of Object.entries(entry.motions)) {
    it(`${id} ${kind} is a valid self-contained animated GLB`, async () => {
      const bytes = await readFile(`public${asset.url}`);
      await validateCharacterModel(bytes);
      const { doc } = inspectCharacterGLB(bytes);
      expect(bytes.length).toBeLessThan(7 * 1024 * 1024);
      expect(doc.nodes.some((node: {name?:string}) => node.name === "RaidMotionOrientation")).toBe(true);
      if(["forest-golem","flame-dragon","temp-10"].includes(id))expect(doc.nodes.some((node:{extras?:{raidMotionBody?:boolean}})=>node.extras?.raidMotionBody===true)).toBe(true);
      expect(doc.animations.length).toBeGreaterThan(0);
      expect(doc.animations.some((clip: {samplers:{input:number}[]}) => clip.samplers.some(s=>doc.accessors[s.input].count>1))).toBe(true);
    });
  }
});
