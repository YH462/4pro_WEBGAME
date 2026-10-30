import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes,randomUUID,createHash } from "node:crypto";
import { hashAdminPassword } from "../../src/lib/admin-password";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test.skip(process.env.EVENT_ID!=="raid-production-test"||new URL(process.env.DATABASE_URL??"postgresql://localhost/unused").port!=="55436","Use the isolated test DB.");
const db=new PrismaClient(),origin="http://localhost:13026";
let username=`preview_${randomUUID().slice(0,8)}`;
const password=randomUUID(),guestToken=randomBytes(32).toString("base64url");
let adminId="",guestId="";
test.beforeAll(async()=>{
  const admin=await db.adminUser.create({data:{username,passwordHash:await hashAdminPassword(password)}});adminId=admin.id;
  const guest=await db.player.create({data:{eventId:"raid-production-test",nickname:"未獲得の確認",sessions:{create:{tokenHash:createHash("sha256").update(guestToken).digest("hex"),expiresAt:new Date(Date.now()+600000)}}}});guestId=guest.id;
});

test("one login and one session open every management screen; logout closes them all",async({page},testInfo)=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...args:unknown[]){return kind.includes("webgl")?null:Reflect.apply(original,this,[kind,...args]);} as typeof original;
  });
  let logins=0;page.on("request",request=>{if(new URL(request.url()).pathname==="/api/admin/login"&&request.method()==="POST")logins++;});
  await login(page);const session=(await page.context().cookies()).find(c=>c.name==="fourpro_admin")!.value;
  const menu=()=>page.locator('summary[aria-label="管理メニュー"]');
  const navigate=async(label:string)=>{await menu().click();const navigation=page.getByRole("navigation",{name:"管理画面の切り替え",exact:true});await expect(navigation).toBeInViewport();if(new URL(page.url()).pathname==="/raid/screen")await page.screenshot({path:testInfo.outputPath("shared-admin-screen-menu.png")});await navigation.getByRole("link",{name:label,exact:true}).click();};
  await navigate("統計・CSV");await expect(page).toHaveURL(/\/admin\/statistics$/);
  await expect(page.getByRole("heading",{name:"統計ダッシュボード",exact:true})).toBeVisible();
  await navigate("全キャラ表示");await expect(page).toHaveURL(/\/admin\/preview$/);
  await navigate("会場スクリーン");await expect(page).toHaveURL(/\/raid\/screen$/);
  await expect(menu()).toBeVisible();
  await navigate("キャラクター管理");await expect(page).toHaveURL(/\/admin$/);
  expect(logins).toBe(1);expect((await page.context().cookies()).find(c=>c.name==="fourpro_admin")!.value).toBe(session);
  await page.getByRole("link",{name:"統計・CSV",exact:true}).click();
  await menu().click();await page.getByRole("button",{name:"ログアウト",exact:true}).click();await expect(page).toHaveURL(/\/admin\/login$/);
  for(const path of ["/admin","/admin/statistics","/admin/preview/collection","/raid/screen"]){await page.goto(path);await expect(page).toHaveURL(/\/admin\/login/);}
  expect((await page.request.get("/api/admin/statistics")).status()).toBe(401);
});

test("renaming an administrator preserves the password and shared session, and prevents name conflicts",async({page})=>{
  await login(page);
  const before=await db.adminUser.findUniqueOrThrow({where:{id:adminId}});
  const target=`renamed_${randomUUID().slice(0,8)}`,execute=promisify(execFile);
  await execute(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/admin-user.ts","rename",username.toUpperCase(),target.toUpperCase()],{env:process.env});
  const after=await db.adminUser.findUniqueOrThrow({where:{id:adminId}});expect(after.username).toBe(target);expect(after.passwordHash).toBe(before.passwordHash);username=target;
  expect((await page.request.get("/api/admin/statistics")).status()).toBe(200);
  const response=await page.request.post("/api/admin/login",{headers:{origin},data:{username:target.toUpperCase(),password}});expect(response.status()).toBe(200);
  const conflict=await db.adminUser.create({data:{username:`conflict_${randomUUID().slice(0,8)}`,passwordHash:before.passwordHash}});
  try{await expect(execute(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/admin-user.ts","rename",target,conflict.username],{env:process.env})).rejects.toThrow();expect((await db.adminUser.findUniqueOrThrow({where:{id:adminId}})).username).toBe(target);}
  finally{await db.adminUser.delete({where:{id:conflict.id}});}
});
test.afterAll(async()=>{if(guestId)await db.player.deleteMany({where:{id:guestId}});if(adminId)await db.adminUser.deleteMany({where:{id:adminId}});await db.$disconnect();});
async function login(page:import("@playwright/test").Page){
  await page.goto("/admin/preview");await expect(page).toHaveURL(/\/admin\/login\?next=preview$/);
  await page.getByLabel("ユーザー名",{exact:true}).fill(username);await page.getByLabel("パスワード",{exact:true}).fill(password);
  await page.getByRole("button",{name:"ログイン",exact:true}).click();await expect(page).toHaveURL(/\/admin\/preview$/);
}

test("only administrators can open any preview URL",async({page})=>{
  for(const path of ["/admin/preview","/admin/preview/collection","/admin/preview/collection/four-pro"]){await page.goto(path);await expect(page).toHaveURL(/\/admin\/login\?next=preview$/);}
  await page.context().addCookies([{name:"fourpro_guest",value:guestToken,url:origin}]);
  await page.goto("/admin/preview/collection");await expect(page).toHaveURL(/\/admin\/login\?next=preview$/);
});

test("the preview reveals all home and collection characters without granting ownership or awards",async({page},testInfo)=>{
  const before={players:await db.player.count(),owned:await db.playerCharacter.count(),awards:await db.playerAchievement.count(),rewards:await db.raidReward.count(),rooms:await db.raidRoom.findMany()};
  await login(page);await page.setViewportSize({width:390,height:844});
  await expect(page.locator(".header-tools>span")).toHaveText("全キャラ表示");
  await expect(page.locator('[data-character-locked="true"]')).toHaveCount(0);
  await expect(page.locator('[data-character-image="custom"]')).toHaveCount(5);
  await page.screenshot({path:testInfo.outputPath("admin-home-390.png")});
  await page.getByRole("link",{name:"4学科合同：獲得済み",exact:true}).click();await expect(page).toHaveURL(/\/admin\/preview\/collection\/four-pro$/);
  await expect(page.locator('[data-character-image="custom"]')).toHaveCount(1);
  await page.getByRole("tab",{name:"紹介",exact:true}).click();await expect(page.getByRole("tab",{name:"紹介",exact:true})).toHaveAttribute("aria-selected","true");
  await page.getByRole("link",{name:/^次のキャラクター：/}).click();await expect(page).toHaveURL(/\/admin\/preview\/collection\/temp-06$/);
  await page.getByRole("link",{name:"図鑑に戻る",exact:true}).click();await expect(page).toHaveURL(/\/admin\/preview\/collection$/);
  const count=await db.character.count(),images=await db.character.count({where:{imageId:{not:null}}});
  await expect(page.locator(".collection-card")).toHaveCount(count);
  await expect(page.locator('[data-character-locked="true"]')).toHaveCount(0);
  await expect(page.locator('[data-character-image="custom"]')).toHaveCount(images);
  for(const [width,height] of [[390,844],[375,667],[844,390],[1280,800]]){
    await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`admin-collection-${width}.png`)});
  }
  await page.goto("/collection");await expect(page.locator('[data-character-locked="true"]')).toHaveCount(count);
  const after={players:await db.player.count(),owned:await db.playerCharacter.count(),awards:await db.playerAchievement.count(),rewards:await db.raidReward.count(),rooms:await db.raidRoom.findMany()};expect(after).toEqual(before);
  await page.goto("/admin");await page.getByRole("link",{name:"全キャラ表示",exact:true}).click();await expect(page).toHaveURL(/\/admin\/preview$/);
});

test("swiping stays inside the preview and expired staff sessions cannot see it",async({page})=>{
  await login(page);await page.setViewportSize({width:390,height:844});await page.goto("/admin/preview/collection/four-pro");
  const panel=page.locator('[data-character-id="four-pro"]');
  await panel.dispatchEvent("pointerdown",{pointerType:"touch",pointerId:1,isPrimary:true,clientX:220,clientY:180});
  await panel.dispatchEvent("pointerup",{pointerType:"touch",pointerId:1,isPrimary:true,clientX:100,clientY:180});
  await expect(page).toHaveURL(/\/admin\/preview\/collection\/temp-06$/);
  await db.adminSession.updateMany({where:{adminId},data:{expiresAt:new Date(Date.now()-1000)}});
  await page.goto("/admin/preview/collection/four-pro");await expect(page).toHaveURL(/\/admin\/login\?next=preview$/);
  await expect(page.locator('[data-character-image="custom"]')).toHaveCount(0);
});
