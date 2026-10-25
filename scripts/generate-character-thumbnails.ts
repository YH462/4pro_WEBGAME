import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import sharp from "sharp";
import { readFile,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { characterModels,characterModelUrl,type CharacterModelAsset } from "../src/lib/character-models";

// Run with the local server and DB active. No administrator passwords are needed.
const db=new PrismaClient(),origin=process.env.APP_URL||"http://localhost:3000";
const bundle=await build({entryPoints:["src/lib/character-thumbnail.ts"],bundle:true,format:"iife",globalName:"CharacterThumbnails",platform:"browser",write:false});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();await page.goto(`${origin}/start`);await page.addScriptTag({content:bundle.outputFiles[0].text});
  const bundled=process.argv.includes("--bundled"),additional=process.argv.includes("--additional");
  const characters=bundled?Object.entries(characterModels).filter(([,asset])=>!additional||Boolean(asset.displayName)).map(([id,asset])=>({id,modelId:null,modelYaw:asset.yaw*180/Math.PI,model:null})):await db.character.findMany({where:{modelId:{not:null}},select:{id:true,modelId:true,modelYaw:true,model:{select:{data:true}}}});
  for(const character of characters) {
    const initial=characterModels[character.id];
    const asset=bundled?initial:{url:characterModelUrl(character.modelId)!,yaw:character.modelYaw*Math.PI/180};
    const bytes=await page.evaluate(async(asset:CharacterModelAsset)=>{
      const renderer=(window as unknown as {CharacterThumbnails:{renderCharacterThumbnail:(asset:CharacterModelAsset)=>Promise<Blob>}}).CharacterThumbnails;
      return Array.from(new Uint8Array(await (await renderer.renderCharacterThumbnail(asset)).arrayBuffer()));
    },asset);
    const image=await sharp(Buffer.from(bytes)).webp({quality:90,alphaQuality:100}).toBuffer();
    if(bundled){await writeFile(resolve("public",initial.url.slice(1).replace(/\.glb$/,".webp")),image);console.log(`${character.id}: bundled thumbnail created`);continue;}
    const updated=await db.$transaction(async(tx)=>{
      await tx.$queryRaw`SELECT "id" FROM "Character" WHERE "id"=${character.id} FOR UPDATE`;
      const current=await tx.character.findUniqueOrThrow({where:{id:character.id}});
      if(current.modelId!==character.modelId||current.modelYaw!==character.modelYaw)return false;
      const stored=await tx.characterImage.create({data:{contentType:"image/webp",data:new Uint8Array(image)}});
      await tx.character.update({where:{id:character.id},data:{imageId:stored.id,revision:{increment:1}}});
      if(current.imageId)await tx.characterImage.delete({where:{id:current.imageId}});
      return true;
    },{timeout:15000});
    if(updated&&initial&&character.modelYaw===initial.yaw*180/Math.PI&&character.model&&Buffer.from(character.model.data).equals(await readFile(resolve("public",initial.url.slice(1)))))await writeFile(resolve("public",initial.url.slice(1).replace(/\.glb$/,".webp")),image);
    console.log(`${character.id}: ${updated?"thumbnail updated":"skipped; model changed during rendering"}`);
  }
}finally {await browser.close();await db.$disconnect();}
