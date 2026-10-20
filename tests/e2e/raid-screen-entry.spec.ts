import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import jsQR from "jsqr";
import { privateIpv4 } from "../../src/lib/local-network";

const db = new PrismaClient();
const players: string[] = [];
test.afterEach(async ({ request }) => {
  await db.player.deleteMany({ where: { id: { in: players.splice(0) } } });
  await request.post("/api/local-raid", { headers: { origin: "http://localhost:3000" }, data: { type: "reset" } });
});
test.afterAll(async () => { await db.$disconnect(); });

test("screen QR decodes to a LAN entry link and a new phone reaches the synced raid", async ({ page, browser }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/raid/screen?sync=local");
  const card = page.getByRole("region", { name: "レイド参加案内" });
  const image = card.getByRole("img", { name: "レイド参加用QRコード", exact: true });
  await expect(image).toBeVisible();
  const pixels = await image.evaluate(async (element) => {
    const img = element as HTMLImageElement;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.getBoundingClientRect().width); canvas.height = canvas.width;
    const context = canvas.getContext("2d")!;
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  });
  const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  expect(decoded).not.toBeNull();
  const url = new URL(decoded!.data);
  expect(privateIpv4(url.hostname)).toBe(true);
  expect(url.pathname + url.search).toBe("/battle/raid?sync=local");
  await expect(card.getByRole("link", { name: `参加URL ${url.href}`, exact: true })).toHaveAttribute("href", url.href);
  await expect(card).toContainText("標準カメラ");
  await page.screenshot({ path: testInfo.outputPath("raid-screen-join.png") });

  for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    const bounds = await card.boundingBox();
    const footer = await page.locator("footer").boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y);
    const link = await card.getByRole("link").boundingBox();
    expect(link!.y + link!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
  }
  await card.getByRole("button", { name: "参加QRを大きく表示" }).click();
  const dialog = page.getByRole("dialog", { name: "スマホでレイドに参加" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "拡大したレイド参加用QRコード" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const mobile = await phone.newPage();
    await mobile.goto(url.href);
    await expect(mobile).toHaveURL(`${url.origin}/start?next=local-raid`);
    await mobile.getByRole("textbox", { name: /ニックネーム/ }).fill("スクリーンQR確認");
    const registration = mobile.waitForResponse((response) => response.url() === `${url.origin}/api/guest` && response.request().method() === "POST");
    await mobile.getByRole("button", { name: "ゲストではじめる" }).click();
    const response = await registration;
    expect(response.status()).toBe(201);
    const me = await mobile.request.get(`${url.origin}/api/me`);
    expect(me.status()).toBe(200);
    players.push((await me.json()).player.id);
    await expect(mobile).toHaveURL(url.href);
    await expect(mobile.getByRole("heading", { name: "レイドバトル", exact: true })).toBeVisible();
    await expect(mobile.locator(".raid-feedback")).toHaveText("攻撃・回復と、じゃんけんの手を選ぼう");
    await expect(mobile.getByRole("button", { name: "攻撃を選択", exact: true })).toBeEnabled();
    await expect(mobile.getByRole("button", { name: "回復を選択", exact: true })).toBeEnabled();
    expect((await mobile.request.get(`${url.origin}/api/me`)).status()).toBe(200);
  } finally { await phone.close(); }
});

test("the normal screen keeps the effect-check page separate and waits for real participants", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/raid/screen");
  const card = page.getByRole("region", { name: "レイド参加案内" });
  const link = card.getByRole("link");
  await expect(link).toHaveAttribute("href", /\/battle\/raid$/);
  await expect(card).toContainText("操作プレビュー");
  await page.getByRole("button", { name: "表示設定", exact: true }).click();
  await expect(page.getByRole("link", { name: "演出確認ページを開く", exact: true })).toHaveAttribute("href", "/raid/screen?demo=effects");
  await page.getByRole("button", { name: "表示設定を閉じる" }).click();
  await expect(card.getByRole("img", { name: "レイド参加用QRコード", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "参加者とキャラクター" }).getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "連続デモ", exact: true })).toHaveCount(0);
});
