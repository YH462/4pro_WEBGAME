import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient, Prisma } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashAdminPassword } from "../../src/lib/admin-password";
import { collectSmallText } from "../../scripts/ui-review/small-text";
import type { AdventureRecords } from "../../src/lib/adventure-records";
import type { LocalRaidSnapshot } from "../../src/lib/local-raid-types";

const eventId = "raid-production-test", origin = "http://localhost:13026";
test.skip(process.env.EVENT_ID !== eventId || new URL(process.env.DATABASE_URL || "postgresql://localhost:5432/unused").port !== "55436", "Use the isolated production raid environment.");
const db = new PrismaClient(), players: string[] = [], tags: string[] = [], admins: string[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
let adminHeaders: Record<string, string>;
async function player() {
  const token = randomBytes(32).toString("base64url");
  const row = await db.player.create({ data: { eventId, nickname: "記録確認", sessions: { create: { tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600_000) } } } });
  players.push(row.id);
  return { ...row, token, headers: { origin, cookie: `fourpro_guest=${token}` } };
}
async function records(request: APIRequestContext, headers: Record<string, string>): Promise<AdventureRecords> {
  const response = await request.get("/api/profile/records", { headers });
  expect(response.status()).toBe(200); return (await response.json()).records;
}
const post = (request: APIRequestContext, headers: Record<string, string>, data: object) => request.post("/api/raid", { headers, data });
async function state(request: APIRequestContext): Promise<LocalRaidSnapshot> {
  const response = await request.get("/api/raid", { headers: adminHeaders });
  expect(response.status()).toBe(200); return (await response.json()).state;
}
async function closeRound(request: APIRequestContext) {
  const room = await db.raidRoom.findUniqueOrThrow({ where: { eventId } });
  await db.raidRoom.update({ where: { eventId }, data: { state: { ...room.state as object, closesAt: Date.now() - 1 } as Prisma.InputJsonValue } });
  const snapshot = await state(request);
  for (const data of [{ type: "reveal" }, { type: "impact", kind: "action" }, { type: "impact", kind: "counter" }, { type: "finish" }]) {
    expect((await post(request, adminHeaders, { ...data, roomId: snapshot.roomId, turn: snapshot.round.number })).status()).toBe(200);
  }
  return state(request);
}
test.beforeEach(async () => {
  await db.event.upsert({ where: { id: eventId }, create: { id: eventId, name: "冒険の記録の専用検証" }, update: { status: "ACTIVE", endedAt: null, purgeAt: null } });
  await db.raidRoom.deleteMany({ where: { eventId } });
  const token = randomBytes(32).toString("base64url");
  const admin = await db.adminUser.create({ data: { username: `records_${randomUUID().slice(0, 8)}`, passwordHash: await hashAdminPassword(randomUUID()), sessions: { create: { tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600_000) } } } });
  admins.push(admin.id); adminHeaders = { origin, cookie: `fourpro_admin=${token}` };
});
test.afterEach(async () => {
  await db.raidRoom.deleteMany({ where: { eventId } });
  await db.player.deleteMany({ where: { id: { in: players.splice(0) } } });
  await db.acquisitionTag.deleteMany({ where: { id: { in: tags.splice(0) } } });
  await db.adminUser.deleteMany({ where: { id: { in: admins.splice(0) } } });
});
test.afterAll(async () => { await db.$disconnect(); });

test("collection records refresh after NFC acquisitions and match raid-owned characters without duplicate grants", async ({ page, request }, testInfo) => {
  const guest = await player();
  await page.context().addCookies([{ name: "fourpro_guest", value: guest.token, url: origin }]);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/profile");
  await page.getByRole("tab", { name: "冒険の記録", exact: true }).click();
  await expect(page.getByRole("group", { name: "パートナー収集数", exact: true }).locator("strong")).toContainText("0");
  await expect(page.getByRole("region", { name: "収集したパートナー", exact: true })).toContainText("まだパートナーを集めていません");
  let firstToken = "";
  for (const departmentId of ["mechanical", "electrical", "control", "civil"]) {
    const token = randomBytes(32).toString("base64url"); firstToken ||= token;
    const tag = await db.acquisitionTag.create({ data: { eventId, departmentId, tokenHash: hash(token) } }); tags.push(tag.id);
    const response = await request.post("/api/acquisitions", { headers: guest.headers, data: { token } }); expect(response.status()).toBe(200);
  }
  const repeated = await request.post("/api/acquisitions", { headers: guest.headers, data: { token: firstToken } });
  expect((await repeated.json()).acquired).toBe(false);
  await expect(page.getByRole("region", { name: "収集したパートナー", exact: true }).getByRole("link")).toHaveCount(5, { timeout: 12_000 });
  await expect(page.getByRole("link", { name: "4プロの収集記録", exact: true })).toBeVisible();
  const saved = await records(request, guest.headers);
  expect(saved.collected).toBe(5); expect(saved.characters.map(item => item.id)).toContain("four-pro");
  expect(saved.awards.points).toBe(0);
  expect(saved.awards.activeTitle).toBe("4学科の探究者");
  expect(saved.awards.achievements.filter(item=>item.earnedAt).map(item=>item.code).sort()).toEqual(["department-complete","first-companion"]);
  await page.getByRole("tab",{name:"報酬・称号",exact:true}).click();
  await expect(page.getByRole("listitem",{name:"4学科コンプリート（獲得済み）",exact:true})).toBeVisible();
  await expect(page.getByRole("group",{name:"討伐ポイント",exact:true})).toContainText("0");
  expect((await post(request, guest.headers, { type: "join", characterId: "four-pro" })).status()).toBe(200);
  const raid = await request.get("/api/raid?personal=1", { headers: guest.headers }); expect((await raid.json()).state.me.characterId).toBe("four-pro");
  expect((await records(request, guest.headers)).collected).toBe(5);
  await page.screenshot({ path: testInfo.outputPath("adventure-collection-live.png") });
});

test("completed production raids appear live, survive reset and retries, and remain private", async ({ page, request }, testInfo) => {
  const team = await Promise.all(Array.from({ length: 5 }, player)), late = await player(), outsider = await player();
  for (const member of team) expect((await post(request, member.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  let snapshot = await state(request);
  await page.context().addCookies([{ name: "fourpro_guest", value: team[0].token, url: origin }]);
  await page.goto("/profile"); await page.getByRole("tab", { name: "冒険の記録", exact: true }).click();
  expect((await post(request, adminHeaders, { type: "start", roomId: snapshot.roomId })).status()).toBe(200);
  for (let i = 0; i < 9 && snapshot.round.phase !== "finished"; i++) {
    snapshot = await state(request);
    for (const [index, member] of team.entries()) expect((await post(request, member.headers, { type: "command", roomId: snapshot.roomId, round: snapshot.round.number, requestId: randomUUID(), action: "attack", hand: ["rock", "paper", "scissors"][index % 3] })).status()).toBe(200);
    snapshot = await closeRound(request);
  }
  expect(snapshot.round.phase).toBe("finished"); expect(snapshot.bossHp).toBe(0);
  await expect(page.getByRole("group", { name: "討伐成功数", exact: true }).locator("strong")).toHaveText("1", { timeout: 12_000 });
  await expect(page.getByRole("region", { name: "最近のレイド", exact: true })).toContainText("討伐成功");
  const before = await records(request, team[0].headers);
  expect(before).toMatchObject({ raidCount: 1, victories: 1, collected: 0 });
  expect(before.raids[0]).toMatchObject({ characterId: "forest-golem", bossName: "デスドラグーン", won: true });
  expect(before.awards).toMatchObject({points:100,activeTitle:"ドラグーン討伐者"});
  expect(before.awards.rewards).toHaveLength(1);
  expect(await db.raidReward.count({where:{playerId:{in:team.map(member=>member.id)}}})).toBe(5);
  expect(await db.raidResult.count({ where: { roomId: snapshot.roomId } })).toBe(5);
  expect((await post(request, adminHeaders, { type: "finish", roomId: snapshot.roomId, turn: snapshot.turn })).status()).toBe(200);
  expect((await post(request, late.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(409);
  expect((await post(request, adminHeaders, { type: "reset", roomId: snapshot.roomId })).status()).toBe(200);
  expect(await records(request, team[0].headers)).toEqual(before);
  const other = await request.get(`/api/profile/records?playerId=${team[0].id}`, { headers: outsider.headers });
  expect((await other.json()).records).toMatchObject({ playerId: outsider.id, raidCount: 0, victories: 0, characters: [], raids: [] });
  expect((await records(request,outsider.headers)).awards).toMatchObject({points:0,activeTitle:null,rewards:[]});
  expect((await request.get("/api/profile/records")).status()).toBe(401);
  await page.reload(); await page.getByRole("tab", { name: "冒険の記録", exact: true }).click();
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect((await collectSmallText(page)).filter(item => item.size <= 10)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`adventure-raid-${viewport.width}.png`) });
  }
  await page.getByRole("tab",{name:"報酬・称号",exact:true}).click();
  for(const viewport of [{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    await expect(page.getByRole("group",{name:"討伐ポイント",exact:true})).toContainText("100");
    await expect(page.getByRole("listitem",{name:"初討伐（獲得済み）",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    expect((await collectSmallText(page)).filter(item=>item.size<=10)).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`awards-${viewport.width}.png`)});
  }
});

test("defeat is recorded while unfinished resets and trial characters do not add collection grants", async ({ request }) => {
  const guest = await player();
  expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  let snapshot = await state(request);
  expect((await post(request, adminHeaders, { type: "reset", roomId: snapshot.roomId })).status()).toBe(200);
  expect((await records(request, guest.headers)).raidCount).toBe(0);
  expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  snapshot = await state(request);
  expect((await post(request, adminHeaders, { type: "start", roomId: snapshot.roomId })).status()).toBe(200);
  for (let i = 0; i < 15; i++) snapshot = await closeRound(request);
  expect(snapshot.round.phase).toBe("finished"); expect(snapshot.bossHp).toBe(450);
  expect(await records(request, guest.headers)).toMatchObject({ collected: 0, raidCount: 1, victories: 0, raids: [{ won: false }] });
  const failedAwards=(await records(request,guest.headers)).awards;
  expect(failedAwards.points).toBe(0);expect(failedAwards.activeTitle).toBe("レイドの仲間");
  expect(failedAwards.achievements.filter(item=>item.earnedAt).map(item=>item.code)).toEqual(["first-raid"]);
  expect((await post(request, adminHeaders, { type: "reset", roomId: snapshot.roomId })).status()).toBe(200);
  expect((await records(request, guest.headers)).raidCount).toBe(1);
});
