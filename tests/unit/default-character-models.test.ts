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
  it("can restrict an existing environment import to the legendary character",async()=>{
    const findUnique=vi.fn().mockResolvedValue({modelConfigured:true}),transaction=vi.fn();
    await importDefaultCharacterModels({character:{findUnique},$transaction:transaction} as unknown as PrismaClient,"four-pro");
    expect(findUnique).toHaveBeenCalledExactlyOnceWith({where:{id:"four-pro"},select:{modelConfigured:true}});
    expect(transaction).not.toHaveBeenCalled();
    await expect(importDefaultCharacterModels({} as PrismaClient,"unknown")).rejects.toThrow("Unknown bundled character");
  });
  it("adds the legendary model and portrait without changing identity, stats or unlock conditions",async()=>{
    const update=vi.fn(),createModel=vi.fn().mockResolvedValue({id:"new-model"}),createImage=vi.fn().mockResolvedValue({id:"new-image"});
    const tx={$queryRaw:vi.fn(),character:{findUniqueOrThrow:vi.fn().mockResolvedValue({modelConfigured:false,name:"4プロ",description:"staff description",departmentId:null,isLegendary:true,imageId:null}),update},characterModel:{create:createModel},characterImage:{create:createImage}};
    const db={character:{findUnique:vi.fn().mockResolvedValue({modelConfigured:false})},$transaction:vi.fn(async(fn:(tx:unknown)=>Promise<void>)=>fn(tx))};
    await importDefaultCharacterModels(db as unknown as PrismaClient,"four-pro");
    expect(update).toHaveBeenCalledExactlyOnceWith({where:{id:"four-pro"},data:{modelId:"new-model",imageId:"new-image",modelYaw:0,modelConfigured:true,revision:{increment:1}}});
    expect(createModel.mock.calls[0][0].data.fileName).toBe("keidentera.glb");
    expect(createImage.mock.calls[0][0].data.contentType).toBe("image/webp");
  });
  it("registers Kanreki in slot 12 without replacing stats or player data",async()=>{
    const update=vi.fn(),createModel=vi.fn().mockResolvedValue({id:"kanreki-model"}),createImage=vi.fn().mockResolvedValue({id:"kanreki-image"});
    const tx={$queryRaw:vi.fn(),character:{findUniqueOrThrow:vi.fn().mockResolvedValue({modelConfigured:false,name:"仮キャラ 12",description:"CPU対戦を試すための仮キャラクターです。",departmentId:null,isLegendary:false,imageId:null}),update},characterModel:{create:createModel},characterImage:{create:createImage}};
    const db={character:{findUnique:vi.fn().mockResolvedValue({modelConfigured:false})},$transaction:vi.fn(async(fn:(tx:unknown)=>Promise<void>)=>fn(tx))};
    await importDefaultCharacterModels(db as unknown as PrismaClient,"temp-12");
    expect(update).toHaveBeenCalledExactlyOnceWith({where:{id:"temp-12"},data:{name:"還暦",isDraft:false,description:"紹介文は作成者に確認後、管理画面で設定します。",modelId:"kanreki-model",imageId:"kanreki-image",modelYaw:0,modelConfigured:true,revision:{increment:1}}});
    expect(createModel.mock.calls[0][0].data.fileName).toBe("kanreki.glb");
  });
});
