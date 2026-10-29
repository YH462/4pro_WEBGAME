import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { characterModels } from "../../src/lib/character-models";
import { inspectCharacterGLB } from "../../src/lib/character-glb";
import { validateCharacterModel } from "../../src/lib/character-model-validation";
import { characters } from "../../src/lib/master-data";

describe("Keidentera legendary model", () => {
  it("keeps the legendary identity and the remaining placeholder independent", () => {
    expect(characterModels["four-pro"]).toMatchObject({url:"/models/characters/keidentera.glb",yaw:0});
    expect(characterModels["four-pro"].displayName).toBeUndefined();
    expect(characters.find(c=>c.id==="four-pro")).toMatchObject({name:"4プロ",isLegendary:true,baseHp:155});
    expect(characters.find(c=>c.id==="temp-12")).toMatchObject({name:"仮キャラ 12",isDraft:true});
  });

  it("bakes a complete, upright +Z-facing model with no viewer rotation", async () => {
    const bytes=await readFile("public/models/characters/keidentera.glb");
    await validateCharacterModel(bytes);
    const {doc}=inspectCharacterGLB(bytes);
    expect(doc.animations??[]).toEqual([]);
    expect(doc.nodes).toHaveLength(9); // City, head, three thrusters, halo, two solar panels and body.
    for(const node of doc.nodes){
      expect(node.rotation??[0,0,0,1]).toEqual([0,0,0,1]);
      expect(node.scale??[1,1,1]).toEqual([1,1,1]);
      expect(node.translation??[0,0,0]).toEqual([0,0,0]);
      expect(node.matrix).toBeUndefined();
    }
    const bounds=(name:string)=>{
      const node=doc.nodes.find((node:{name:string})=>node.name===name);
      expect(node).toBeDefined();
      const positions=doc.meshes[node.mesh].primitives.map((p:{attributes:{POSITION:number}})=>doc.accessors[p.attributes.POSITION]);
      return {min:[0,1,2].map(axis=>Math.min(...positions.map((a:{min:number[]})=>a.min[axis]))),
        max:[0,1,2].map(axis=>Math.max(...positions.map((a:{max:number[]})=>a.max[axis])))};
    };
    const head=bounds("Cube"),halo=bounds("Cylinder.003");
    expect(head.min[2]).toBeGreaterThan(7);
    expect(halo.min[1]).toBeGreaterThan(head.max[1]);
    for(const name of ["Cylinder","Cylinder.001","Cylinder.002"])expect(bounds(name).max[2]).toBeLessThan(-20);
    expect(bounds("Plane").max[0]).toBeLessThan(-16);
    expect(bounds("Plane.001").min[0]).toBeGreaterThan(16);
  });
});
