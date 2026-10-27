import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { networkInterfaces } from "node:os";

const db = new PrismaClient();
const players: string[] = [];
test.afterEach(async () => { await db.player.deleteMany({ where: { id: { in: players.splice(0) } } }); });
test.afterAll(async () => { await db.$disconnect(); });

test("guest form cannot submit while its client scripts are unavailable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://localhost:3000/start?next=local-raid");
    await expect(page.getByRole("textbox", { name: /ニックネーム/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "ゲストではじめる" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("画面を準備しています");
    await expect(page.getByText("参加にはJavaScriptが必要です。ブラウザの設定を確認してください。", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/start\?next=local-raid$/);
  } finally { await context.close(); }
});

test("LAN guest entry preserves the raid destination and session after reload", async ({ page }) => {
  const address = Object.values(networkInterfaces()).flat().find((item) => item?.family === "IPv4" && !item.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))?.address;
  test.skip(!address, "No local network interface available");
  const origin = `http://${address}:3000`;
  await page.goto(`${origin}/battle/raid?sync=local`);
  await expect(page).toHaveURL(`${origin}/start?next=local-raid`);
  await page.getByRole("textbox", { name: /ニックネーム/ }).fill("LAN参加確認");
  const registration = page.waitForResponse((response) => response.url() === `${origin}/api/guest` && response.request().method() === "POST");
  await page.getByRole("button", { name: "この名前ではじめる" }).click();
  const response = await registration;
  expect(response.ok()).toBeTruthy();
  const { player } = await response.json();
  players.push(player.id);
  await expect(page).toHaveURL(`${origin}/battle/raid?sync=local`);
  await expect(page.getByRole("heading", { name: "レイドバトル", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "レイドバトル", exact: true })).toBeVisible();
  expect((await (await page.request.get(`${origin}/api/me`)).json()).player.id).toBe(player.id);
});
