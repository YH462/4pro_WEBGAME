import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { LocalRaidRoom, raidTutorialMs } from "../../src/lib/local-raid-room";

const db = new PrismaClient();
test("a lethal shared attack shows a persistent victory panel only after screen impact", async ({ page }, testInfo) => {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "討伐UI確認" } });
  const { player } = await response.json();
  let now = 0;
  const room = new LocalRaidRoom(() => "paper", () => now);
  for (let i = 0; i < 6; i++) room.join(`p${i}`, "forest-golem", 170, `参加者${i + 1}`);
  const roomId = room.snapshot().roomId;
  room.start(roomId); now += raidTutorialMs; room.snapshot();
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

test("an automatic submission with a lost response retries the same command ID", async ({ page }) => {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "再送確認" } });
  const { player } = await response.json();
  let now = Date.now();
  const room = new LocalRaidRoom(() => "paper", () => now);
  room.join(player.id, "forest-golem", 170, "再送確認");
  room.start(room.snapshot().roomId); now += raidTutorialMs; room.snapshot();
  const before = room.snapshot(player.id), commands: unknown[] = [];
  let stale = true;
  await page.route("**/api/local-raid*", async route => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.type === "command") {
        commands.push(input); room.command(player.id, input);
        if (commands.length === 1) {
          await route.fulfill({ status: 503, json: { error: "応答を確認できません。同じ行動を再送できます。" } });
          return;
        }
        stale = false;
      }
    }
    await route.fulfill({ json: { state: stale ? before : room.snapshot(player.id) } });
  });
  try {
    await page.goto("/battle/raid?sync=local");
    await page.getByRole("button", { name: "回復を選択", exact: true }).click();
    await page.getByRole("button", { name: "パーを選択", exact: true }).click();
    const retry = page.getByRole("button", { name: "同じ行動を再送する", exact: true });
    await expect(retry).toBeEnabled();
    await expect(page.getByRole("button", { name: "攻撃を選択", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "グーを選択", exact: true })).toBeDisabled();
    await retry.click();
    await expect(page.getByRole("status", { name: "レイド参加状況", exact: true })).toContainText("送信完了！");
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual(commands[0]);
    expect(room.snapshot(player.id).me?.submission).toMatchObject({ action: "heal", hand: "paper" });
    expect(room.snapshot().round.submitted).toBe(1);
  } finally { await db.player.delete({ where: { id: player.id } }); await db.$disconnect(); }
});

test("synced hands submit the chosen action once and reset at the next shared round", async ({ page }, testInfo) => {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "自動送信確認" } });
  const { player } = await response.json();
  let now = Date.now();
  const room = new LocalRaidRoom(() => "paper", () => now);
  room.join(player.id, "forest-golem", 170, "自動送信確認");
  const roomId = room.snapshot().roomId;
  room.start(roomId); now += raidTutorialMs; room.snapshot();
  const commands: { action: string; hand: string }[] = [];
  await page.route("**/api/local-raid*", async route => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.type === "command") {
        commands.push(input); room.command(player.id, input);
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    }
    await route.fulfill({ json: { state: room.snapshot(player.id) } });
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/battle/raid?sync=local");
    await expect(page.getByRole("button", { name: "じゃんけんで送信", exact: true })).toHaveCount(0);
    const colors: string[] = [];
    const cases = [ { name: "グー", hand: "rock", action: "attack", label: "攻撃" }, { name: "チョキ", hand: "scissors", action: "heal", label: "回復" }, { name: "パー", hand: "paper", action: "attack", label: "攻撃" } ];
    for (const [i, choice] of cases.entries()) {
      const hand = page.getByRole("button", { name: choice.name + "を選択", exact: true });
      await expect(hand).toBeDisabled();
      await page.getByRole("button", { name: choice.label + "を選択", exact: true }).click();
      await expect(hand).toBeEnabled();
      expect(commands).toHaveLength(i);
      // Two clicks in the same event loop must still send exactly one command.
      await hand.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
      const sent = page.getByRole("group", { name: "送信した行動とじゃんけんの手" });
      await expect(sent).toContainText(choice.label + " / " + choice.name);
      await expect(page.getByRole("status", { name: "レイド参加状況", exact: true })).toContainText("送信完了！");
      expect(commands).toHaveLength(i + 1);
      expect(commands[i]).toMatchObject({ action: choice.action, hand: choice.hand });
      colors.push(await sent.locator("svg").first().evaluate(el => getComputedStyle(el).backgroundImage));
      await page.screenshot({ path: testInfo.outputPath("auto-submit-" + choice.hand + ".png") });
      now += 10000; room.snapshot(); room.reveal(roomId, i + 1);
      await expect(page.locator("[data-phase]")).toHaveAttribute("data-phase", "result");
      if (i === 0) { await page.waitForTimeout(2200); await expect(page.locator(".raid-rps-result")).toContainText("負け ×0.5"); }
      await expect(page.getByRole("status", { name: "レイド参加状況" }).filter({ hasText: "次の受付まで待機" })).toBeVisible();
      room.finish(roomId, i + 1);
      await expect(page.getByRole("button", { name: "攻撃を選択", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "攻撃を選択", exact: true })).toHaveAttribute("aria-pressed", "false");
      await expect(hand).toBeDisabled();
    }
    expect(new Set(colors).size).toBe(3);
  } finally { await db.player.delete({ where: { id: player.id } }); await db.$disconnect(); }
});
