import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { networkInterfaces } from "node:os";
import { acquireCharacter } from "../../src/lib/acquisition";
const db = new PrismaClient();
const players: string[] = [], tags: string[] = [], events: string[] = [];
const eventId = process.env.EVENT_ID || "local-exhibition";
const headers = { origin:"http://localhost:3000" };
async function tag(departmentId = "mechanical", otherEvent = eventId) {
  const token = randomBytes(32).toString("base64url");
  const row = await db.acquisitionTag.create({ data:{ eventId:otherEvent,departmentId,tokenHash:createHash("sha256").update(token).digest("hex") } });
  tags.push(row.id); return { ...row, token };
}
async function guest(page: Page) {
  const response = await page.request.post("/api/guest", { headers,data:{nickname:"NFC獲得確認"} });
  expect(response.status()).toBe(201);
  const {player} = await response.json(); players.push(player.id); return player.id as string;
}
test.afterEach(async () => {
  const ids=players.splice(0);
  await db.rateLimitBucket.deleteMany({ where:{key:{in:ids.map((id)=>`acquire:${id}`)}} });
  await db.player.deleteMany({where:{id:{in:ids}}});
  await db.acquisitionTag.deleteMany({where:{id:{in:tags.splice(0)}}});
  await db.event.deleteMany({where:{id:{in:events.splice(0)}}});
});
test.afterAll(async()=>{await db.$disconnect();});

test("a tag returns through guest entry, grants only after confirmation and persists in the collection",async({page},testInfo)=>{
  const issued=await tag(); await page.setViewportSize({width:375,height:667});
  await page.goto(`/acquire/${issued.token}`);
  await expect(page).toHaveURL(new RegExp(`/start\\?next=acquire&tag=${issued.token}$`));
  await page.getByRole("textbox",{name:/ニックネーム/}).fill("展示の来場者");
  const registration=page.waitForResponse((response)=>response.url().endsWith("/api/guest")&&response.request().method()==="POST");
  await page.getByRole("button",{name:"ゲストではじめる"}).click();
  const {player}=await(await registration).json(); players.push(player.id);
  await expect(page).toHaveURL(new RegExp(`/acquire/${issued.token}$`));
  await expect(page.getByRole("heading",{name:"フォレストゴーレム"})).toBeVisible();
  expect(await db.playerCharacter.count({where:{playerId:player.id}})).toBe(0);
  await page.reload(); expect(await db.playerCharacter.count({where:{playerId:player.id}})).toBe(0);
  await page.getByRole("button",{name:"仲間にする",exact:true}).click();
  await expect(page.getByRole("status").first()).toHaveText("新しいパートナーが仲間になりました！");
  expect(await db.playerCharacter.count({where:{playerId:player.id}})).toBe(1);
  await page.screenshot({path:testInfo.outputPath("nfc-acquired-mobile.png")});
  await page.reload();
  await expect(page.getByText("このパートナーは獲得済みです。",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"仲間にする",exact:true})).toHaveCount(0);
  await page.getByRole("link",{name:"パートナーを見る"}).click();
  await expect(page).toHaveURL(/\/collection\/forest-golem$/);
  await expect(page.getByRole("heading",{name:"フォレストゴーレム",exact:true})).toBeVisible();
  for (const department of ["electrical","control"]) {
    const next=await tag(department);
    expect((await page.request.post("/api/acquisitions",{headers,data:{token:next.token}})).status()).toBe(200);
  }
  const last=await tag("civil");
  await page.goto(`/acquire/${last.token}`);
  await page.getByRole("button",{name:"仲間にする",exact:true}).click();
  await expect(page.getByText("4学科コンプリート！",{exact:true})).toBeVisible();
  await expect(page.getByText("4プロが仲間になりました！",{exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("nfc-four-pro-unlocked.png")});
});

test("parallel tags and retries grant each department and the legend once without resetting growth",async({page})=>{
  const issued=await Promise.all(["mechanical","electrical","control","civil"].map((id)=>tag(id)));
  const playerId=await guest(page);
  const requests=await Promise.all([...issued,...issued].map((item)=>page.request.post("/api/acquisitions",{headers,data:{token:item.token}})));
  expect(requests.map((response)=>response.status())).toEqual(Array(8).fill(200));
  const results=await Promise.all(requests.map((response)=>response.json()));
  expect(results.filter((result)=>result.acquired)).toHaveLength(4);
  expect(results.filter((result)=>result.legend)).toHaveLength(1);
  const before=await db.playerCharacter.findMany({where:{playerId},orderBy:{characterId:"asc"}});
  expect(before.map((row)=>row.characterId)).toEqual(["aqua-spirit","flame-dragon","forest-golem","four-pro","thunder-fox"]);
  expect(await db.acquisitionLog.count({where:{playerId}})).toBe(4);
  await db.playerCharacter.update({where:{playerId_characterId:{playerId,characterId:"forest-golem"}},data:{hpGrowth:17}});
  const again=await page.request.post("/api/acquisitions",{headers,data:{token:issued[0].token}});
  expect(await again.json()).toMatchObject({acquired:false,departmentCount:4,legend:null});
  expect((await db.playerCharacter.findUniqueOrThrow({where:{playerId_characterId:{playerId,characterId:"forest-golem"}}})).hpGrowth).toBe(17);
  expect((await db.playerCharacter.findUniqueOrThrow({where:{playerId_characterId:{playerId,characterId:"forest-golem"}}})).acquiredAt).toEqual(before.find((row)=>row.characterId==="forest-golem")!.acquiredAt);
  await page.goto(`/acquire/${issued[0].token}`);
  await expect(page.getByText("このパートナーは獲得済みです。",{exact:true})).toBeVisible();
});

test("acquisition rejects missing sessions, forged fields, disabled tags and another event",async({page})=>{
  const issued=await tag();
  expect((await page.request.post("/api/acquisitions",{headers,data:{token:issued.token}})).status()).toBe(401);
  const playerId=await guest(page);
  expect((await page.request.post("/api/acquisitions",{headers:{origin:"https://evil.example"},data:{token:issued.token}})).status()).toBe(403);
  for(const data of [{token:issued.token,characterId:"four-pro"},{token:issued.token,playerId:randomUUID()},{token:"forged"}]) expect((await page.request.post("/api/acquisitions",{headers,data})).status()).toBe(400);
  await db.acquisitionTag.update({where:{id:issued.id},data:{enabled:false}});
  expect((await page.request.post("/api/acquisitions",{headers,data:{token:issued.token}})).status()).toBe(404);
  const other=await db.event.create({data:{id:`e2e-nfc-${randomUUID()}`,name:"別イベント",status:"ENDED",endedAt:new Date(),purgeAt:new Date(Date.now()+3600_000)}}); events.push(other.id);
  const foreign=await tag("electrical",other.id);
  expect((await page.request.post("/api/acquisitions",{headers,data:{token:foreign.token}})).status()).toBe(404);
  await page.goto(`/acquire/${issued.token}`);
  await expect(page.getByRole("heading",{name:"この展示のリンクは利用できません"})).toBeVisible();
  expect(await db.playerCharacter.count({where:{playerId}})).toBe(0);
});

test("operator CLI creates local URL and QR files, disables tags and refuses ended events",async()=>{
  const event=await db.event.create({data:{id:`e2e-nfc-cli-${randomUUID()}`,name:"発行確認"}}); events.push(event.id);
  const execute=promisify(execFile);
  const cli=(...args:string[])=>execute(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/nfc-tags.ts",...args],{env:{...process.env,EVENT_ID:event.id,APP_URL:"http://localhost:3000",ENABLE_DEV_SIMULATOR:"true",ALLOW_INSECURE_LOCAL_HTTP:"true",NODE_ENV:"test"}});
  const address=Object.values(networkInterfaces()).flat().find((item)=>item?.family==="IPv4"&&!item.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))?.address;
  const issued=await cli("issue","civil",...(address?[`http://${address}:3000`]:[]));
  const id=issued.stdout.match(/Tag ID: ([\w-]+)/)![1]; tags.push(id);
  const jsonPath=path.resolve(".local/nfc",`${id}.json`),qrPath=path.resolve(".local/nfc",`${id}.svg`);
  try {
    const file=JSON.parse(await readFile(jsonPath,"utf8"));
    if(address) expect(file.url).toContain(`http://${address}:3000/acquire/`);
    expect(file.url).toMatch(/\/acquire\/[A-Za-z0-9_-]{43}$/);
    expect(await readFile(qrPath,"utf8")).toContain("<svg");
    const row=await db.acquisitionTag.findUniqueOrThrow({where:{id}});
    expect(row.tokenHash).toBe(createHash("sha256").update(file.url.split("/").at(-1)).digest("hex"));
    expect((await cli("list")).stdout).toContain(id);
    await cli("disable",id);
    expect((await db.acquisitionTag.findUniqueOrThrow({where:{id}})).enabled).toBe(false);
    await db.event.update({where:{id:event.id},data:{status:"ENDED",endedAt:new Date(),purgeAt:new Date(Date.now()+3600_000)}});
    await expect(cli("issue","mechanical")).rejects.toThrow();
  } finally { await rm(jsonPath,{force:true}); await rm(qrPath,{force:true}); }
});

test("an ended event refuses acquisition inside the grant transaction",async()=>{
  const event=await db.event.create({data:{id:`e2e-nfc-ended-${randomUUID()}`,name:"終了済み",status:"ENDED",endedAt:new Date(),purgeAt:new Date(Date.now()+3600_000)}}); events.push(event.id);
  const issued=await tag("civil",event.id);
  const player=await db.player.create({data:{eventId:event.id}}); players.push(player.id);
  const previous=process.env.EVENT_ID;
  try {
    process.env.EVENT_ID=event.id;
    await expect(acquireCharacter(player.id,issued.token)).rejects.toMatchObject({status:409});
    expect(await db.playerCharacter.count({where:{playerId:player.id}})).toBe(0);
  } finally { if(previous===undefined) delete process.env.EVENT_ID; else process.env.EVENT_ID=previous; }
});
