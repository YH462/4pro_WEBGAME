import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const playerIds: string[] = [];
async function guest(page: Page) {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "スマホUI確認" } });
  expect(response.status()).toBe(201);
  const { player } = await response.json(); playerIds.push(player.id);
  return player.id as string;
}
test.afterEach(async () => { await db.player.deleteMany({ where: { id: { in: playerIds.splice(0) } } }); });
test.afterAll(async () => { await db.$disconnect(); });

test("the compact partner keeps HP visible while results return automatically to inline controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await guest(page);
  await page.goto("/battle/raid");
  await page.getByLabel("参加キャラクター").selectOption("flame-dragon");
  const character = page.getByRole("img", { name: /フレイムドラゴン：正面/ });
  const hp = page.getByRole("progressbar", { name: "自分のHP（プレビュー）", exact: true });
  await expect(character).toBeVisible(); await expect(hp).toHaveAttribute("aria-valuenow", "120");
  await expect(page.getByRole("button", { name: "じゃんけんの手を選ぼう", exact: true })).toBeDisabled();
  const health = await hp.boundingBox();
  await expect(page.getByRole("region", { name: "自分のキャラクター" })).toContainText("120");
  await page.screenshot({ path: testInfo.outputPath("raid-mobile-select.png") });
  await page.getByRole("button", { name: "チョキを選択", exact: true }).click();
  await page.evaluate(() => { Math.random = () => .99; });
  await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  await page.getByRole("button", { name: "じゃんけんで試す", exact: true }).click();
  await expect(page.locator("[data-phase]")).toHaveAttribute("data-phase", "waiting");
  await expect(page.locator(".raid-rps-result")).not.toContainText("ボス：");
  await page.clock.runFor(2120);
  await expect(page.locator(".raid-rps-result")).toContainText("勝ち ×2");
  await expect(page.locator(".raid-rps-result")).toContainText("攻撃 100");
  await expect(page.getByRole("button", { name: "まもなく次の行動へ", exact: true })).toBeDisabled();
  await expect(hp).toHaveAttribute("aria-valuenow", "120");
  expect(await hp.boundingBox()).toEqual(health);
  await page.screenshot({ path: testInfo.outputPath("raid-mobile-win.png") });
  await page.clock.runFor(1900); await expect(page.locator("[data-phase]")).toHaveAttribute("data-phase", "result");
  await page.clock.runFor(150); await expect(page.locator("[data-phase]")).toHaveAttribute("data-phase", "select");
  await expect(page.getByRole("button", { name: "攻撃を選択", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "じゃんけんの手を選ぶ" }).locator('[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "回復を選択", exact: true }).click();
  await page.getByRole("button", { name: "グーを選択", exact: true }).click();
  await page.getByRole("button", { name: "じゃんけんで試す", exact: true }).click();
  await page.clock.runFor(2120);
  await expect(page.locator(".raid-rps-result")).toContainText("負け ×0.5");
  await expect(page.locator(".raid-rps-result")).toContainText("自己回復 15");
  await page.clock.runFor(2050);
  await expect(page.getByRole("button", { name: "回復を選択", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await db.playerCharacter.count({ where: { playerId: id } })).toBe(0);
  await expect(hp).toHaveAttribute("aria-valuenow", "120");
});

test("owned partners use their DB growth and preview actions never change saved data", async ({ page }) => {
  const id = await guest(page);
  await db.playerCharacter.createMany({ data: [{ playerId: id, characterId: "forest-golem", hpGrowth: 17, attackGrowth: 4 }, { playerId: id, characterId: "thunder-fox", hpGrowth: 12 }] });
  const before = await db.playerCharacter.findMany({ where: { playerId: id }, orderBy: { characterId: "asc" } });
  await page.goto("/battle/raid");
  await expect(page.getByLabel("参加キャラクター").locator("option")).toHaveCount(2);
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "187");
  await page.getByLabel("参加キャラクター").selectOption("thunder-fox");
  await expect(page.getByRole("img", { name: /サンダーフォックス：正面/ })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow", "137");
  await page.getByRole("button", { name: "パーを選択", exact: true }).click();
  await page.getByRole("button", { name: "じゃんけんで試す", exact: true }).click();
  await expect(page.locator(".raid-rps-result")).toContainText(/攻撃 \d+/);
  expect(await db.playerCharacter.findMany({ where: { playerId: id }, orderBy: { characterId: "asc" } })).toEqual(before);
});

test("the phone works without WebGL and with reduced motion, including automatic return", async ({ page, context }) => {
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl") || type === "experimental-webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await guest(page); await page.goto("/battle/raid");
  await expect(page.getByRole("img", { name: /正面を向いた自分のキャラクター/ })).toBeVisible();
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-renderer", "fallback");
  await expect(page.locator('[data-renderer="fallback"] svg')).toBeVisible();
  await page.getByRole("button", { name: "回復を選択", exact: true }).click();
  await page.getByRole("button", { name: "パーを選択", exact: true }).click();
  await page.getByRole("button", { name: "じゃんけんで試す", exact: true }).click();
  await expect(page.locator(".raid-rps-result")).toContainText(/自己回復 \d+/);
  await expect(page.getByRole("button", { name: "回復を選択", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "レイドのルールを開く", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "レイドの遊び方" })).toContainText("HP・所持キャラクター・育成値は変わりません");
  await page.getByRole("button", { name: "レイドのルールを閉じる", exact: true }).click();
  await page.getByRole("link", { name: "ホーム HOME", exact: true }).click();
  await expect(page.getByRole("region", { name: "4学科の展示マップ", exact: true })).toBeVisible();
});

test("mobile commands stay visible and tappable on small phones, landscape and desktop", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await guest(page);
  for (const size of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await page.goto("/battle/raid");
    await page.getByRole("button", { name: "チョキを選択", exact: true }).click();
    await expect(page.getByRole("button", { name: "じゃんけんで試す", exact: true })).toBeEnabled();
    // Measure settled hit areas after the brief tap/selection transform has finished.
    await page.getByRole("button", { name: "チョキを選択", exact: true }).evaluate(async (button) => {
      await Promise.all(button.getAnimations({ subtree:true }).map((animation) => animation.finished.catch(() => undefined)));
    });
    const failures = await page.evaluate(() => {
      const issues: string[] = [];
      if (document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1) issues.push("page scrolls");
      for (const element of document.querySelectorAll("main button, main select, main [role=progressbar], main [role=img]")) {
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) continue;
        const label = element.getAttribute("aria-label") ?? element.textContent;
        if (bounds.x < 0 || bounds.y < 0 || bounds.right > innerWidth + 1 || bounds.bottom > innerHeight + 1) issues.push(`outside: ${label}`);
        if (element.matches("button,select")) {
          if (bounds.height < 44 || bounds.width < 44) issues.push(`small: ${label}`);
          const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          if (target && !element.contains(target)) issues.push(`covered: ${label}`);
        }
      }
      return issues;
    });
    expect(failures, `${size.width}x${size.height}`).toEqual([]);
    if (size.width <= 430 || size.height === 390 || size.width === 1440) await page.screenshot({ path: testInfo.outputPath(`raid-mobile-${size.width}x${size.height}.png`) });
  }
});

test("the selected partner has its own front-facing 3D portrait and the phone has no enemy model", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await guest(page); await page.setViewportSize({ width:390,height:844 }); await page.goto("/battle/raid");
  await expect(page.getByRole("img", { name:"立体のキング・アクア" })).toHaveCount(0);
  await expect(page.locator(".enemy-fallback-art")).toHaveCount(0);
  for(const id of ["forest-golem","thunder-fox","flame-dragon","aqua-spirit"]) {
    await page.getByLabel("参加キャラクター").selectOption(id);
    const portrait=page.locator(`[data-character-id="${id}"][data-facing="front"]`);
    await expect(portrait).toHaveAttribute("data-renderer","webgl");
    await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    await page.screenshot({ path:testInfo.outputPath(`raid-partner-${id}.png`) });
  }
  await page.getByRole("button", { name:"次のパートナー",exact:true }).click();
  await expect(page.getByLabel("参加キャラクター")).toHaveValue("forest-golem");
  await expect(page.locator('[data-character-id="forest-golem"]')).toHaveAttribute("data-renderer","webgl");
  await expect(page.getByRole("progressbar", { name:"自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow","170");
  await page.getByRole("button", { name:"前のパートナー",exact:true }).click();
  await expect(page.getByLabel("参加キャラクター")).toHaveValue("aqua-spirit");
  await expect(page.locator('[data-character-id="aqua-spirit"]')).toHaveAttribute("data-renderer","webgl");
  await expect(page.getByRole("progressbar", { name:"自分のHP（プレビュー）" })).toHaveAttribute("aria-valuenow","135");
});
