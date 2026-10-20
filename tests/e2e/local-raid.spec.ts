import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { LocalRaidSnapshot } from "../../src/lib/local-raid-types";

const db = new PrismaClient();
const origin = "http://localhost:3000";
const headers = { origin };
const players: string[] = [];
async function guest(request: APIRequestContext, nickname: string) {
  const response = await request.post("/api/guest", { headers, data: { nickname } });
  expect(response.status()).toBe(201);
  players.push((await response.json()).player.id);
}
async function snapshot(request: APIRequestContext, personal = false): Promise<LocalRaidSnapshot> {
  const response = await request.get(`/api/local-raid${personal ? "?personal=1" : ""}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).state;
}
test.afterEach(async ({ request }) => {
  await db.player.deleteMany({ where: { id: { in: players.splice(0) } } });
  await request.post("/api/local-raid", { headers, data: { type: "reset" } });
});
test.afterAll(async () => { await db.$disconnect(); });

test("local API validates sessions/origins, rejects forged stats, and deduplicates commands", async ({ request }) => {
  expect((await request.post("/api/local-raid", { headers, data: { type: "reset" } })).ok()).toBeTruthy();
  const room = await snapshot(request);
  const input = { type: "command", roomId: room.roomId, requestId: randomUUID(), action: "attack", hand: "scissors" };
  expect((await request.post("/api/local-raid", { headers, data: input })).status()).toBe(401);
  await guest(request, "同期API確認");
  expect((await request.post("/api/local-raid", { headers: { origin: "https://evil.example" }, data: { type: "join", characterId: "forest-golem" } })).status()).toBe(403);
  expect((await request.post("/api/local-raid", { headers, data: { type: "join", characterId: "four-pro" } })).status()).toBe(403);
  expect((await request.post("/api/local-raid", { headers, data: { type: "join", characterId: "forest-golem", maxHp: 9999 } })).status()).toBe(400);
  expect((await request.post("/api/local-raid", { headers, data: { type: "join", characterId: "forest-golem" } })).ok()).toBeTruthy();
  expect((await request.post("/api/local-raid", { headers, data: { ...input, damage: 9999 } })).status()).toBe(400);
  const first = await request.post("/api/local-raid", { headers, data: input });
  expect(first.ok()).toBeTruthy();
  const firstBody = await first.json();
  const replay = await request.post("/api/local-raid", { headers, data: input });
  expect(replay.ok()).toBeTruthy();
  expect((await replay.json()).result).toEqual(firstBody.result);
  expect((await snapshot(request)).bossHp).toBe(firstBody.state.bossHp);
  expect((await snapshot(request)).me).toBeNull();
  expect((await snapshot(request, true)).me?.maxHp).toBe(170);
});

test("two independent phones share a screen, heal only themselves, and reconnect after reset", async ({ browser, page, request }) => {
  test.setTimeout(60000);
  await request.post("/api/local-raid", { headers, data: { type: "reset" } });
  const alpha = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
  const beta = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 667 } });
  try {
    // Network/state integration is independent of WebGL; avoid three software-GPU arenas in CI.
    for (const context of [alpha, beta, page.context()]) await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === "webgl2" || type === "webgl" || type === "experimental-webgl") return null;
        return Reflect.apply(original, this, [type, ...args]);
      } });
    });
    // Exercise the actual first-visit guest flow, including returning to the sync URL.
    const phoneA = await alpha.newPage();
    const phoneB = await beta.newPage();
    await phoneA.goto("/battle/raid?sync=local");
    await expect(phoneA).toHaveURL(/\/start\?next=local-raid/);
    await phoneA.getByLabel("ニックネーム", { exact: false }).fill("同期確認A");
    await phoneA.getByRole("button", { name: "ゲストではじめる", exact: true }).click();
    await expect(phoneA).toHaveURL(/\/battle\/raid\?sync=local/);
    const alphaPlayer = await alpha.request.get("/api/me");
    players.push((await alphaPlayer.json()).player.id);
    await guest(beta.request, "同期確認B");
    await phoneB.goto("/battle/raid?sync=local");
    await page.goto("/raid/screen?sync=local");
    await expect.poll(async () => (await snapshot(request)).participants).toBe(2);
    await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuenow", "450");
    await expect(page.getByText("ローカル同期中", { exact: true })).toBeVisible();

    await phoneA.getByRole("button", { name: /じゃんけんで送信/ }).click();
    await phoneA.getByRole("button", { name: "チョキを選択", exact: true }).click();
    await phoneA.getByRole("button", { name: "この手で送信", exact: true }).click();
    await expect(phoneA.locator(".raid-rps-result")).toContainText(/攻撃 (25|50|100)/);
    await phoneA.getByRole("button", { name: "閉じて続ける", exact: true }).click();
    const attacked = await snapshot(request);
    expect(attacked.bossHp).toBeLessThan(450);
    await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuenow", String(attacked.bossHp));
    for (const phone of [phoneA, phoneB]) await expect(phone.getByRole("progressbar", { name: "ボスHP（同期）", exact: true })).toHaveAttribute("aria-valuenow", String(attacked.bossHp));
    await expect(phoneA.getByRole("progressbar", { name: "自分のHP（同期）", exact: true })).toHaveAttribute("aria-valuenow", "150");
    await expect(phoneB.getByRole("progressbar", { name: "自分のHP（同期）", exact: true })).toHaveAttribute("aria-valuenow", "170");

    await phoneA.getByRole("button", { name: "回復を選択", exact: true }).click();
    await phoneA.getByRole("button", { name: /じゃんけんで送信/ }).click();
    await phoneA.getByRole("button", { name: "この手で送信", exact: true }).click();
    await expect(phoneA.locator(".raid-rps-result")).toContainText(/自己回復 (15|20)/);
    await phoneA.getByRole("button", { name: "閉じて続ける", exact: true }).click();
    const healed = await snapshot(alpha.request, true);
    expect(healed.bossHp).toBe(attacked.bossHp);
    expect(healed.me?.hp).toBe(150 + healed.me!.lastResult!.amount - 20);
    await expect(phoneB.getByRole("progressbar", { name: "自分のHP（同期）", exact: true })).toHaveAttribute("aria-valuenow", "170");
    await expect(page.getByText(/同期確認A：.*自己回復/)).toBeVisible();

    await phoneA.reload();
    await expect(phoneA.getByRole("progressbar", { name: "自分のHP（同期）", exact: true })).toHaveAttribute("aria-valuenow", String(healed.me!.hp));
    await page.getByRole("button", { name: "同期設定", exact: true }).click();
    await page.getByRole("button", { name: "同期をリセット", exact: true }).click();
    await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuenow", "450");
    await expect.poll(async () => (await snapshot(request)).participants).toBe(2);
    for (const phone of [phoneA, phoneB]) await expect(phone.getByRole("progressbar", { name: "自分のHP（同期）", exact: true })).toHaveAttribute("aria-valuenow", "170");
    for (const phone of [phoneA, phoneB]) await expect(phone.getByRole("button", { name: /じゃんけんで送信/ })).toBeEnabled();
  } finally { await alpha.close(); await beta.close(); }
});
