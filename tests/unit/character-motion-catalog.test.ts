import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
const { findUnique } = vi.hoisted(()=>({findUnique:vi.fn()}));
vi.mock("../../src/lib/db",()=>({db:{characterModel:{findUnique}}}));
import { characterMotionsForModel } from "../../src/lib/character-motion-catalog";

describe("motion-to-model matching",()=>{
  it("only attaches motions to identical known model bytes with the matching facing",async()=>{
    findUnique.mockResolvedValueOnce({data:await readFile("public/models/characters/denrako.glb")});
    const first = await characterMotionsForModel("temp-09","known-denrako",0);
    expect(first?.attack?.url).toBe("/models/motions/denrako-attack.glb");
    const calls=findUnique.mock.calls.length;
    expect(await characterMotionsForModel("temp-09","known-denrako",0)).toBe(first);
    expect(findUnique).toHaveBeenCalledTimes(calls);
    findUnique.mockResolvedValueOnce({data:Buffer.from("staff replacement")});
    expect(await characterMotionsForModel("temp-09","staff-replacement",0)).toBeUndefined();
    expect(await characterMotionsForModel("temp-09","known-denrako",-90)).toBeUndefined();
    expect(await characterMotionsForModel("temp-12","unrelated",-90)).toBeUndefined();
    expect(await characterMotionsForModel("toString","unrelated",0)).toBeUndefined();
  });
  for(const [id,file,yaw,heal] of [["forest-golem","m.glb",-90,true],["flame-dragon","s.glb",-90,true],["temp-07","pasocon-mon.glb",-90,false],["temp-10","toshokan.glb",0,true]] as const){
    it(`attaches the new ${id} motions only to its unchanged registered model`,async()=>{
      findUnique.mockResolvedValueOnce({data:await readFile(`public/models/characters/${file}`)});
      const motions=await characterMotionsForModel(id,`additional-motion-${id}`,yaw);
      if(id==="flame-dragon")expect(motions).not.toHaveProperty("attack");
      else expect(motions?.attack?.url).toMatch(/-attack\.glb$/);
      expect(Boolean(motions?.heal)).toBe(heal);
      expect(await characterMotionsForModel(id,`additional-motion-${id}`,yaw+1)).toBeUndefined();
    });
  }
});
