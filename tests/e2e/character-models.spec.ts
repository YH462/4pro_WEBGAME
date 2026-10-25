import { test, expect } from "@playwright/test";

test("initial load and refresh show loading until the real models are ready", async ({ page }) => {
  test.setTimeout(60_000);
  let release!: () => void;
  let gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/models/characters/*.glb", async (route) => {
    await gate; await route.continue();
  });
  const models = page.locator("[data-model-url]");
  const checkLoading = async () => {
    await expect(models).toHaveCount(4);
    for (const model of await models.all()) {
      // Wait for WebGL initialization too, to catch the procedural 3D flash after hydration.
      await expect(model).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 });
      await expect(model).toHaveAttribute("data-model-state", "loading");
      await expect(model.getByRole("status")).toHaveText("モデルを読み込み中…");
      await expect(model.locator("svg")).toHaveCount(0);
      await expect(model.locator("canvas")).toBeHidden();
    }
  };
  try {
    await page.goto("/models", { waitUntil: "domcontentloaded" });
    await checkLoading(); release();
    await expect(page.locator('[data-model-state="ready"]')).toHaveCount(4, { timeout: 30_000 });
    gate = new Promise<void>((resolve) => { release = resolve; });
    await page.reload({ waitUntil: "domcontentloaded" });
    await checkLoading(); release();
    await expect(page.locator('[data-model-state="ready"]')).toHaveCount(4, { timeout: 30_000 });
    await expect(page.getByRole("status")).toHaveCount(0);
  } finally { release(); }
});

test("the four embedded GLBs load with the confirmed department mapping", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/models");
  for (const [id, code, department] of [
    ["forest-golem", "m", "機械科"], ["thunder-fox", "e", "電気情報"],
    ["flame-dragon", "s", "電子制御"], ["aqua-spirit", "c", "建設システム"],
  ]) {
    const card = page.getByRole("region", { name: `${code.toUpperCase()}：${department}`, exact: true });
    const model = card.locator(`[data-character-id="${id}"]`);
    await expect(model).toHaveAttribute("data-model-url", `/models/characters/${code}.glb`);
    await expect(model).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 });
    await expect(model).toHaveAttribute("data-model-state", "ready", { timeout: 30_000 });
  }
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("four-blender-models.png"), fullPage: true });
});

test("a failed model fetch retains a usable placeholder and WebGL loss shows the illustration", async ({ page }) => {
  await page.route("**/models/characters/s.glb", (route) => route.abort());
  await page.goto("/models");
  const model = page.locator('[data-character-id="flame-dragon"]');
  await expect(model).toHaveAttribute("data-model-state", "fallback", { timeout: 30_000 });
  await expect(model).toHaveAttribute("data-renderer", "webgl");
  await expect(model.locator("canvas")).toBeVisible();
  await model.locator("canvas").evaluate((canvas) => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await expect(model).toHaveAttribute("data-renderer", "fallback");
  await expect(model.locator("svg")).toBeVisible();
});

test("the screen demo replaces all four ally placeholders with the Blender models", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/raid/screen?demo=effects");
  const stage = page.getByRole("region", { name: "ボスとエフェクト" });
  await expect(stage).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 });
  await expect(stage.locator("canvas")).toHaveAttribute("data-character-models", "thunder-fox,flame-dragon,forest-golem,aqua-spirit", { timeout: 30_000 });
});
