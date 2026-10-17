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

test("touch commands preview an attack without changing HP, EP or guest data", async ({ page }) => {
  // Keep the short animation state observable even on a busy software-GPU CI host.
  // Only browser timers are controlled; authentication and DB time remain real.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  const id = await guest(page);
  await page.goto("/battle");
  await expect(page.getByRole("heading", { name: "バトル", exact: true })).toBeVisible();
  await expect(page.locator(".arena-scene")).toHaveAttribute("data-renderer", /webgl|fallback/);
  await expect(page.locator(".raid-skills button")).toHaveCount(3);
  await page.getByLabel("参加キャラクター").selectOption("flame-dragon");
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）", exact: true })).toHaveAttribute("aria-valuenow", "120");
  await page.getByRole("button", { name: "固有技 3を選択", exact: true }).click();
  await expect(page.getByRole("button", { name: "固有技 3を選択", exact: true })).toHaveAttribute("aria-pressed", "true");
  const button = page.getByRole("button", { name: /演出を試す/ });
  await button.click();
  await expect(page.locator(".raid-confirm")).toBeDisabled();
  await expect(page.locator(".enemy-field")).toHaveClass(/is-attacking/);
  await expect(page.locator(".raid-skills button").first()).toBeDisabled();
  await page.clock.fastForward(1000);
  await expect(page.getByRole("status")).toHaveText("固有技 3の演出を確認しました。");
  await expect(page.locator(".raid-confirm")).toBeEnabled();
  await expect(page.getByRole("progressbar", { name: "ボスHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "450");
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "120");
  await expect(page.locator(".player-ep strong")).toHaveText("30 / 100");
  expect(await db.playerCharacter.count({ where: { playerId: id } })).toBe(0);
  await page.getByRole("button", { name: /演出を試す/ }).click();
  await page.clock.fastForward(1000);
  await expect(page.getByRole("status")).toHaveText("固有技 3の演出を確認しました。");
});

test("owned characters use their DB growth values and the preview never changes them", async ({ page }) => {
  const id = await guest(page);
  await db.playerCharacter.createMany({ data: [{ playerId: id, characterId: "forest-golem", hpGrowth: 17, attackGrowth: 4 }, { playerId: id, characterId: "thunder-fox", hpGrowth: 12 }] });
  const before = await db.playerCharacter.findMany({ where: { playerId: id }, orderBy: { characterId: "asc" } });
  await page.goto("/battle");
  await expect(page.getByLabel("参加キャラクター").locator("option")).toHaveCount(2);
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "187");
  await page.getByLabel("参加キャラクター").selectOption("thunder-fox");
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "137");
  await page.getByRole("button", { name: /演出を試す/ }).click();
  await expect(page.getByRole("status")).toHaveText("固有技 1の演出を確認しました。");
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
  await page.goto("/battle");
  await expect(page.locator(".arena-scene")).toHaveAttribute("data-renderer", "fallback");
  await expect(page.locator(".enemy-fallback-art")).toBeVisible();
  await page.getByRole("button", { name: "固有技 2を選択", exact: true }).click();
  await page.getByRole("button", { name: /演出を試す/ }).click();
  await expect(page.getByRole("status")).toHaveText("固有技 2の演出を確認しました。");
  await page.getByRole("link", { name: "ホーム HOME", exact: true }).click();
  await expect(page.getByRole("region", { name: "4学科の展示マップ", exact: true })).toBeVisible();
});
