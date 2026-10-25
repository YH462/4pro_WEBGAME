import { test, expect } from "@playwright/test";
import { characterModels } from "../../src/lib/character-models";
import { PrismaClient } from "@prisma/client";

test.use({reducedMotion:"reduce"});
const modelCount=Object.keys(characterModels).length;

test("six non-department models appear in the gallery, collection and playable raid selection",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const db=new PrismaClient();let playerId:string|undefined;
  const additional=Object.entries(characterModels).filter(([,asset])=>asset.displayName);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  try{
    await page.goto("/models");
    for(const [id,asset] of additional){
      const card=page.getByRole("region",{name:`${asset.code}：${asset.displayName}`,exact:true});
      await expect(card.getByText("学科なし",{exact:true})).toBeVisible();
      await expect(card.locator(`[data-character-id="${id}"]`)).toHaveAttribute("data-model-state","ready",{timeout:30_000});
      const download=await page.request.get((await card.getByRole("link").getAttribute("href"))!);
      expect(download.ok()).toBe(true);expect((await download.body()).subarray(0,4).toString()).toBe("glTF");
    }
    await page.screenshot({path:testInfo.outputPath("ten-character-models.png"),fullPage:true});
    const response=await page.request.post("/api/guest",{headers:{origin:"http://localhost:3000"},data:{nickname:"追加モデル確認"}});
    expect(response.status()).toBe(201);playerId=(await response.json()).player.id;
    await db.playerCharacter.createMany({data:additional.map(([characterId])=>({playerId:playerId!,characterId}))});
    await page.goto("/collection");
    for(const [,asset] of additional){
      const card=page.getByRole("link",{name:new RegExp(asset.displayName!)});
      await expect(card).toBeVisible();
      await expect(card.locator('[data-character-image="custom"] image')).toHaveAttribute("href",/\/api\/character-images\//);
    }
    await page.goto("/battle/raid");
    const select=page.getByRole("combobox",{name:"参加キャラクター"});
    for(const [id] of additional){
      await select.selectOption(id);
      const model=page.locator(`[data-character-id="${id}"]`);
      await expect(model).toHaveAttribute("data-model-state","ready",{timeout:30_000});
      await expect(model).toHaveAttribute("data-model-url",/\/api\/character-models\/[a-f0-9-]{36}$/);
    }
    await page.screenshot({path:testInfo.outputPath("additional-character-raid.png")});
    expect(errors).toEqual([]);
  }finally{if(playerId)await db.player.deleteMany({where:{id:playerId}});await db.$disconnect();}
});

test("initial load and refresh show loading until the real models are ready", async ({ page }) => {
  test.setTimeout(60_000);
  let release!: () => void;
  let gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/character-models/*", async (route) => {
    await gate; await route.continue();
  });
  const models = page.locator("[data-model-url]");
  const checkLoading = async () => {
    await expect(models).toHaveCount(modelCount);
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
    await expect(page.locator('[data-model-state="ready"]')).toHaveCount(modelCount, { timeout: 30_000 });
    gate = new Promise<void>((resolve) => { release = resolve; });
    await page.reload({ waitUntil: "domcontentloaded" });
    await checkLoading(); release();
    await expect(page.locator('[data-model-state="ready"]')).toHaveCount(modelCount, { timeout: 30_000 });
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
    await expect(model).toHaveAttribute("data-model-url", /\/api\/character-models\/[a-f0-9-]{36}$/);
    await expect(model).toHaveAttribute("data-renderer", "webgl", { timeout: 30_000 });
    await expect(model).toHaveAttribute("data-model-state", "ready", { timeout: 30_000 });
  }
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("four-blender-models.png"), fullPage: true });
});

test("a failed model fetch retains a usable placeholder and WebGL loss shows the illustration", async ({ page }) => {
  const {models}=await (await page.request.get("/api/character-models")).json();
  await page.route(`**${models["flame-dragon"].url}`, (route) => route.abort());
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
