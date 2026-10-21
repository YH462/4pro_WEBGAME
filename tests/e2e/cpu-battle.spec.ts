import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
let playerId: string | undefined;
async function guest(page: Page) {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "CPU対戦テスト" } });
  expect(response.status()).toBe(201); playerId = (await response.json()).player.id;
  await page.goto("/battle");
}
test.afterEach(async () => { if (playerId) await db.player.deleteMany({ where: { id: playerId } }); playerId = undefined; });
test.afterAll(async () => { await db.$disconnect(); });

test("shows both fighters and wins by guarding the forecast special, without granting ownership", async ({ page }) => {
  await guest(page);
  await expect(page.getByRole("group", { name: "対戦キャラクター", exact: true }).getByRole("button")).toHaveCount(12);
  await page.getByRole("button", { name: "仮キャラ 09を選択", exact: true }).click();
  await page.getByRole("button", { name: "このキャラで対戦", exact: true }).click();
  const attack = page.getByRole("button", { name: "攻撃", exact: true });
  const special = page.getByRole("button", { name: "必殺", exact: true });
  await expect(page.getByRole("img", { name: "自分のキャラ：仮キャラ 09", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "敵のキャラ：キング・アクア", exact: true })).toBeVisible();
  await expect(special).toBeDisabled();
  for (let i = 0; i < 2; i++) {
    await expect(attack).toBeEnabled();
    await attack.click();
  }
  const defend = page.getByRole("button", { name: "防御", exact: true });
  await expect(defend).toBeEnabled();
  await expect(page.getByLabel("相手の次の行動", { exact: true })).toContainText("必殺の予兆");
  await defend.click();
  await expect(special).toBeEnabled();
  await expect(page.getByRole("progressbar", { name: "自分のHP", exact: true })).toHaveAttribute("aria-valuenow", "69");
  await expect(page.getByRole("region", { name: "CPUの対戦画面", exact: true })).toContainText("隙あり");
  await expect(page.getByRole("progressbar", { name: "必殺ゲージ（EP）", exact: true })).toHaveAttribute("aria-valuenow", "100");
  await special.click();
  await expect(page.getByRole("region", { name: "対戦結果", exact: true })).toContainText("勝利！");
  await expect(page.getByRole("progressbar", { name: "CPUのHP", exact: true })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("progressbar", { name: "必殺ゲージ（EP）", exact: true })).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "もう一度対戦", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "自分のHP", exact: true })).toHaveAttribute("aria-valuenow", "115");
  await expect(page.getByRole("progressbar", { name: "CPUのHP", exact: true })).toHaveAttribute("aria-valuenow", "180");
  expect(await db.playerCharacter.count({ where: { playerId } })).toBe(0);
  await page.getByRole("button", { name: "キャラを選び直す", exact: true }).click();
  await expect(page.getByRole("group", { name: "対戦キャラクター", exact: true }).getByRole("button")).toHaveCount(12);
});

test("defense reduces damage and synchronous repeated clicks cannot spend multiple turns", async ({ page }) => {
  await guest(page);
  await page.getByRole("button", { name: "このキャラで対戦", exact: true }).click();
  const defend = page.getByRole("button", { name: "防御", exact: true });
  await expect(defend).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await defend.evaluate((element: HTMLButtonElement) => {
    element.click(); element.click();
  });
  await expect(defend).toBeDisabled();
  const field = page.getByRole("region", { name: "CPUの対戦画面", exact: true });
  await expect(field).toHaveAttribute("data-phase", "player");
  await page.clock.runFor(600);
  await expect(field).toHaveAttribute("data-phase", "cpu");
  await expect(page.getByRole("status")).toContainText("キング・アクアの攻撃");
  await expect(defend).toBeDisabled();
  await page.clock.runFor(600);
  await expect(page.getByRole("progressbar", { name: "自分のHP", exact: true })).toHaveAttribute("aria-valuenow", "164");
  await expect(page.getByRole("progressbar", { name: "CPUのHP", exact: true })).toHaveAttribute("aria-valuenow", "180");
  await expect(page.getByRole("progressbar", { name: "必殺ゲージ（EP）", exact: true })).toHaveAttribute("aria-valuenow", "50");
  await expect(defend).toBeDisabled();
  await page.clock.runFor(300);
  await expect(defend).toBeEnabled();
  await expect(page.getByLabel("相手の次の行動", { exact: true })).toContainText("防御");
});
