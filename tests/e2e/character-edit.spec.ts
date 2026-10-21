import { test,expect,type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID,randomBytes,createHash,randomInt } from "node:crypto";
import sharp from "sharp";
import { hashAdminPassword } from "../../src/lib/admin-password";
const db=new PrismaClient(),headers={origin:"http://localhost:3000"},eventId=process.env.EVENT_ID||"local-exhibition";
const adminIds:string[]=[],playerIds:string[]=[],characterIds:string[]=[],imageIds:string[]=[],tagIds:string[]=[],names:string[]=[];
async function fixture() {
  const id=`edit-${randomUUID()}`;
  const character=await db.character.create({data:{id,name:"仮編集確認",description:"テスト前",element:"FOREST",isDraft:true,baseHp:100,baseAttack:20,baseDefense:20,baseSpeed:10,sortOrder:10000+randomInt(1000000)}});characterIds.push(id);return character;
}
async function admin(page:Page) {
  const username=`edit_${randomUUID().slice(0,8)}`,password=randomUUID();
  const user=await db.adminUser.create({data:{username,passwordHash:await hashAdminPassword(password)}});adminIds.push(user.id);names.push(username);
  expect((await page.request.post("/api/admin/login",{headers,data:{username,password}})).status()).toBe(200);
}
const editData=(character:Awaited<ReturnType<typeof fixture>>,extra:Record<string,unknown>={})=>({name:character.name,description:character.description,element:character.element,baseHp:character.baseHp,baseAttack:character.baseAttack,baseDefense:character.baseDefense,baseSpecialChargeRate:character.baseSpecialChargeRate,isDraft:character.isDraft,revision:character.revision,imageAction:"keep",...extra});
test.afterEach(async()=>{
  const images=await db.character.findMany({where:{id:{in:characterIds}},select:{imageId:true}});imageIds.push(...images.flatMap((item)=>item.imageId?[item.imageId]:[]));
  await db.rateLimitBucket.deleteMany({where:{key:{in:[...adminIds.map((id)=>`admin-edit:${id}`),...names.map((name)=>`admin-login:${createHash("sha256").update(name).digest("hex")}`)]}}});
  await db.player.deleteMany({where:{id:{in:playerIds.splice(0)}}});
  await db.acquisitionTag.deleteMany({where:{id:{in:tagIds.splice(0)}}});
  await db.character.deleteMany({where:{id:{in:characterIds.splice(0)}}});
  await db.characterImage.deleteMany({where:{id:{in:imageIds.splice(0)}}});
  await db.adminUser.deleteMany({where:{id:{in:adminIds.splice(0)}}});names.splice(0);
});
test.afterAll(async()=>{await db.$disconnect();});

test("editing a draft keeps its NFC URL, ownership and growth while updating all character displays",async({page},testInfo)=>{
  const character=await fixture();await admin(page);
  const token=randomBytes(32).toString("base64url");
  const tag=await db.acquisitionTag.create({data:{characterId:character.id,eventId,tokenHash:createHash("sha256").update(token).digest("hex")}});tagIds.push(tag.id);
  const response=await page.request.post("/api/guest",{headers,data:{nickname:"編集確認"}});const {player}=await response.json();playerIds.push(player.id);
  const owned=await db.playerCharacter.create({data:{playerId:player.id,characterId:character.id,hpGrowth:17}});
  await page.setViewportSize({width:390,height:844});await page.goto(`/admin/characters/${character.id}`);
  await page.getByLabel("キャラ名",{exact:true}).fill("クリスタルパートナー");
  await page.getByLabel("紹介文",{exact:true}).fill("本番用の紹介文です。\n展示を楽しもう。");
  await page.getByLabel("属性",{exact:true}).selectOption("AQUA");
  await page.getByLabel("基本HP",{exact:true}).fill("230");
  await page.getByLabel("基本攻撃",{exact:true}).fill("55");
  await page.getByLabel("基本防御",{exact:true}).fill("40");
  await page.getByLabel("仮キャラ（開発中）として表示する",{exact:true}).uncheck();
  const png=await sharp({create:{width:120,height:160,channels:4,background:{r:0,g:180,b:230,alpha:.8}}}).png().toBuffer();
  await page.getByLabel("キャラ画像",{exact:true}).setInputFiles({name:"partner.png",mimeType:"image/png",buffer:png});
  await page.getByRole("button",{name:"キャラ情報を保存",exact:true}).click();
  await expect(page.getByText("キャラクター情報を保存しました。発行済みのURLはそのまま使えます。",{exact:true})).toBeVisible();
  const saved=await db.character.findUniqueOrThrow({where:{id:character.id}});imageIds.push(saved.imageId!);
  expect(saved).toMatchObject({name:"クリスタルパートナー",baseHp:230,baseAttack:55,isDraft:false,revision:1});
  expect(await db.acquisitionTag.findUnique({where:{id:tag.id}})).toEqual(tag);
  expect(await db.playerCharacter.findUnique({where:{id:owned.id}})).toEqual(owned);
  const asset=await page.request.get(`/api/character-images/${saved.imageId}`);expect(asset.status()).toBe(200);expect(asset.headers()["content-type"]).toBe("image/webp");
  expect((await sharp(await asset.body()).metadata()).format).toBe("webp");
  await page.reload();await expect(page.getByLabel("キャラ名",{exact:true})).toHaveValue("クリスタルパートナー");
  await expect(page.getByLabel("仮キャラ（開発中）として表示する",{exact:true})).not.toBeChecked();
  await page.getByRole("heading",{name:"キャラクターを編集",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("character-editor-mobile.png")});
  await page.goto(`/acquire/${token}`);await expect(page.getByRole("heading",{name:"クリスタルパートナー",exact:true})).toBeVisible();
  await expect(page.locator('[data-character-image="custom"] image')).toHaveAttribute("href",`/api/character-images/${saved.imageId}`);
  await page.goto(`/collection/${character.id}`);await expect(page.getByRole("heading",{name:"クリスタルパートナー",exact:true})).toBeVisible();
  await expect(page.getByText("247",{exact:true})).toBeVisible();
  await page.goto("/battle");
  await page.getByRole("button",{name:"クリスタルパートナーを選択",exact:true}).click();
  await page.getByRole("button",{name:"このキャラで対戦",exact:true}).click();
  await expect(page.getByRole("img",{name:"自分のキャラ：クリスタルパートナー",exact:true}).locator('image')).toHaveAttribute("href",`/api/character-images/${saved.imageId}`);
  await page.goto("/battle/raid");await expect(page.locator('[data-renderer="image"]')).toBeVisible();
  await expect(page.getByRole("progressbar",{name:"自分のHP（プレビュー）"})).toHaveAttribute("aria-valuenow","247");
  await page.goto(`/admin/characters/${character.id}`);await page.getByRole("button",{name:"画像を外して標準表示に戻す",exact:true}).click();
  await page.getByRole("button",{name:"キャラ情報を保存",exact:true}).click();
  await expect(page.getByText("キャラクター情報を保存しました。発行済みのURLはそのまま使えます。",{exact:true})).toBeVisible();
  expect((await db.character.findUniqueOrThrow({where:{id:character.id}})).imageId).toBeNull();
  expect((await page.request.get(`/api/character-images/${saved.imageId}`)).status()).toBe(404);
});

test("character edits reject unauthorized, unsafe, invalid and stale updates",async({page})=>{
  const character=await fixture();
  const patch=(extra:Record<string,unknown>={},file?:{name:string;mimeType:string;buffer:Buffer},origin=headers.origin)=>page.request.patch(`/api/admin/characters/${character.id}`,{headers:{origin},multipart:{data:JSON.stringify(editData(character,extra)),...(file?{image:file}:{})}});
  expect((await patch()).status()).toBe(401);
  await admin(page);
  expect((await patch({},undefined,"https://evil.example")).status()).toBe(403);
  for(const extra of [{id:"changed"},{isLegendary:true},{departmentId:"civil"},{baseHp:-1},{name:""}])expect((await patch(extra)).status()).toBe(400);
  expect((await patch({imageAction:"replace"},{name:"x.svg",mimeType:"image/svg+xml",buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')})).status()).toBe(415);
  expect((await patch({imageAction:"replace"},{name:"x.png",mimeType:"image/png",buffer:Buffer.from("not an image")})).status()).toBe(400);
  expect((await patch({imageAction:"replace"},{name:"x.png",mimeType:"image/png",buffer:Buffer.alloc(2*1024*1024+1)})).status()).toBe(413);
  const big=await sharp({create:{width:5000,height:1,channels:3,background:"red"}}).png().toBuffer();
  expect((await patch({imageAction:"replace"},{name:"x.png",mimeType:"image/png",buffer:big})).status()).toBe(400);
  const responses=await Promise.all([patch({name:"更新A"}),patch({name:"更新B"})]);
  expect(responses.map((response)=>response.status()).sort()).toEqual([200,409]);
  expect((await db.character.findUniqueOrThrow({where:{id:character.id}})).revision).toBe(1);
});
