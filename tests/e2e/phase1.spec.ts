import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
const db = new PrismaClient();
let playerIds: string[] = [];
const headers = { origin: "http://localhost:3000" };
async function start(request: APIRequestContext, nickname = "E2Eゲスト") {
  const response = await request.post("/api/guest", { headers, data: { nickname } });
  expect(response.status()).toBe(201);
  const { player } = await response.json(); playerIds.push(player.id);
  return { player, response };
}
test.afterEach(async () => { await db.player.deleteMany({ where: { id: { in: playerIds } } }); playerIds = []; });
test.afterAll(async () => { await db.$disconnect(); });
test("guest entry, persistent session, dictionary and nickname update", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByRole("heading", { name: "冒険の準備" })).toBeVisible();
  await page.getByLabel("ニックネーム").fill("テスト冒険者");
  await page.getByRole("button", { name: "ゲストではじめる" }).click();
  await expect(page.getByRole("heading", { name: "お知らせ", exact: true })).toBeVisible();
  const { player } = await (await page.request.get("/api/me")).json(); playerIds.push(player.id);
  await page.reload();
  await expect(page.getByRole("heading", { name: "お知らせ", exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/me")).json()).player.nickname).toBe("テスト冒険者");
  await page.goto("/collection");
  await expect(page.getByRole("heading", { name: "キャラ図鑑", exact: true })).toBeVisible();
  await expect(page.locator(".collection-card")).toHaveCount(5);
  await page.getByRole("button", { name: "フォレストゴーレムを選択" }).click();
  await page.getByRole("link", { name: "詳しく見る" }).click();
  await expect(page.getByRole("heading", { name: "フォレストゴーレム" })).toBeVisible();
  await expect(page.locator(".stat-card strong").first()).toHaveText("170");
  await page.getByRole("tab", { name: "固有技", exact: true }).click();
  await expect(page.locator(".skill-list > div")).toHaveCount(3);
  await page.goto("/profile");
  await page.getByLabel("ニックネーム").fill("更新後の名前");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("status")).toHaveText("ニックネームを保存しました。");
  await page.reload();
  await expect(page.getByLabel("ニックネーム")).toHaveValue("更新後の名前");
  expect((await (await page.request.get("/api/me")).json()).player.id).toBe(player.id);
});
test("guest without nickname, HttpOnly cookie, hashed token and idempotent restart", async ({ page, context }) => {
  const request = page.request;
  const { player, response } = await start(request, "");
  expect(player.nickname).toBeNull();
  const cookieHeader = response.headers()["set-cookie"];
  expect(cookieHeader).toContain("HttpOnly"); expect(cookieHeader).toContain("SameSite=lax"); expect(cookieHeader).not.toContain("Domain=");
  const cookies = await context.cookies();
  const token = cookies.find((cookie) => cookie.name === "fourpro_guest")?.value;
  expect(token).toHaveLength(43);
  const stored = await db.guestSession.findFirstOrThrow({ where: { playerId: player.id } });
  expect(stored.tokenHash).toBe(createHash("sha256").update(token!).digest("hex"));
  const second = await request.post("/api/guest", { headers, data: {} });
  expect(second.status()).toBe(200); expect((await second.json()).player.id).toBe(player.id);
  expect(await db.guestSession.count({ where: { playerId: player.id } })).toBe(1);
});
test("authorization, input validation, CSRF and bounded request body", async ({ page }) => {
  const request = page.request;
  expect((await request.get("/api/me")).status()).toBe(401);
  expect((await request.get("/api/characters")).status()).toBe(401);
  expect((await request.post("/api/guest", { headers: { origin: "https://other.example" }, data: {} })).status()).toBe(403);
  expect((await request.post("/api/guest", { headers, data: { nickname: "x".repeat(21) } })).status()).toBe(400);
  expect((await request.post("/api/guest", { headers, data: { hp: 999 } })).status()).toBe(400);
  expect((await request.post("/api/guest", { headers: { ...headers, "content-type": "application/json" }, data: "{" })).status()).toBe(400);
  expect((await request.post("/api/guest", { headers, data: { nickname: "x".repeat(5000) } })).status()).toBe(413);
  await start(request);
  expect((await request.patch("/api/me", { headers, data: { playerId: "other" } })).status()).toBe(400);
  expect((await request.get("/api/me")).headers()["cache-control"]).toContain("no-store");
});
test("DB ownership is isolated, duplicate fixtures are prevented, mobile layout fits", async ({ page, browser }) => {
  const request = page.request;
  const { player } = await start(request);
  const key = { playerId: player.id, characterId: "forest-golem" };
  await db.playerCharacter.upsert({ where: { playerId_characterId: key }, update: {}, create: key });
  await db.playerCharacter.upsert({ where: { playerId_characterId: key }, update: {}, create: key });
  expect(await db.playerCharacter.count({ where: key })).toBe(1);
  await page.goto("/collection");
  await expect(page.locator(".owned-tag.owned")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const other = await browser.newContext();
  try {
    const second = await start(other.request);
    const response = await other.request.get("/api/characters");
    expect((await response.json()).characters.every((character: { owned: unknown }) => !character.owned)).toBe(true);
    expect(second.player.id).not.toBe(player.id);
  } finally { await other.close(); }
});
test("expired and forged sessions are rejected, calendar changes do not remove guests", async ({ page, context }) => {
  const request = page.request;
  const { player } = await start(request);
  await db.player.update({ where: { id: player.id }, data: { createdAt: new Date("2020-01-01") } });
  expect((await request.get("/api/me")).status()).toBe(200);
  await db.guestSession.updateMany({ where: { playerId: player.id }, data: { expiresAt: new Date(0) } });
  expect((await request.get("/api/me")).status()).toBe(401);
  expect(await db.player.count({ where: { id: player.id } })).toBe(1);
  await context.addCookies([{ name: "fourpro_guest", value: "A".repeat(43), url: "http://localhost:3000" }]);
  expect((await request.get("/api/me")).status()).toBe(401);
  await start(request);
});
test("health, master data and DB-backed rate limiting", async ({ page }) => {
  const request = page.request;
  expect((await request.get("/api/health")).status()).toBe(200);
  const { player } = await start(request);
  const { characters } = await (await request.get("/api/characters")).json();
  expect(characters).toHaveLength(5);
  for (const character of characters) { expect(character.skills).toHaveLength(3); expect(character.skills.every((skill: { confirmed: boolean; effect: unknown }) => !skill.confirmed && skill.effect === null)).toBe(true); }
  await db.rateLimitBucket.upsert({ where: { key: `nickname:${player.id}` }, update: { hits: 20, expiresAt: new Date(Date.now() + 60_000) }, create: { key: `nickname:${player.id}`, hits: 20, expiresAt: new Date(Date.now() + 60_000) } });
  try {
    expect((await request.patch("/api/me", { headers, data: { nickname: "blocked" } })).status()).toBe(429);
    await db.rateLimitBucket.update({ where: { key: `nickname:${player.id}` }, data: { expiresAt: new Date(0) } });
    expect((await request.patch("/api/me", { headers, data: { nickname: "after expiry" } })).status()).toBe(200);
    const reset = await db.rateLimitBucket.findUniqueOrThrow({ where: { key: `nickname:${player.id}` } });
    expect(reset.hits).toBe(1);
    expect(reset.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(reset.expiresAt.getTime()).toBeLessThan(Date.now() + 65_000);
  }
  finally { await db.rateLimitBucket.delete({ where: { key: `nickname:${player.id}` } }); }
});
