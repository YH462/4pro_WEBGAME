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
    expect(await characterMotionsForModel("forest-golem","unrelated",-90)).toBeUndefined();
    expect(await characterMotionsForModel("toString","unrelated",0)).toBeUndefined();
  });
});
