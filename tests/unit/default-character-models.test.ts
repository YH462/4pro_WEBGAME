import { describe,it,expect,vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { importDefaultCharacterModels } from "../../src/lib/default-character-models";
import { characterModels } from "../../src/lib/character-models";
describe("default model import",()=>{
  it("preserves staff uploads and removals on every later seed run",async()=>{
    const findUnique=vi.fn().mockResolvedValue({modelConfigured:true}),transaction=vi.fn();
    await importDefaultCharacterModels({character:{findUnique},$transaction:transaction} as unknown as PrismaClient);
    expect(findUnique).toHaveBeenCalledTimes(Object.keys(characterModels).length);expect(transaction).not.toHaveBeenCalled();
  });
});
