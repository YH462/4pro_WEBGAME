import { test, expect } from "@playwright/test";

test("PC effects demo renders attacks with different strengths and keeps the shared raid untouched", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const syncRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/local-raid")) syncRequests.push(request.method()); });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install({ time: new Date("2026-10-20T06:00:00Z") });
  await page.goto("/raid/screen?demo=effects");
  const stage = page.getByRole("region", { name: "ボスとエフェクト" });
  await expect(stage).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 });
  const hp = page.getByRole("progressbar", { name: "演出デモのボスHP" });
  await expect(hp).toHaveAttribute("aria-valuenow", "450");
  await page.getByRole("button", { name: "通常攻撃", exact: true }).click();
  await expect(hp).toHaveAttribute("aria-valuenow", "400");
  await expect(stage).toContainText("50");
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 10_000)));
  await page.getByRole("button", { name: "2倍攻撃", exact: true }).click();
  await page.clock.runFor(1100);
  await expect(hp).toHaveAttribute("aria-valuenow", "300");
  await expect(stage).toContainText("100");
  await page.getByRole("button", { name: "演出を一時停止", exact: true }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-paused", "true");
  // Browser CSS animations use a separate clock from rAF. Capture both at the same instant.
  await stage.evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => { animation.currentTime = 1100; animation.pause(); }));
  await expect(stage.getByText("100", { exact: true }).locator("..")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("raid-showcase-critical.png") });
  await page.clock.resume();
  await page.getByRole("button", { name: "今の演出をもう一度", exact: true }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-paused", "false");
  await expect(hp).toHaveAttribute("aria-valuenow", "300");
  for (const [label, cue] of [["自己回復", "heal"], ["ボスの反撃", "counter"], ["ボス弱体", "weaken"], ["討伐成功", "victory"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("main")).toHaveAttribute("data-cue", cue);
  }
  await expect(hp).toHaveAttribute("aria-valuenow", "0");
  await expect(stage).toContainText("討伐成功");
  await page.getByRole("button", { name: "連続デモ", exact: true }).click();
  await expect(page.getByRole("button", { name: "連続デモ", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("main")).toHaveAttribute("data-cue", "idle");
  await expect(page.getByRole("main")).toHaveAttribute("data-cue", "attack", { timeout: 5000 });
  expect(syncRequests).toEqual([]);
});

test("the visual demo remains controllable without WebGL and with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(type)) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } });
  });
  await page.goto("/raid/screen?demo=effects");
  await expect(page.getByRole("region", { name: "ボスとエフェクト" })).toHaveAttribute("data-renderer", "fallback");
  await expect(page.locator(".enemy-fallback-art")).toBeVisible();
  await expect(page.getByRole("button", { name: "連続デモ", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "自己回復", exact: true }).click();
  await expect(page.getByRole("region", { name: "ボスとエフェクト" })).toContainText("+60");
  await expect(page.getByRole("region", { name: "レイド参加案内" }).getByRole("button", { name: "参加QRを大きく表示" })).toBeVisible();
});
