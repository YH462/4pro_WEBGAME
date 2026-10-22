import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID,createHash } from "node:crypto";
import { hashAdminPassword } from "../../src/lib/admin-password";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile,rm } from "node:fs/promises";
const db=new PrismaClient(),headers={origin:"http://localhost:3000"},eventId=process.env.EVENT_ID||"local-exhibition";
const admins:string[]=[],players:string[]=[],tags:string[]=[],events:string[]=[],usernames:string[]=[];
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
async function account() {
  const username=`e2e_${randomUUID().slice(0,8)}`,password=`test-${randomUUID()}`;
  const row=await db.adminUser.create({data:{username,passwordHash:await hashAdminPassword(password)}});admins.push(row.id);usernames.push(username);
  return {...row,password};
}
async function login(page:Page,username:string,password:string) {
  const response=await page.request.post("/api/admin/login",{headers,data:{username,password}});expect(response.status()).toBe(200);
}
test.afterEach(async()=>{
  await db.rateLimitBucket.deleteMany({where:{key:{in:[...admins.map((id)=>`admin-tags:${id}`),...usernames.map((name)=>`admin-login:${hash(name)}`),...players.map((id)=>`acquire:${id}`)]}}});
  await db.player.deleteMany({where:{id:{in:players.splice(0)}}});
  await db.acquisitionTag.deleteMany({where:{id:{in:tags.splice(0)}}});
  await db.event.deleteMany({where:{id:{in:events.splice(0)}}});
  await db.adminUser.deleteMany({where:{id:{in:admins.splice(0)}}});usernames.splice(0);
});
test.afterAll(async()=>{await db.$disconnect();});

test("administrator authentication is separate from guests and logout revokes its session",async({page,context},testInfo)=>{
  const admin=await account();
  expect((await page.request.get("/api/admin/tags?characterId=temp-06")).status()).toBe(401);
  await page.goto("/admin/characters/temp-06");await expect(page).toHaveURL(/\/admin\/login$/);
  const guest=await page.request.post("/api/guest",{headers,data:{nickname:"管理画面確認"}});const {player}=await guest.json();players.push(player.id);
  expect((await page.request.get("/api/admin/tags?characterId=temp-06")).status()).toBe(401);
  expect((await page.request.post("/api/admin/login",{headers,data:{username:admin.username,password:"wrong"}})).status()).toBe(401);
  await page.getByLabel("ユーザー名",{exact:true}).fill(admin.username);
  await page.getByLabel("パスワード",{exact:true}).fill(admin.password);
  const authentication=page.waitForResponse((response)=>response.url().endsWith("/api/admin/login")&&response.request().method()==="POST");
  await page.getByRole("button",{name:"ログイン",exact:true}).click();
  await expect(page.getByRole("heading",{name:"キャラクター管理",exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("admin-character-list-desktop.png")});
  const cookie=(await context.cookies()).find((item)=>item.name==="fourpro_admin")!;
  expect(cookie.httpOnly).toBe(true);expect(cookie.value).toHaveLength(43);
  // Check the actual Set-Cookie attribute; Windows WebKit reports None in its cookie inventory.
  expect((await(await authentication).allHeaders())["set-cookie"]).toMatch(/SameSite=Strict/i);
  const session=await db.adminSession.findFirstOrThrow({where:{adminId:admin.id}});expect(session.tokenHash).toBe(hash(cookie.value));expect(session.tokenHash).not.toBe(cookie.value);
  await page.getByRole("button",{name:"ログアウト",exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(await db.adminSession.count({where:{adminId:admin.id}})).toBe(0);
  expect((await(await page.request.get("/api/me")).json()).player.id).toBe(player.id);
  expect((await page.request.get("/api/admin/tags?characterId=temp-06")).status()).toBe(401);
});

test("an administrator issues and toggles an extra character tag without changing the four-department unlock",async({page},testInfo)=>{
  const admin=await account();await login(page,admin.username,admin.password);
  await page.setViewportSize({width:390,height:844});await page.goto("/admin");
  await page.getByLabel("分類",{exact:true}).selectOption("extra");
  await expect(page.getByRole("heading",{name:"仮キャラ 06",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"フォレストゴーレム",exact:true})).toHaveCount(0);
  await page.getByLabel("キャラクターを検索",{exact:true}).fill("temp-06");
  await page.getByRole("link",{name:"編集・タグ管理",exact:true}).click();
  await expect(page.getByRole("heading",{name:"仮キャラ 06",exact:true})).toBeVisible();
  const issuing=page.waitForResponse((response)=>response.url().endsWith("/api/admin/tags")&&response.request().method()==="POST");
  await page.getByRole("button",{name:"このキャラのタグを発行",exact:true}).click();
  const response=await issuing;expect(response.status()).toBe(201);const issued=await response.json();tags.push(issued.tag.id);
  expect(issued.qrImage).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByRole("img",{name:"キャラ獲得用QRコード"})).toBeVisible();
  await expect(page.getByRole("button",{name:"URLをコピー",exact:true})).toBeVisible();
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"URLを保存",exact:true}).click();
  expect((await download).suggestedFilename()).toBe(`nfc-${issued.tag.id}.json`);
  await page.screenshot({path:testInfo.outputPath("admin-extra-tag-mobile.png")});
  const token=new URL(issued.tag.url).pathname.split("/").at(-1)!;
  expect((await db.acquisitionTag.findUniqueOrThrow({where:{id:issued.tag.id}})).characterId).toBe("temp-06");
  const guest=await page.request.post("/api/guest",{headers,data:{nickname:"追加キャラ獲得"}});const {player}=await guest.json();players.push(player.id);
  const acquire=()=>page.request.post("/api/acquisitions",{headers,data:{token}});
  expect(await(await acquire()).json()).toMatchObject({character:{id:"temp-06"},departmentCount:0,legend:null,acquired:true});
  await page.getByRole("button",{name:`${issued.tag.id}を無効にする`,exact:true}).click();
  await expect(page.getByRole("button",{name:`${issued.tag.id}を有効にする`,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await acquire()).status()).toBe(404);
  await page.getByRole("button",{name:`${issued.tag.id}を有効にする`,exact:true}).click();
  await expect(page.getByRole("button",{name:`${issued.tag.id}を無効にする`,exact:true})).toBeVisible();
  expect(await(await acquire()).json()).toMatchObject({acquired:false,departmentCount:0,legend:null});
  expect(await db.playerCharacter.count({where:{playerId:player.id,characterId:"four-pro"}})).toBe(0);
});

test("admin tag APIs reject forged origins, foreign events and legendary targets",async({page})=>{
  const admin=await account();await login(page,admin.username,admin.password);
  const issue=(data:unknown,origin=headers.origin)=>page.request.post("/api/admin/tags",{headers:{origin},data});
  expect((await issue({characterId:"temp-06",origin:headers.origin},"https://evil.example")).status()).toBe(403);
  expect((await issue({characterId:"temp-06",origin:"https://evil.example"})).status()).toBe(400);
  expect((await issue({characterId:"four-pro",origin:headers.origin})).status()).toBe(409);
  expect((await issue({characterId:"missing-character",origin:headers.origin})).status()).toBe(404);
  expect((await issue({characterId:"temp-06",origin:headers.origin,playerId:randomUUID()})).status()).toBe(400);
  const event=await db.event.create({data:{id:`e2e-admin-${randomUUID()}`,name:"別イベント"}});events.push(event.id);
  const foreign=await db.acquisitionTag.create({data:{eventId:event.id,characterId:"temp-06",tokenHash:hash(randomUUID())}});tags.push(foreign.id);
  expect((await page.request.patch(`/api/admin/tags/${foreign.id}`,{headers,data:{enabled:false}})).status()).toBe(404);
  expect((await db.acquisitionTag.findUniqueOrThrow({where:{id:foreign.id}})).enabled).toBe(true);
  await page.goto("/admin/characters/four-pro");
  await expect(page.getByRole("heading",{name:"解放条件",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"このキャラのタグを発行",exact:true})).toHaveCount(0);
  await db.adminSession.updateMany({where:{adminId:admin.id},data:{expiresAt:new Date(Date.now()-1000)}});
  expect((await page.request.get("/api/admin/tags?characterId=temp-06")).status()).toBe(401);
  await login(page,admin.username,admin.password);
  await db.adminUser.update({where:{id:admin.id},data:{enabled:false}});
  expect((await issue({characterId:"temp-06",origin:headers.origin})).status()).toBe(401);
});

test("admin provisioning CLI generates credentials and resets revoke active sessions",async({page})=>{
  const username=`e2e_cli_${randomUUID().slice(0,8)}`;usernames.push(username);
  const execute=promisify(execFile);
  const cli=(action:string)=>execute(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/admin-user.ts",action,username],{env:process.env});
  const files:string[]=[];
  try {
    const created=await cli("create");const first=created.stdout.match(/Credentials: (.+)/)![1].trim();files.push(first);
    const credentials=JSON.parse(await readFile(first,"utf8"));
    const admin=await db.adminUser.findUniqueOrThrow({where:{username}});admins.push(admin.id);
    expect(admin.passwordHash).not.toContain(credentials.password);
    await login(page,username,credentials.password);
    const reset=await cli("reset");files.push(reset.stdout.match(/Credentials: (.+)/)![1].trim());
    expect((await page.request.get("/api/admin/tags?characterId=temp-06")).status()).toBe(401);
    expect((await page.request.post("/api/admin/login",{headers,data:credentials})).status()).toBe(400); // extra loginPath rejected
    const latest=JSON.parse(await readFile(files[1],"utf8"));
    expect(latest.password).not.toBe(credentials.password);
    await login(page,username,latest.password);
    await cli("disable");
    expect((await page.request.get("/api/admin/tags?characterId=temp-06")).status()).toBe(401);
  } finally {for(const file of files)await rm(file,{force:true});}
});
