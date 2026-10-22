import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";

const db = new PrismaClient();
test("a lethal shared attack shows a persistent victory panel only after screen impact", async ({ page }, testInfo) => {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "討伐UI確認" } });
  const { player } = await response.json();
  let now = 0;
  const room = new LocalRaidRoom(() => "paper", () => now);
  for (let i = 0; i < 6; i++) room.join(`p${i}`, "forest-golem", 170, `参加者${i + 1}`);
  const roomId = room.snapshot().roomId;
  room.start(roomId);
  for (let i = 0; i < 6; i++) room.command(`p${i}`, { roomId, round: 1, requestId: `p${i}`, action: "attack", hand: "scissors" });
  now += 10000;
  await page.route("**/api/local-raid*", (route) => route.fulfill({ json: { state: room.snapshot("p0") } }));
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/battle/raid?sync=local");
    const victory = page.getByRole("region", { name: "討伐成功の結果" });
    const hp = page.getByRole("progressbar", { name: "ボスHP（同期）" });
    await expect(hp).toHaveAttribute("aria-valuenow", "450");
    await expect(victory).toHaveCount(0);
    room.reveal(roomId, 1);
    await expect(page.locator(".raid-rps-result")).toContainText("勝ち ×2");
    await expect(victory).toHaveCount(0);
    room.impact(roomId, 1, "action");
    await expect(hp).toHaveAttribute("aria-valuenow", "0");
    await expect(victory).toContainText("討伐成功！");
    await expect(victory).toContainText("勝ち ×2");
    await expect(victory).toContainText("攻撃値75");
    await expect(victory).toContainText("ボスの反撃0");
    await expect(page.getByRole("button", { name: "じゃんけんで送信", exact: true })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "行動を選ぶ" })).toHaveCount(0);
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-renderer", /webgl|fallback/);
    await page.screenshot({ path: testInfo.outputPath("raid-mobile-victory.png") });
    // The final summary remains available after reload.
    await page.reload();
    await expect(victory).toContainText("攻撃値75");
    for (const width of [375, 430]) {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 932 });
      await page.screenshot({ path: testInfo.outputPath(`raid-mobile-victory-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      const box = await page.getByRole("link", { name: "ホームへ戻る" }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y + box!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
    }
  } finally { await db.player.delete({ where: { id: player.id } }); await db.$disconnect(); }
});

test("synced hand colors are exclusive and the result waits for the next shared round", async ({ page }) => {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "選択UI確認" } });
  const { player } = await response.json();
  let now = Date.now();
  const room = new LocalRaidRoom(() => "paper", () => now);
  room.join(player.id, "forest-golem", 170, "選択UI確認");
  const roomId = room.snapshot().roomId;
  room.start(roomId);
  await page.route("**/api/local-raid*", async route => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.type === "command") room.command(player.id, input);
    }
    await route.fulfill({ json: { state: room.snapshot(player.id) } });
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/battle/raid?sync=local");
    const hands = page.getByRole("group", { name: "じゃんけんの手を選ぶ" });
    const colors: string[] = [];
    for (const name of ["チョキ", "パー", "グー"]) {
      const choice = page.getByRole("button", { name: `${name}を選択`, exact: true });
      await choice.click();
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await expect(hands.locator('[aria-pressed="true"]')).toHaveCount(1);
      colors.push(await choice.locator("span").evaluate(el => getComputedStyle(el).backgroundImage));
    }
    expect(new Set(colors).size).toBe(3);
    await page.getByRole("button", { name: "じゃんけんで送信", exact: true }).click();
    await expect(page.locator(".raid-rps-result")).toContainText("送信完了");
    now += 10000; room.snapshot(); room.reveal(roomId, 1);
    await expect(page.locator(".raid-rps-result")).toContainText("負け ×0.5");
    await page.waitForTimeout(2200);
    await expect(page.locator(".raid-rps-result")).toContainText("負け ×0.5");
    await expect(page.getByRole("button", { name: "次の受付まで待機", exact: true })).toBeDisabled();
    room.finish(roomId, 1);
    await expect(page.getByRole("button", { name: "グーを選択", exact: true })).toBeEnabled();
    await expect(hands.locator('[aria-pressed="true"]')).toHaveCount(0);
  } finally { await db.player.delete({ where: { id: player.id } }); await db.$disconnect(); }
});
