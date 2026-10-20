import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
let playerIds: string[] = [];
async function guest(page: Page) {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "バトルUI確認" } });
  expect(response.status()).toBe(201);
  const { player } = await response.json();
  playerIds.push(player.id);
  return player.id as string;
}
test.afterEach(async () => { await db.player.deleteMany({ where: { id: { in: playerIds } } }); playerIds = []; });
test.afterAll(async () => { await db.$disconnect(); });

test("attack and self-heal use RPS multipliers without changing HP or guest data", async ({ page }) => {
  const id = await guest(page);
  await page.goto("/battle/raid");
  await expect(page.getByRole("heading", { name: "レイドバトル", exact: true })).toBeVisible();
  await expect(page.locator(".arena-scene")).toHaveAttribute("data-renderer", /webgl|fallback/);
  await expect(page.locator(".raid-skills button")).toHaveCount(2);
  for (const name of ["攻撃", "回復"]) await expect(page.getByRole("button", { name: `${name}を選択`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "防御を選択", exact: true })).toHaveCount(0);
  await page.getByLabel("参加キャラクター").selectOption("flame-dragon");
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）", exact: true })).toHaveAttribute("aria-valuenow", "120");
  await page.getByRole("button", { name: /じゃんけんで試す/ }).click();
  await page.getByRole("button", { name: "チョキを選択", exact: true }).click();
  await expect(page.getByRole("button", { name: "チョキを選択", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Fix the demo boss hand after framework initialization, so framework random IDs remain distinct.
  await page.evaluate(() => { Math.random = () => 0.99; });
  // Freeze only after hydration and dialog selection have completed.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  await page.getByRole("button", { name: "この手で決定", exact: true }).click();
  await page.clock.runFor(50);
  await expect(page.locator(".raid-rps-result")).toContainText("勝ち ×2");
  await expect(page.locator(".raid-rps-result")).toContainText("攻撃 50 × 2 = 100");
  await expect(page.locator(".raid-confirm")).toBeDisabled();
  await expect(page.locator(".enemy-field")).toHaveClass(/is-attacking/);
  await expect(page.locator(".raid-skills button").first()).toBeDisabled();
  await page.clock.fastForward(1000);
  await expect(page.locator(".raid-feedback")).toHaveText("勝ち ×2：攻撃 100（効果量の例）");
  await expect(page.locator(".raid-confirm")).toBeEnabled();
  await page.getByRole("button", { name: "じゃんけんを閉じる", exact: true }).click();
  await page.clock.runFor(50);
  await expect(page.getByRole("progressbar", { name: "ボスHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "450");
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "120");
  expect(await db.playerCharacter.count({ where: { playerId: id } })).toBe(0);
  await page.getByRole("button", { name: "回復を選択", exact: true }).click();
  await page.clock.runFor(50);
  await page.getByRole("button", { name: /じゃんけんで試す/ }).click();
  await page.clock.runFor(50);
  await page.getByRole("button", { name: "この手で決定", exact: true }).click(); // Rock loses to paper.
  await page.clock.runFor(50);
  await expect(page.locator(".raid-rps-result")).toContainText("負け ×0.5");
  await expect(page.locator(".raid-rps-result")).toContainText("自分を回復 30 × 0.5 = 15");
  await expect(page.locator(".enemy-field")).not.toHaveClass(/is-attacking/);
  await page.clock.fastForward(1000);
  await expect(page.locator(".raid-feedback")).toHaveText("負け ×0.5：自分の回復 15（効果量の例）");
  await page.getByRole("button", { name: "じゃんけんを閉じる", exact: true }).click();
  await page.clock.runFor(50);
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "120");
});

test("owned characters use their DB growth values and the preview never changes them", async ({ page }) => {
  const id = await guest(page);
  await db.playerCharacter.createMany({ data: [{ playerId: id, characterId: "forest-golem", hpGrowth: 17, attackGrowth: 4 }, { playerId: id, characterId: "thunder-fox", hpGrowth: 12 }] });
  const before = await db.playerCharacter.findMany({ where: { playerId: id }, orderBy: { characterId: "asc" } });
  await page.goto("/battle/raid");
  await expect(page.getByLabel("参加キャラクター").locator("option")).toHaveCount(2);
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "187");
  await page.getByLabel("参加キャラクター").selectOption("thunder-fox");
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "137");
  await page.getByRole("button", { name: /じゃんけんで試す/ }).click();
  await page.getByRole("button", { name: "この手で決定", exact: true }).click();
  await expect(page.locator(".raid-feedback")).toHaveText(/攻撃 \d+（効果量の例）/);
  expect(await db.playerCharacter.findMany({ where: { playerId: id }, orderBy: { characterId: "asc" } })).toEqual(before);
});

test("a device without WebGL keeps the enemy and command UI usable", async ({ page, context }) => {
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl2" || type === "webgl" || type === "experimental-webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } });
  });
  await guest(page);
  await page.goto("/battle/raid");
  await expect(page.locator(".arena-scene")).toHaveAttribute("data-renderer", "fallback");
  await expect(page.locator(".enemy-fallback-art")).toBeVisible();
  await page.getByRole("button", { name: "回復を選択", exact: true }).click();
  await page.getByRole("button", { name: /じゃんけんで試す/ }).click();
  await page.getByRole("button", { name: "パーを選択", exact: true }).click();
  await expect(page.getByRole("button", { name: "パーを選択", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => { Math.random = () => 0.99; });
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  await page.getByRole("button", { name: "この手で決定", exact: true }).click();
  await page.clock.runFor(50);
  await expect(page.locator(".healing-preview")).toBeVisible();
  await expect(page.locator(".enemy-field")).not.toHaveClass(/is-attacking/);
  await page.clock.fastForward(1000);
  await expect(page.locator(".raid-feedback")).toHaveText("あいこ ×1：自分の回復 30（効果量の例）");
  await page.getByRole("button", { name: "じゃんけんを閉じる", exact: true }).click();
  await page.clock.runFor(50);
  await page.getByRole("link", { name: "ホーム HOME", exact: true }).click();
  await expect(page.getByRole("region", { name: "4学科の展示マップ", exact: true })).toBeVisible();
});
