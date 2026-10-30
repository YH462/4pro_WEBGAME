import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashAdminPassword } from "../../src/lib/admin-password";
import type { EventStatistics } from "../../src/lib/event-statistics";

test.skip(process.env.EVENT_ID!=="raid-production-test"||new URL(process.env.DATABASE_URL??"postgresql://localhost/unused").port!=="55436","Use the isolated test database.");
const db=new PrismaClient(),eventId="raid-production-test",origin="http://localhost:13026";
const token=randomBytes(32).toString("base64url"),guestToken=randomBytes(32).toString("base64url"),username=`stats_${randomUUID().slice(0,8)}`,password=randomUUID();
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const headers={origin,cookie:`fourpro_admin=${token}`};
const guestHeaders={origin,cookie:`fourpro_guest=${guestToken}`};
const ids:string[]=[],tagIds:string[]=[];let adminId="",foreignId="";
let baseline:EventStatistics;
const read=async(request:import("@playwright/test").APIRequestContext)=>(await(await request.get("/api/admin/statistics",{headers})).json()).statistics as EventStatistics;

test.beforeAll(async({request})=>{
  await db.event.upsert({where:{id:eventId},create:{id:eventId,name:"統計の専用検証"},update:{status:"ACTIVE",endedAt:null,purgeAt:null}});
  const admin=await db.adminUser.create({data:{username,passwordHash:await hashAdminPassword(password),sessions:{create:{tokenHash:hash(token),expiresAt:new Date(Date.now()+3600_000)}}}});adminId=admin.id;
  baseline=await read(request);
  for(let i=0;i<20;i++){
    const p=await db.player.create({data:{eventId,nickname:i===0?"統計・サクラ":i===1?"=1+1":i===2?null:`統計・参加者${i+1}`,createdAt:new Date(Date.UTC(2026,9,30,1+Math.floor(i/3),i)),...(i===0?{sessions:{create:{tokenHash:hash(guestToken),expiresAt:new Date(Date.now()+3600_000)}}}:{})}});ids.push(p.id);
  }
  await db.playerCharacter.createMany({data:ids.slice(1).map(playerId=>({playerId,characterId:"forest-golem"}))});
  // Exercise the real acquisition/legend unlock flow; no invented analytics events.
  for(const characterId of ["forest-golem","thunder-fox","flame-dragon","aqua-spirit"]){
    const acquisitionToken=randomBytes(32).toString("base64url");
    const tag=await db.acquisitionTag.create({data:{eventId,characterId,tokenHash:hash(acquisitionToken)}});tagIds.push(tag.id);
    const response=await request.post("/api/acquisitions",{headers:guestHeaders,data:{token:acquisitionToken}});expect(response.ok()).toBe(true);
  }
  const roomId=randomUUID();
  for(const playerId of ids){const result=await db.raidResult.create({data:{playerId,roomId,characterId:"forest-golem",characterName:"戦闘時のキャラ名",bossName:"デスドラグーン",won:true,turns:9}});await db.raidReward.create({data:{playerId,raidResultId:result.id,points:100}});}
  foreignId=`stats-foreign-${randomUUID()}`;
  await db.event.create({data:{id:foreignId,name:"別イベント非公開",players:{create:{nickname:"別イベント非公開",characters:{create:{characterId:"forest-golem"}}}}}});
});
test.afterAll(async()=>{
  await db.event.updateMany({where:{id:eventId},data:{status:"ACTIVE",endedAt:null,purgeAt:null}});
  await db.player.deleteMany({where:{id:{in:ids}}});await db.acquisitionTag.deleteMany({where:{id:{in:tagIds}}});
  if(foreignId)await db.event.deleteMany({where:{id:foreignId}});if(adminId)await db.adminUser.deleteMany({where:{id:adminId}});
  await db.$disconnect();
});

test("statistics and every export require staff login; login returns to the dashboard",async({request,page})=>{
  for(const path of ["/api/admin/statistics","/api/admin/statistics/export",... ["summary","participants","collections","raids","raid-participants"].map(file=>`/api/admin/statistics/export?file=${file}`)]){
    expect((await request.get(path)).status()).toBe(401);expect((await request.get(path,{headers:guestHeaders})).status()).toBe(401);
  }
  await page.goto("/admin/statistics");await expect(page).toHaveURL(/\/admin\/login\?next=statistics$/);
  await page.getByLabel("ユーザー名",{exact:true}).fill(username);await page.getByLabel("パスワード",{exact:true}).fill(password);
  await page.getByRole("button",{name:"ログイン",exact:true}).click();await expect(page).toHaveURL(/\/admin\/statistics$/);
  await expect(page.getByRole("heading",{name:"統計ダッシュボード",exact:true})).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("actual acquisitions and a twenty-player battle match dashboard, ledger and CSV without mutating data",async({request,page},testInfo)=>{
  const before={players:await db.player.count(),models:await db.characterModel.count(),rewards:await db.raidReward.count(),rooms:await db.raidRoom.findMany()};
  const response=await request.get("/api/admin/statistics",{headers});expect(response.headers()["cache-control"]).toContain("no-store");
  const data=(await response.json()).statistics as EventStatistics;
  expect(data.summary.registered).toBe(baseline.summary.registered+20);
  expect(data.summary.collectors).toBe(baseline.summary.collectors+20);
  expect(data.summary.complete).toBe(baseline.summary.complete+1);
  expect(data.summary.battles).toBe(baseline.summary.battles+1);
  expect(data.summary.raidPlayers).toBe(baseline.summary.raidPlayers+20);
  expect(data.rankings.collected.find(p=>p.id===ids[0])).toMatchObject({collected:5,departments:4,victories:1,points:100});
  expect(data.sizes.find(s=>s.participants===20)!.battles).toBe((baseline.sizes.find(s=>s.participants===20)?.battles??0)+1);
  expect(JSON.stringify(data)).not.toContain("別イベント非公開");
  const csv=await request.get("/api/admin/statistics/export?file=participants",{headers});
  expect(csv.headers()["content-type"]).toContain("text/csv");const bytes=await csv.body();expect(bytes.subarray(0,3).toString("hex")).toBe("efbbbf");
  expect(bytes.toString()).toContain("'=1+1");expect(bytes.toString()).toContain(ids[0]);expect(bytes.toString()).not.toContain("別イベント非公開");
  for(const file of ["summary","collections","raids","raid-participants"]){const response=await request.get(`/api/admin/statistics/export?file=${file}`,{headers});expect(response.ok()).toBe(true);}
  expect((await request.get("/api/admin/statistics?eventId=other",{headers})).status()).toBe(400);
  expect((await request.get("/api/admin/statistics/export?file=../../.env",{headers})).status()).toBe(400);
  const after={players:await db.player.count(),models:await db.characterModel.count(),rewards:await db.raidReward.count(),rooms:await db.raidRoom.findMany()};expect(after).toEqual(before);
  await page.context().addCookies([{name:"fourpro_admin",value:token,url:origin}]);await page.setViewportSize({width:1680,height:1050});
  await page.goto("/admin/statistics");await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("rowheader",{name:"統計・サクラ",exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"討伐成功数",exact:true}).click();await expect(page.getByRole("tab",{name:"討伐成功数",exact:true})).toHaveAttribute("aria-selected","true");
  await page.getByRole("tab",{name:"討伐ポイント",exact:true}).click();await page.getByRole("button",{name:"全件を見る",exact:true}).click();
  await expect(page.getByRole("rowheader",{name:"=1+1",exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"収集数",exact:true}).click();
  await page.screenshot({path:testInfo.outputPath("statistics-desktop.png"),fullPage:true});
  await page.getByText("CSV出力",{exact:true}).click();
  const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"すべて保存（ZIP）",exact:true}).click();
  const downloaded=await downloadPromise;await downloaded.saveAs(testInfo.outputPath("statistics.zip"));
  const zip=await(await request.get("/api/admin/statistics/export?file=all",{headers})).body();
  expect(zip.readUInt32LE(0)).toBe(0x04034b50);expect(zip.readUInt16LE(zip.length-12)).toBe(5);
  for(const [width,height] of [[1280,800],[390,844],[375,667]]){
    await page.setViewportSize({width,height});
    await expect(page.getByRole("button",{name:"今すぐ更新",exact:true})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const main=page.locator("main");expect(await main.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`statistics-${width}.png`),fullPage:true});
  }
});

test("refreshes live, retains the last good data on failure, pauses while hidden and hides data on expiry",async({page,request})=>{
  await page.context().addCookies([{name:"fourpro_admin",value:token,url:origin}]);
  await page.clock.install();await page.goto("/admin/statistics");await expect(page.getByRole("status")).toHaveCount(0);
  await db.playerCharacter.create({data:{playerId:ids[1],characterId:"thunder-fox"}});
  await page.clock.runFor(5100);
  await expect.poll(async()=>{const data=await page.getByRole("tabpanel").textContent();return data?.includes("=1+1");}).toBe(true);
  const current=await read(request);expect(current.rankings.collected.find(p=>p.id===ids[1])!.collected).toBe(2);
  await expect(page.getByRole("row").filter({has:page.getByRole("rowheader",{name:"=1+1",exact:true})})).toContainText("2体");
  await page.route("**/api/admin/statistics",route=>route.fulfill({status:503,json:{error:"unavailable"}}));
  await page.clock.runFor(5100);await expect(page.getByRole("main").getByRole("alert")).toContainText("取得できません");
  await expect(page.getByRole("rowheader",{name:"統計・サクラ",exact:true})).toBeVisible();
  await page.unroute("**/api/admin/statistics");await page.clock.runFor(5100);await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  let requests=0;page.on("request",req=>{if(new URL(req.url()).pathname==="/api/admin/statistics")requests++;});
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  const count=requests;await page.clock.runFor(10000);expect(requests).toBe(count);
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
  await expect.poll(()=>requests).toBeGreaterThan(count);
  await page.route("**/api/admin/statistics",route=>route.fulfill({status:401,json:{error:"login required"}}));
  await page.clock.runFor(5100);await expect(page.getByRole("link",{name:"管理者ログインへ",exact:true})).toBeVisible();
  await expect(page.getByRole("rowheader",{name:"統計・サクラ",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"今すぐ更新",exact:true})).toBeDisabled();
});

test("finished events remain readable and exportable until their data is purged",async({request})=>{
  await db.event.update({where:{id:eventId},data:{status:"ENDED",endedAt:new Date(),purgeAt:new Date(Date.now()+86400_000)}});
  try{expect((await read(request)).event.status).toBe("ENDED");expect((await request.get("/api/admin/statistics/export",{headers})).status()).toBe(200);}
  finally{await db.event.update({where:{id:eventId},data:{status:"ACTIVE",endedAt:null,purgeAt:null}});}
});
