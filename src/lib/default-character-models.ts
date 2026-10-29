import type { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { characterModels } from "./character-models";
import { validateCharacterModel } from "./character-model-validation";

/** Import the bundled models once. Staff edits and removals survive seed reruns. */
export async function importDefaultCharacterModels(db: PrismaClient, onlyId?: string) {
  if(onlyId&&!Object.hasOwn(characterModels,onlyId))throw new Error(`Unknown bundled character: ${onlyId}`);
  for (const [id, asset] of Object.entries(characterModels)) {
    if(onlyId&&id!==onlyId)continue;
    const character=await db.character.findUnique({where:{id},select:{modelConfigured:true}});
    if(!character||character.modelConfigured)continue;
    const data=await validateCharacterModel(await readFile(resolve("public",asset.url.slice(1))));
    const thumbnail=await readFile(resolve("public",asset.url.slice(1).replace(/\.glb$/,".webp")));
    await db.$transaction(async(tx)=>{
      await tx.$queryRaw`SELECT "id" FROM "Character" WHERE "id"=${id} FOR UPDATE`;
      const current=await tx.character.findUniqueOrThrow({where:{id},select:{modelConfigured:true,name:true,description:true,departmentId:true,isLegendary:true,imageId:true}});
      if(current.modelConfigured)return;
      if(asset.displayName&&(current.departmentId||current.isLegendary))throw new Error(`Additional model cannot replace a department or legendary character: ${id}`);
      const model=await tx.characterModel.create({data:{data:new Uint8Array(data),fileName:asset.url.split("/").pop()!,byteLength:data.length}});
      const image=await tx.characterImage.create({data:{contentType:"image/webp",data:new Uint8Array(thumbnail)}});
      const identity=asset.displayName?{isDraft:false,...(current.name===`仮キャラ ${asset.code}`?{name:asset.displayName}:{}),...(current.description.startsWith("CPU対戦を試すための仮キャラクター")?{description:"紹介文は作成者に確認後、管理画面で設定します。"}:{})}:{};
      await tx.character.update({where:{id},data:{...identity,modelId:model.id,imageId:image.id,modelYaw:asset.yaw*180/Math.PI,modelConfigured:true,revision:{increment:1}}});
      if(current.imageId)await tx.characterImage.delete({where:{id:current.imageId}});
    },{timeout:15000});
  }
}
