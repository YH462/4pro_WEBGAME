import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const eventId = "raid-production-test", origin = "http://localhost:13026";
test.skip(process.env.EVENT_ID !== eventId || new URL(process.env.DATABASE_URL || "postgresql://localhost/unused").port !== "55436", "Use the isolated production test environment.");
const db = new PrismaClient();
test.afterAll(async () => { await db.$disconnect(); });

test("unowned tiles open two-photo hints or a single department photo without registering a guest", async ({ page, context }, testInfo) => {
  const registrations: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/guest" && request.method() === "POST") registrations.push(request.url()); });
  await page.goto("/collection");
  await page.locator('a.collection-card[href="/collection/temp-06/hint"]').click();
  const panel = page.getByRole("region", { name: /の場所のヒント$/ });
  await expect(page).toHaveURL(/\/collection\/temp-06\/hint$/);
  await expect(panel.locator('[data-hint-media="overview"]')).toHaveCount(1);
  await expect(panel.locator('[data-hint-media="detail"]')).toHaveCount(1);
  await expect(panel.locator('[data-hint-media="map"]')).toHaveCount(1);
  await expect(panel).toContainText("準備中");
  for (const [width, height] of [[375, 667], [390, 844], [430, 932], [844, 390], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    const wide = (await panel.locator('[data-hint-media="overview"]').boundingBox())!, close = (await panel.locator('[data-hint-media="detail"]').boundingBox())!;
    expect(Math.abs(wide.y - close.y)).toBeLessThan(1);
    expect(wide.x + wide.width).toBeLessThan(close.x);
    if (width < 600) {
      const map = (await panel.locator('[data-hint-media="map"]').boundingBox())!;
      expect(map.y).toBeGreaterThanOrEqual(wide.y + wide.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.getByRole("link", { name: "図鑑に戻る", exact: true }).click({ trial: true });
    await page.screenshot({ path: testInfo.outputPath(`location-hint-${width}.png`) });
  }
  await page.getByRole("link", { name: "図鑑に戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await page.getByRole("link", { name: "フォレストゴーレムの場所のヒントを見る（未獲得）", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "フォレストゴーレム", exact: true })).toBeVisible();
  await expect(panel.locator("[data-hint-media]")).toHaveCount(1);
  await expect(panel.locator('[data-hint-media="map"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("department-location-hint.png") });
  await page.reload(); await expect(panel.locator("[data-hint-media]")).toHaveCount(1);
  expect(registrations).toEqual([]);
  expect((await context.cookies()).some(cookie => cookie.name === "fourpro_guest")).toBe(false);
});

test("owned tiles retain character details and acquired characters leave their hint page", async ({ page, context }) => {
  const token = randomBytes(32).toString("base64url");
  const player = await db.player.create({ data: { eventId, nickname: "ヒントの確認", characters: { create: { characterId: "forest-golem" } }, sessions: { create: { tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600_000) } } } });
  try {
    await context.addCookies([{ name: "fourpro_guest", value: token, url: origin }]);
    await page.goto("/collection");
    const owned = page.getByRole("link", { name: "フォレストゴーレムの詳細を見る（獲得済み）", exact: true });
    await expect(owned).toHaveAttribute("href", "/collection/forest-golem"); await owned.click();
    await expect(page.getByRole("tab", { name: "ステータス", exact: true })).toBeVisible();
    await page.goto("/collection/forest-golem/hint");
    await expect(page).toHaveURL(`${origin}/collection/forest-golem`);
    await expect(page.getByRole("group", { name: "HP", exact: true })).toBeVisible();
    await page.goto("/collection/thunder-fox/hint");
    await expect(page.getByRole("region", { name: "サンダーフォックスの場所のヒント", exact: true })).toBeVisible();
  } finally { await db.player.delete({ where: { id: player.id } }); }
});

test("unknown hints return 404 and public hints do not expose personal APIs", async ({ page }) => {
  expect((await page.goto("/collection/missing-character/hint"))?.status()).toBe(404);
  await page.goto("/collection/temp-06/hint");
  await expect(page.getByRole("region", { name: /の場所のヒント$/ })).toBeVisible();
  expect((await page.request.get("/api/me")).status()).toBe(401);
  expect((await page.request.get("/api/characters")).status()).toBe(401);
});
