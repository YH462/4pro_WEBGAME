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
    // Result's two-second interlude expires; the final summary remains available after reload.
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
