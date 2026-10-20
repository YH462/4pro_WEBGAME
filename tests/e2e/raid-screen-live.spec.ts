import { test, expect } from "@playwright/test";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";

test("the shared WebGL arena fires from each participant and keeps queued operations separate", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const room = new LocalRaidRoom(() => "paper");
  room.join("alpha", "forest-golem", 170, "同キャラA", "フォレストゴーレム");
  room.join("beta", "forest-golem", 170, "同キャラB", "フォレストゴーレム");
  await page.route("**/api/local-raid", (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.type === "reveal") room.reveal(input.roomId, input.turn);
    }
    return route.fulfill({ json: { state: room.snapshot() } });
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.clock.install();
  await page.goto("/raid/screen?sync=local");
  const main = page.getByRole("main", { name: "会場レイドスクリーン" });
  const stage = page.getByRole("region", { name: "ボスとエフェクト" });
  await expect(stage).toHaveAttribute("data-renderer", "webgl");
  await expect(page.getByRole("list", { name: "参加者とキャラクター" }).getByRole("listitem")).toHaveCount(2);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 10_000)));
  const command = (player: string, requestId: string, hand: "paper" | "scissors") => room.command(player, { roomId: room.snapshot().roomId, requestId, action: "attack", hand }).result;
  const a = command("alpha", "same-request-id", "paper");
  const b = command("beta", "same-request-id", "scissors");
  const waitCue = async (cue: string, id: string) => {
    for (let i = 0; i < 40; i++) {
      if (await main.getAttribute("data-cue") === cue && await main.getAttribute("data-actor-id") === id) return;
      await page.clock.runFor(250);
    }
    await expect(main).toHaveAttribute("data-cue", cue);
    await expect(main).toHaveAttribute("data-actor-id", id);
  };
  await waitCue("rps", a.participantId);
  await waitCue("attack", a.participantId);
  await page.clock.runFor(200);
  await expect(page.locator(`[data-participant-id="${a.participantId}"]`)).toHaveAttribute("data-active", "true");
  await expect(stage).toContainText("50");
  await page.screenshot({ path: testInfo.outputPath("raid-screen-player-a.png") });
  await waitCue("counter", a.participantId);
  await waitCue("rps", b.participantId);
  await waitCue("critical", b.participantId);
  await page.clock.runFor(200);
  await expect(page.locator(`[data-participant-id="${b.participantId}"]`)).toHaveAttribute("data-active", "true");
  await expect(page.locator(`[data-participant-id="${a.participantId}"]`)).toHaveAttribute("data-active", "false");
  await expect(stage).toContainText("100");
  await page.screenshot({ path: testInfo.outputPath("raid-screen-player-b.png") });
  await page.clock.runFor(800);
  await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuenow", "300");
  room.reset();
  await page.clock.runFor(800);
  await expect(main).toHaveAttribute("data-cue", "idle");
  await expect(page.getByRole("list", { name: "参加者とキャラクター" }).getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuenow", "450");
  for (let i = 0; i < 20; i++) room.join(`team-${i}`, ["forest-golem", "thunder-fox", "flame-dragon", "aqua-spirit"][i % 4], 170, `参加者${i + 1}`);
  await page.clock.runFor(800);
  const roster = page.getByRole("list", { name: "参加者とキャラクター" });
  await expect(roster.getByRole("listitem")).toHaveCount(20);
  const rosterBounds = await roster.boundingBox(), footerBounds = await page.locator("footer").boundingBox();
  expect(rosterBounds!.y + rosterBounds!.height).toBeLessThan(footerBounds!.y);
  const final = command("team-19", "last-slot", "scissors");
  await waitCue("critical", final.participantId);
  await page.clock.runFor(200);
  await page.screenshot({ path: testInfo.outputPath("raid-screen-twenty-players.png") });
});
