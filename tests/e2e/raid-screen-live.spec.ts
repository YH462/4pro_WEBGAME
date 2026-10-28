import { test, expect } from "@playwright/test";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";

test("shared WebGL round launches from every actor and counters the whole team once", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  let now = 0; const room = new LocalRaidRoom(() => "paper", () => now);
  for (let i = 0; i < 3; i++) room.join(`p${i}`, "forest-golem", 170, `同キャラ${i}`);
  const roomId = room.snapshot().roomId;
  await page.route("**/api/local-raid", (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.type === "reveal") room.reveal(input.roomId, input.turn);
      if (input.type === "impact") room.impact(input.roomId, input.turn, input.kind);
      if (input.type === "finish") room.finish(input.roomId, input.turn);
    }
    return route.fulfill({ json: { state: room.snapshot() } });
  });
  await page.setViewportSize({ width: 1600, height: 900 }); await page.clock.install();
  await page.goto("/raid/screen?sync=local");
  const main = page.getByRole("main", { name: "会場レイドスクリーン" }), arena = page.getByRole("region", { name: "ボスとエフェクト" });
  await expect(arena).toHaveAttribute("data-renderer", "webgl");
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  room.start(roomId);
  await page.clock.runFor(600);
  const countdown = page.getByRole("timer", { name: "全員共通の入力受付" });
  await expect(countdown).toContainText("10秒");
  await page.screenshot({ path: testInfo.outputPath("raid-shared-input-countdown.png") });
  for (const [i, hand] of ["paper", "scissors", "rock"].entries()) room.command(`p${i}`, { roomId, round: 1, requestId: `p${i}`, action: "attack", hand: hand as "paper" | "rock" | "scissors" });
  now += 10000;
  const drive = async (attribute: string, value: string) => {
    for (let i = 0; i < 50 && await main.getAttribute(attribute) !== value; i++) await page.clock.runFor(200);
    await expect(main).toHaveAttribute(attribute, value);
  };
  await drive("data-cue", "rps"); await drive("data-cue", "critical"); await page.clock.runFor(200);
  const ids = room.snapshot().members.map((member) => member.id);
  expect((await main.getAttribute("data-actor-ids"))?.split(",")).toEqual(ids);
  for (const id of ids) await expect(page.locator(`[data-participant-id="${id}"]`)).toHaveAttribute("data-active", "true");
  await page.screenshot({ path: testInfo.outputPath("raid-shared-three-attacks.png") });
  await drive("data-cue", "counter"); await page.clock.runFor(1000);
  expect(room.snapshot().counterTurn).toBe(0);
  await drive("data-counter-impact", "true");
  await expect.poll(() => room.snapshot().counterTurn).toBe(1);
  expect(room.snapshot().members.map((member) => member.hp)).toEqual([157, 157, 157]);
  await page.screenshot({ path: testInfo.outputPath("raid-shared-team-counter.png") });
  await page.clock.runFor(1800); await expect.poll(() => room.snapshot().round.number).toBe(2);
  room.reset(); for (let i = 0; i < 20; i++) room.join(`team-${i}`, ["forest-golem", "flame-dragon", "thunder-fox", "aqua-spirit"][i % 4], 170, `参加者${i + 1}`);
  const nextRoom = room.snapshot().roomId; room.start(nextRoom);
  for (let i = 0; i < 20; i++) room.command(`team-${i}`, { roomId: nextRoom, round: 1, requestId: `t${i}`, action: i % 3 === 0 ? "heal" : "attack", hand: i % 2 ? "scissors" : "paper" });
  now += 10000; await drive("data-cue", "critical"); await page.clock.runFor(200);
  await expect(page.getByRole("list", { name: "参加者とキャラクター" }).getByRole("listitem")).toHaveCount(20);
  expect((await main.getAttribute("data-actor-ids"))?.split(",")).toHaveLength(20);
  await page.screenshot({ path: testInfo.outputPath("raid-shared-twenty-actions.png") });
});
