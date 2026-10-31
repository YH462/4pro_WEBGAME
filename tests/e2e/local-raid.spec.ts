import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { LocalRaidSnapshot } from "../../src/lib/local-raid-types";
const db = new PrismaClient(), origin = "http://localhost:3000", headers = { origin };
const players: string[] = [];
async function guest(request: APIRequestContext, nickname: string) {
  const response = await request.post("/api/guest", { headers, data: { nickname } }); expect(response.status()).toBe(201);
  players.push((await response.json()).player.id);
}
async function snapshot(request: APIRequestContext, personal = false): Promise<LocalRaidSnapshot> {
  const response = await request.get(`/api/local-raid${personal ? "?personal=1" : ""}`); expect(response.ok()).toBeTruthy(); return (await response.json()).state;
}
test.afterEach(async ({ request }) => {
  await db.player.deleteMany({ where: { id: { in: players.splice(0) } } });
  await request.post("/api/local-raid", { headers, data: { type: "reset" } });
});
test.afterAll(async () => { await db.$disconnect(); });

test("round API validates sessions, origin and one locked submission, without early outcomes", async ({ request }) => {
  test.setTimeout(80_000);
  await request.post("/api/local-raid", { headers, data: { type: "reset" } });
  const room = await snapshot(request);
  const input = { type: "command", roomId: room.roomId, round: 1, requestId: randomUUID(), action: "attack", hand: "scissors" };
  expect((await request.post("/api/local-raid", { headers, data: input })).status()).toBe(401);
  await guest(request, "一斉API確認");
  expect((await request.post("/api/local-raid", { headers: { origin: "https://evil.example" }, data: { type: "join", characterId: "forest-golem" } })).status()).toBe(403);
  expect((await request.post("/api/local-raid", { headers, data: { type: "join", characterId: "four-pro" } })).status()).toBe(403);
  expect((await request.post("/api/local-raid", { headers, data: { type: "join", characterId: "forest-golem", maxHp: 9999 } })).status()).toBe(400);
  await request.post("/api/local-raid", { headers, data: { type: "join", characterId: "forest-golem" } });
  await request.post("/api/local-raid", { headers, data: { type: "start", roomId: room.roomId } });
  await expect.poll(async () => (await snapshot(request)).round.phase, { timeout: 55_000 }).toBe("collecting");
  expect((await request.post("/api/local-raid", { headers, data: { ...input, damage: 9999 } })).status()).toBe(400);
  for (let i = 0; i < 2; i++) expect((await request.post("/api/local-raid", { headers, data: input })).ok()).toBeTruthy();
  const accepted = await snapshot(request, true);
  expect(accepted).toMatchObject({ bossHp: 450, results: [], round: { submitted: 1, phase: "collecting" }, me: { submission: { hand: "scissors", round: 1 } } });
  expect((await snapshot(request)).me).toBeNull();
  expect((await request.post("/api/local-raid", { headers, data: { ...input, requestId: randomUUID() } })).status()).toBe(409);
  expect((await request.post("/api/local-raid", { headers, data: { ...input, hand: "rock" } })).status()).toBe(409);
});

test("three phones share one countdown and hand, receive different outcomes, and take one team counter", async ({ browser, page, request }, testInfo) => {
  test.setTimeout(180000);
  await request.post("/api/local-raid", { headers, data: { type: "reset" } });
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })));
  try {
    // Each real phone has its own GPU. Keep the network/round test independent of
    // three software WebGL renderers competing on the same test PC.
    const withoutWebGl = () => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type.startsWith("webgl") || type === "experimental-webgl") return null;
        return Reflect.apply(original, this, [type, ...args]);
      } });
    };
    await Promise.all([page.context(), ...contexts].map((context) => context.addInitScript(withoutWebGl)));
    for (let i = 0; i < contexts.length; i++) await guest(contexts[i].request, `一斉確認${i}`);
    const phones = await Promise.all(contexts.slice(0, 3).map((context) => context.newPage()));
    for (const phone of phones) await phone.goto("/battle/raid?sync=local");
    await expect.poll(async () => (await snapshot(request)).members.filter((member) => member.nickname.startsWith("一斉確認")).length).toBe(3);
    for (const phone of phones) {
      await expect(phone.getByRole("combobox", { name: "参加キャラクター" })).toBeEnabled();
      await expect(phone.getByRole("button", { name: "攻撃を選択", exact: true })).toBeDisabled();
    }
    await page.goto("/raid/screen?sync=local");
    await page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true }).click();
    await expect(page.getByRole("region", { name: "バトル前のルール説明" })).toBeVisible();
    await expect.poll(async () => (await snapshot(request)).round.phase, { timeout: 55_000 }).toBe("collecting");
    const initial = await snapshot(request);
    expect(initial.round.closesAt! - initial.serverNow).toBeGreaterThan(8000);
    for (const phone of phones) await expect(phone.getByRole("timer", { name: "入力締め切りまで" })).toContainText(/あと\d+秒/);
    await Promise.all(["グー", "チョキ", "パー"].map(async (label, i) => {
      await phones[i].getByRole("button", { name: "攻撃を選択", exact: true }).click();
      await phones[i].getByRole("button", { name: `${label}を選択`, exact: true }).click();
      await expect(phones[i].locator(".raid-rps-result")).toContainText("送信完了");
      await expect(phones[i].getByRole("group", { name: "送信した行動とじゃんけんの手" })).toContainText(`攻撃 / ${label}`);
    }));
    await phones[0].reload();
    await expect(phones[0].getByRole("group", { name: "送信した行動とじゃんけんの手" })).toContainText("攻撃 / グー");
    await phones[0].screenshot({ path: testInfo.outputPath("raid-mobile-submitted-hand.png") });
    for (const phone of phones) await expect(phone.locator(".raid-rps-result")).not.toContainText("ボス：");
    await expect.poll(async () => (await snapshot(request)).round.phase, { timeout: 15000, intervals: [200] }).toBe("playing");
    const resolved = await snapshot(request), mine = resolved.results.filter((result) => result.nickname.startsWith("一斉確認"));
    expect(mine).toHaveLength(3); expect(new Set(mine.map((result) => result.boss)).size).toBe(1);
    expect(mine.map((result) => result.multiplier).sort()).toEqual([.5, 1, 2]);
    for (const phone of phones) await expect(phone.locator(".raid-rps-result")).not.toContainText("ボス：");
    const stage = page.getByRole("main", { name: "会場レイドスクリーン" });
    await expect(stage).toHaveAttribute("data-cue", "rps");
    for (let i = 0; i < phones.length; i++) {
      const result = mine.find((entry) => entry.nickname === `一斉確認${i}`)!;
      await expect(phones[i].locator(".raid-rps-result")).toContainText(`${result.label} ×${result.multiplier}`);
      await expect(phones[i].getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", "170");
    }
    expect((await contexts[3].request.post("/api/local-raid", { headers, data: { type: "join", characterId: "forest-golem" } })).status()).toBe(200);
    expect((await snapshot(contexts[3].request, true)).me).toMatchObject({ hp: 170, eligibleRound: 2 });
    for (const phone of phones) await expect(phone.getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", "157", { timeout: 8000 });
    expect((await snapshot(contexts[3].request, true)).me).not.toBeNull();
    await expect.poll(async () => (await snapshot(request)).round.number, { timeout: 8000 }).toBe(2);
    for (const phone of phones) await expect(phone.getByRole("button", { name: "攻撃を選択", exact: true })).toBeEnabled();
    await phones[0].screenshot({ path: testInfo.outputPath("raid-mobile-shared-countdown.png") });
    expect(await phones[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    // Self-healing is visible before the single counter.
    await phones[0].getByRole("button", { name: "回復を選択", exact: true }).click();
    await phones[0].getByRole("button", { name: "グーを選択", exact: true }).click();
    await expect(phones[0].getByRole("group", { name: "送信した行動とじゃんけんの手" })).toContainText("回復 / グー");
    await expect.poll(async () => (await snapshot(request)).round.phase, { timeout: 15000, intervals: [200] }).toBe("playing");
    const heal = (await snapshot(contexts[0].request, true)).me!.lastResult!;
    await expect(phones[0].locator(".raid-rps-result")).toContainText(`自己回復 ${heal.amount}`, { timeout: 6000 });
    await expect(phones[0].getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", String(157 + heal.amount));
    await expect(phones[0].getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", String(144 + heal.amount), { timeout: 8000 });
    expect((await snapshot(contexts[3].request, true)).me).not.toBeNull();
    await request.post("/api/local-raid", { headers, data: { type: "reset" } });
    await expect(phones[0].getByRole("status", { name: "レイド参加状況" }).filter({ hasText: "ルール説明の開始を待っています" })).toBeVisible();
    await expect(phones[0].getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", "170");
  } finally { for (const context of contexts) await context.close(); }
});
