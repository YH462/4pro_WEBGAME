import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { hashAdminPassword } from "../../src/lib/admin-password";
import type { LocalRaidSnapshot } from "../../src/lib/local-raid-types";
import { collectSmallText } from "../../scripts/ui-review/small-text";

const eventId = "raid-production-test", origin = "http://localhost:13026";
const configured = process.env.EVENT_ID === eventId && new URL(process.env.DATABASE_URL || "postgresql://localhost:5432/unused").port === "55436";
test.skip(!configured, "Use playwright.production.config.ts with the isolated production-raid test database.");
const db = new PrismaClient(), playerIds: string[] = [], adminIds: string[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
let adminHeaders: Record<string, string>, adminToken: string;
let adminUsername: string, adminPassword: string;
async function player() {
  const token = randomBytes(32).toString("base64url");
  const row = await db.player.create({ data: { eventId, nickname: `同期${playerIds.length + 1}`, sessions: { create: { tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600_000) } } } });
  playerIds.push(row.id);
  return { ...row, token, headers: { origin, cookie: `fourpro_guest=${token}` } };
}
const post = (request: APIRequestContext, headers: Record<string, string>, data: object) => request.post("/api/raid", { headers, data });
async function snapshot(request: APIRequestContext, headers = adminHeaders, personal = false): Promise<LocalRaidSnapshot> {
  const response = await request.get(`/api/raid${personal ? "?personal=1" : ""}`, { headers });
  expect(response.status()).toBe(200); return (await response.json()).state;
}

test.beforeEach(async () => {
  await db.event.upsert({ where: { id: eventId }, create: { id: eventId, name: "本番同期の専用検証" }, update: { status: "ACTIVE", endedAt: null, purgeAt: null } });
  await db.raidRoom.deleteMany({ where: { eventId } });
  adminToken = randomBytes(32).toString("base64url");
  adminUsername = `raid_${randomUUID().slice(0,8)}`; adminPassword = randomUUID();
  const admin = await db.adminUser.create({ data: { username: adminUsername, passwordHash: await hashAdminPassword(adminPassword), sessions: { create: { tokenHash: hash(adminToken), expiresAt: new Date(Date.now() + 3600_000) } } } });
  adminIds.push(admin.id); adminHeaders = { origin, cookie: `fourpro_admin=${adminToken}` };
});
test.afterEach(async () => {
  await db.event.update({ where: { id: eventId }, data: { status: "ACTIVE", endedAt: null, purgeAt: null } });
  await db.raidRoom.deleteMany({ where: { eventId } });
  await db.player.deleteMany({ where: { id: { in: playerIds.splice(0) } } });
  await db.adminUser.deleteMany({ where: { id: { in: adminIds.splice(0) } } });
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "raid-" } } });
});
test.afterAll(async () => { await db.$disconnect(); });

test("staff login returns to the live screen and the cleaned header retains its screen link", async ({ page }) => {
  await page.goto("/raid/screen");
  await expect(page).toHaveURL(/\/admin\/login\?next=raid-screen$/);
  await page.getByRole("textbox", { name: "ユーザー名" }).fill(adminUsername);
  await page.getByLabel("パスワード", { exact: true }).fill(adminPassword);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/raid/screen`);
  await expect(page.locator("canvas[data-boss-model='ready']")).toHaveAttribute("data-boss-model-url", "/models/bosses/des-dragoon-red.glb");
  await expect(page.getByRole("heading", { name: "デスドラグーン", exact: true })).toBeVisible();
  expect((await page.request.get("/api/raid")).status()).toBe(200);
  await page.goto("/admin");
  await expect(page.getByText("ADMINISTRATION", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "会場スクリーン", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/raid/screen`);
});

test("NFC acquisition, profile data and model delivery survive UI integration", async ({ page, request }, testInfo) => {
  const guest = await player(), token = randomBytes(32).toString("base64url");
  const tag = await db.acquisitionTag.create({ data: { eventId, departmentId: "mechanical", tokenHash: hash(token) } });
  try {
    const first = await request.post("/api/acquisitions", { headers: guest.headers, data: { token } });
    expect(first.status()).toBe(200); expect((await first.json()).acquired).toBe(true);
    const owned = await db.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: guest.id, characterId: "forest-golem" } } });
    const repeated = await request.post("/api/acquisitions", { headers: guest.headers, data: { token } });
    expect(repeated.status()).toBe(200); expect((await repeated.json()).acquired).toBe(false);
    expect(await db.playerCharacter.findUniqueOrThrow({ where: { id: owned.id } })).toEqual(owned);
    expect((await request.patch("/api/me", { headers: guest.headers, data: { nickname: "統合確認" } })).status()).toBe(200);
    expect((await db.player.findUniqueOrThrow({ where: { id: guest.id } })).nickname).toBe("統合確認");
    const models = await request.get("/api/character-models");
    expect(models.status()).toBe(200); expect(Object.keys((await models.json()).models)).toHaveLength(10);
    for (const color of ["red", "blue", "green", "yellow"]) {
      const asset = await request.get(`/models/bosses/des-dragoon-${color}.glb`);
      expect(asset.status()).toBe(200);
      expect((await asset.body()).readUInt32LE(0)).toBe(0x46546c67);
    }
    await page.context().addCookies([{ name: "fourpro_guest", value: guest.token, url: origin }]);
    await page.goto("/collection");
    await expect(page.getByRole("link", { name: "フォレストゴーレムの詳細を見る（獲得済み）", exact: true })).toBeVisible();
    for (const viewport of [{width:375,height:667},{width:390,height:844},{width:430,height:932}]) {
      await page.setViewportSize(viewport); await page.goto("/collection/forest-golem");
      await expect(page.getByRole("tab", {name:"ステータス",exact:true})).toBeVisible();
      expect((await collectSmallText(page)).filter(item=>item.size<=10)).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/battle");
    await expect(page.getByRole("heading", { name: "同期レイド", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "QRでレイドに参加", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "デスドラグーン", exact: true })).toHaveAttribute("src", "/models/bosses/des-dragoon-red.webp");
    await expect(page.getByText("CPU対戦", { exact: true })).toHaveCount(0);
    expect((await collectSmallText(page)).filter(item=>item.size<=10)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("raid-entry-mobile.png") });
  } finally {
    await db.acquisitionLog.deleteMany({ where: { tagId: tag.id } });
    await db.acquisitionTag.delete({ where: { id: tag.id } });
  }
});

test("production raid protects staff controls, event boundaries and character ownership", async ({ request, page }) => {
  expect((await request.get("/api/local-raid")).status()).toBe(404);
  expect((await request.get("/raid/screen?sync=local")).status()).toBe(404);
  await page.goto("/raid/screen"); await expect(page).toHaveURL(/\/admin\/login\?next=raid-screen$/);
  expect((await request.get("/api/raid")).status()).toBe(401);
  expect((await request.get("/api/raid?personal=1")).status()).toBe(401);
  const guest = await player(), state = await snapshot(request);
  for (const data of [{ type: "start", roomId: state.roomId }, { type: "reset", roomId: state.roomId }, { type: "reveal", roomId: state.roomId, turn: 1 }, { type: "impact", roomId: state.roomId, turn: 1, kind: "action" }, { type: "finish", roomId: state.roomId, turn: 1 }]) expect((await post(request, guest.headers, data)).status()).toBe(401);
  expect((await post(request, { ...guest.headers, origin: "https://evil.example" }, { type: "join", characterId: "forest-golem" })).status()).toBe(403);
  expect((await post(request, guest.headers, { type: "join", characterId: "four-pro" })).status()).toBe(403);
  expect((await post(request, guest.headers, { type: "join", characterId: "temp-12" })).status()).toBe(403);
  expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem", maxHp: 99999 })).status()).toBe(400);
  await db.playerCharacter.create({ data: { playerId: guest.id, characterId: "forest-golem", hpGrowth: 8 } });
  expect((await post(request, guest.headers, { type: "join", characterId: "aqua-spirit" })).status()).toBe(403);
  expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  expect((await snapshot(request, guest.headers, true)).me?.maxHp).toBe(178);
  const foreign = await db.event.create({ data: { id: `raid-foreign-${randomUUID()}`, name: "別イベント" } });
  try {
    await db.player.update({ where: { id: guest.id }, data: { eventId: foreign.id } });
    expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(401);
  } finally { await db.player.update({ where: { id: guest.id }, data: { eventId } }); await db.event.delete({ where: { id: foreign.id } }); }
  await db.event.update({ where: { id: eventId }, data: { status: "ENDED", endedAt: new Date(), purgeAt: new Date(Date.now() + 3600_000) } });
  expect((await post(request, adminHeaders, { type: "start", roomId: state.roomId })).status()).toBe(409);
  expect((await request.get("/api/raid?personal=1", { headers: guest.headers })).status()).toBe(409);
});

test("twenty concurrent phones keep all inputs, deduplicate retries and share one persisted outcome", async ({ request }) => {
  const guests = await Promise.all(Array.from({ length: 20 }, () => player()));
  const joins = await Promise.all(guests.map((guest) => post(request, guest.headers, { type: "join", characterId: "forest-golem" })));
  expect(joins.map((response) => response.status())).toEqual(Array(20).fill(200));
  const state = await snapshot(request); expect(state.participants).toBe(20);
  const overflow = await player(); expect((await post(request, overflow.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(409);
  expect((await post(request, adminHeaders, { type: "start", roomId: state.roomId })).status()).toBe(200);
  const commands = guests.map(() => ({ type: "command", roomId: state.roomId, round: 1, requestId: randomUUID(), action: "attack", hand: "scissors" }));
  const sent = await Promise.all(guests.map((guest, i) => post(request, guest.headers, commands[i])));
  expect(sent.map((response) => response.status())).toEqual(Array(20).fill(200));
  expect((await post(request, guests[0].headers, commands[0])).status()).toBe(200);
  expect((await post(request, guests[0].headers, { ...commands[0], hand: "rock" })).status()).toBe(409);
  expect((await post(request, guests[0].headers, { ...commands[0], requestId: randomUUID() })).status()).toBe(409);
  const accepted = await snapshot(request); expect(accepted.round.submitted).toBe(20); expect(accepted.results).toEqual([]);
  const secondConnection = new PrismaClient();
  try {
    const saved = (await secondConnection.raidRoom.findUniqueOrThrow({ where: { eventId } })).state as unknown as { members: unknown[]; receipts: unknown[] };
    expect(saved.members).toHaveLength(20); expect(saved.receipts).toHaveLength(20);
  } finally { await secondConnection.$disconnect(); }
  await expect.poll(async () => (await snapshot(request)).round.phase, { timeout: 15_000 }).toBe("playing");
  const resolved = await snapshot(request); expect(resolved.results).toHaveLength(20); expect(new Set(resolved.results.map((entry) => entry.boss)).size).toBe(1);
  expect(resolved.bossHp).toBe(0); expect(resolved.totalDamage).toBe(450);
  const finishes = await Promise.all(Array.from({ length: 4 }, () => post(request, adminHeaders, { type: "finish", roomId: state.roomId, turn: 1 })));
  expect(finishes.map((response) => response.status())).toEqual(Array(4).fill(200));
  expect((await snapshot(request)).round.phase).toBe("finished");
  expect((await post(request, adminHeaders, { type: "reset", roomId: state.roomId })).status()).toBe(200);
  expect((await post(request, adminHeaders, { type: "reset", roomId: state.roomId })).status()).toBe(409);
  expect((await post(request, guests[0].headers, commands[0])).status()).toBe(409);
});

test("a real screen and two phones complete a round and reconnect after reload", async ({ page, browser, request }, testInfo) => {
  const withoutWebGl = () => { const original = HTMLCanvasElement.prototype.getContext; Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function(this: HTMLCanvasElement, type: string, ...args: unknown[]) { return type.startsWith("webgl") || type === "experimental-webgl" ? null : Reflect.apply(original, this, [type, ...args]); } }); };
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.context().addInitScript(withoutWebGl); await page.setViewportSize({ width: 1366, height: 768 });
  const phoneContexts = await Promise.all(Array.from({ length: 2 }, () => browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })));
  try {
    const phones = await Promise.all(phoneContexts.map(async (context) => { await context.addInitScript(withoutWebGl); return context.newPage(); }));
    await phones[0].goto("/battle/raid"); await expect(phones[0]).toHaveURL(/\/start\?next=raid$/);
    await phones[0].getByRole("textbox", { name: "ニックネーム" }).fill("本番参加確認");
    await phones[0].getByRole("button", { name: "ゲストではじめる" }).click(); await expect(phones[0]).toHaveURL(`${origin}/battle/raid`);
    const registered = await phoneContexts[0].request.get("/api/me"); playerIds.push((await registered.json()).player.id);
    const second = await player(); await phoneContexts[1].addCookies([{ name: "fourpro_guest", value: second.token, url: origin }]); await phones[1].goto("/battle/raid");
    await page.goto("/raid/screen");
    await expect(page.locator(".enemy-fallback-art image")).toHaveAttribute("href", "/models/bosses/des-dragoon-red.webp");
    await expect(page.getByRole("heading", { name: "デスドラグーン", exact: true })).toBeVisible();
    await expect.poll(async () => (await snapshot(request)).participants).toBe(2);
    await expect(page.getByRole("link", { name: `参加URL ${origin}/battle/raid`, exact: true })).toHaveAttribute("href", `${origin}/battle/raid`);
    await page.getByRole("button", { name: "10秒の入力受付を開始", exact: true }).click();
    for (const phone of phones) { await phone.getByRole("button", { name: "攻撃を選択", exact: true }).click(); await phone.getByRole("button", { name: "チョキを選択", exact: true }).click(); }
    await phones[0].reload(); await expect(phones[0].getByRole("group", { name: "送信した行動とじゃんけんの手" })).toContainText("攻撃 / チョキ");
    await page.reload();
    await expect.poll(async () => (await snapshot(request)).round.number, { timeout: 30_000 }).toBe(2);
    for (const phone of phones) { await expect(phone.getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", "150"); await expect(phone.getByRole("button", { name: "攻撃を選択", exact: true })).toBeEnabled(); }
    await page.screenshot({ path: testInfo.outputPath("production-raid-screen.png") });
    await phones[0].screenshot({ path: testInfo.outputPath("production-raid-phone.png") });
    const stored = await db.raidRoom.findUniqueOrThrow({ where: { eventId } }); expect(JSON.stringify(stored.state)).toContain('"completedTurn":1');
    await page.getByRole("button", { name: "同期設定", exact: true }).click(); await page.getByRole("button", { name: "同期をリセット", exact: true }).click();
    await expect(phones[0].getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", "170");
  } finally { for (const context of phoneContexts) await context.close(); }
});
