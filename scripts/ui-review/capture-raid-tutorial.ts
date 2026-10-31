import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { LocalRaidRoom, raidTutorialMs } from "../../src/lib/local-raid-room";

// Capture the real phone UI using a temporary guest in the isolated review DB.
// Run against a local next start with EVENT_ID=raid-phone-guide-test.
const eventId = "raid-phone-guide-test", origin = "http://localhost:13026";
const database = new URL(process.env.DATABASE_URL || "postgresql://localhost/unused");
if (process.env.EVENT_ID !== eventId || database.hostname !== "127.0.0.2" || database.port !== "55436") throw new Error("Use the isolated phone-guide test database.");
const db = new PrismaClient(), browser = await chromium.launch();
const token = randomBytes(32).toString("base64url");
let playerId: string | undefined;
try {
  await db.event.upsert({ where: { id: eventId }, create: { id: eventId, name: "スマホ操作説明の撮影" }, update: {} });
  const player = await db.player.create({ data: { eventId, nickname: "操作の見本", sessions: { create: { tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } } } });
  playerId = player.id;
  let now = 1000;
  const room = new LocalRaidRoom(() => "paper", () => now), roomId = room.snapshot().roomId;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addCookies([{ name: "fourpro_guest", value: token, url: origin }]);
  const page = await context.newPage();
  await page.route("**/api/raid*", async route => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.type === "join") room.join(player.id, "forest-golem", 170, player.nickname!, "フォレストゴーレム");
      if (input.type === "command") room.command(player.id, input);
    }
    await route.fulfill({ json: { state: room.snapshot(player.id) } });
  });
  await page.goto(`${origin}/battle/raid?room=${roomId}`);
  const main = page.getByRole("main");
  const frames: { image: string; focus: { x: number; y: number; width: number; height: number } }[] = [];
  const directory = "public/raid-tutorial";
  await mkdir(directory, { recursive: true });
  async function capture(name: string, target: ReturnType<typeof page.getByRole>) {
    await target.waitFor({ state: "visible" });
    const container = (await main.boundingBox())!, focus = (await target.boundingBox())!;
    await main.screenshot({ path: `${directory}/${name}.jpg`, type: "jpeg", quality: 92, animations: "disabled" });
    frames.push({ image: `/raid-tutorial/${name}.jpg`, focus: {
      x: (focus.x - container.x) / container.width * 100, y: (focus.y - container.y) / container.height * 100,
      width: focus.width / container.width * 100, height: focus.height / container.height * 100,
    } });
  }
  await page.getByRole("button", { name: "このレイドに参加", exact: true }).waitFor({ state: "visible" });
  // Allow the character model to finish loading before freezing the guide image.
  await page.waitForTimeout(2500);
  await capture("join", page.getByRole("button", { name: "このレイドに参加", exact: true }));
  await page.getByRole("button", { name: "このレイドに参加", exact: true }).click();
  await page.getByRole("status", { name: "レイド参加状況" }).waitFor();
  room.start(roomId); now += raidTutorialMs; room.snapshot();
  await page.getByRole("button", { name: "攻撃を選択", exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[aria-label="攻撃を選択"]')?.disabled);
  await capture("action", page.getByRole("group", { name: "行動を選ぶ", exact: true }));
  await page.getByRole("button", { name: "攻撃を選択", exact: true }).click();
  await capture("hand", page.getByRole("group", { name: "じゃんけんの手を選ぶ", exact: true }));
  await page.getByRole("button", { name: "チョキを選択", exact: true }).click();
  await page.getByRole("status", { name: "レイド参加状況", exact: true }).filter({ hasText: "送信完了！" }).waitFor();
  await capture("sent", page.getByRole("group", { name: "送信した行動とじゃんけんの手", exact: true }));
  await writeFile("src/components/raid-screen/raid-tutorial-frames.json", JSON.stringify(frames, null, 2) + "\n");
  console.log("Captured four real phone screens and their highlighted control positions.");
  await context.close();
} finally {
  await browser.close();
  if (playerId) await db.player.delete({ where: { id: playerId } });
  await db.$disconnect();
}
