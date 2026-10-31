import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { hashAdminPassword } from "../../src/lib/admin-password";
import type { CharacterHintEditorData } from "../../src/lib/character-hint-input";

const origin = "http://localhost:13026", eventId = "raid-production-test";
const database = new URL(process.env.DATABASE_URL || "postgresql://localhost/unused");
test.skip(process.env.EVENT_ID !== eventId || database.hostname !== "127.0.0.2" || database.port !== "55436", "Use the isolated hint test environment.");
const db = new PrismaClient();
const token = randomBytes(32).toString("base64url"), hash = (value: string) => createHash("sha256").update(value).digest("hex");
let adminId = "", id = "", photo: Buffer, map: Buffer;
const empty = () => ({ location: "", text: "", revision: 0, images: { overview: { action: "keep", alt: "" }, detail: { action: "keep", alt: "" }, map: { action: "keep", alt: "" } } });
const apiPath = () => `/api/admin/characters/${id}/hint`;
async function current(page: Page): Promise<CharacterHintEditorData> { const response = await page.request.get(apiPath()); expect(response.status()).toBe(200); return (await response.json()).hint; }

test.beforeAll(async () => {
  const admin = await db.adminUser.create({ data: { username: `hint_${randomUUID().slice(0, 8)}`, passwordHash: await hashAdminPassword(randomUUID()), sessions: { create: { tokenHash: hash(token), expiresAt: new Date(Date.now() + 3_600_000) } } } }); adminId = admin.id;
  photo = await sharp({ create: { width: 3200, height: 1800, channels: 3, background: "#4692c4" } }).jpeg({ quality: 95 }).withMetadata().toBuffer();
  map = await sharp({ create: { width: 3600, height: 1200, channels: 3, background: "#e6e9ec" } }).composite([{ input: Buffer.from('<svg width="3600" height="1200"><rect x="40" y="40" width="3520" height="1120" fill="none" stroke="#384c62" stroke-width="20"/><text x="200" y="600" font-size="140">HINT MAP TEST</text></svg>') }]).png().toBuffer();
});
test.beforeEach(async ({ context }) => {
  id = `hint-${randomUUID()}`;
  const last = await db.character.aggregate({ _max: { sortOrder: true } });
  await db.character.create({ data: { id, name: "名前を変更済みのキャラ", description: "元の紹介文", element: "FOREST", sortOrder: (last._max.sortOrder ?? 100) + 1, baseHp: 170, baseAttack: 45, baseDefense: 30, baseSpeed: 1 } });
  await context.addCookies([{ name: "fourpro_admin", value: token, url: origin }]);
});
test.afterEach(async () => {
  await db.character.delete({ where: { id } });
  await db.rateLimitBucket.deleteMany({ where: { key: `admin-hint:${adminId}` } });
});
test.afterAll(async () => { await db.adminUser.delete({ where: { id: adminId } }); await db.$disconnect(); });

test("admin saves compressed photos and map, previews the real public layout and preserves character settings", async ({ page, browser }, testInfo) => {
  const before = await db.character.findUniqueOrThrow({ where: { id } });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`/admin/characters/${id}`);
  const editor = page.getByRole("region", { name: "場所のヒントを編集", exact: true });
  await editor.getByRole("textbox", { name: "場所名", exact: true }).fill("工学棟1階・4プロ会場");
  await editor.getByLabel("補足テキスト", { exact: true }).fill("検証用の案内です。\n青い目印を探してね。");
  for (const [label, name, mimeType, buffer] of [["遠くからの写真", "wide.jpg", "image/jpeg", photo], ["アップの写真", "close.jpg", "image/jpeg", photo], ["地図", "map.png", "image/png", map]] as const) {
    await editor.getByLabel(label, { exact: true }).setInputFiles({ name, mimeType, buffer });
  }
  await page.locator("#hint-alt-overview").fill("青い目印を遠くから見た様子");
  const saved = page.waitForResponse(response => response.url().endsWith(`/characters/${id}/hint`) && response.request().method() === "PATCH");
  await editor.getByRole("button", { name: "場所のヒントを保存", exact: true }).click();
  expect((await saved).status()).toBe(200); await expect(editor.getByRole("status")).toHaveText("場所のヒントを保存しました。");
  const hint = await current(page);
  expect(hint.location).toBe("工学棟1階・4プロ会場");
  expect(hint.images.overview).toMatchObject({ width: 1600, height: 900, alt: "青い目印を遠くから見た様子" });
  expect(hint.images.map).toMatchObject({ width: 2400, height: 800 });
  expect(hint.images.overview!.byteLength).toBeLessThan(photo.length);
  const image = await page.request.get(hint.images.overview!.src);
  expect(image.headers()["content-type"]).toBe("image/webp"); expect(image.headers()["cache-control"]).toContain("immutable");
  expect((await sharp(await image.body()).metadata()).exif).toBeUndefined();
  expect(await db.character.findUniqueOrThrow({ where: { id } })).toEqual(before);
  await page.evaluate(() => document.querySelector("main")!.parentElement!.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("admin-hint-saved-mobile.png") });
  await page.setViewportSize({ width: 1366, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("admin-hint-saved-desktop.png") });
  await page.reload(); await expect(editor.getByRole("textbox", { name: "補足テキスト", exact: true })).toHaveValue(hint.text);
  await expect(editor.getByRole("textbox", { name: "場所名", exact: true })).toHaveValue(hint.location);
  const popupPromise = page.waitForEvent("popup"); await editor.getByRole("link", { name: "保存済みのヒントを確認 ↗", exact: true }).click();
  const preview = await popupPromise;
  await expect(preview.locator('[data-hint-media="map"] img').first()).toBeVisible(); await preview.close();
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const publicPage = await visitor.newPage(); await publicPage.goto(`${origin}/collection/${id}/hint`);
    await expect(publicPage.getByRole("heading", { name: before.name, exact: true })).toBeVisible();
    await expect(publicPage.getByLabel("獲得場所", { exact: true })).toHaveText("工学棟1階・4プロ会場");
    await expect(publicPage.getByText("検証用の案内です。", { exact: false })).toBeVisible();
    for (const label of ["遠くから", "アップ", "地図で場所を確認"]) {
      await publicPage.getByRole("button", { name: `${label}を拡大する`, exact: true }).click();
      const dialog = publicPage.getByRole("dialog", { name: label, exact: true }); await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "画像をさらに拡大する", exact: true }).click();
      await expect(dialog.getByLabel("画像の表示倍率", { exact: true })).toHaveText("150%"); await publicPage.keyboard.press("Escape");
    }
    await publicPage.screenshot({ path: testInfo.outputPath("public-hint-with-saved-photos.png") });
    expect((await visitor.cookies()).some(cookie => cookie.name === "fourpro_guest")).toBe(false);
  } finally { await visitor.close(); }
});

test("replace/delete is atomic, stale revisions are rejected and old image bytes are removed", async ({ page }) => {
  const first = empty(); first.location = "第1展示室"; first.text = "元のヒント"; first.images.overview = { action: "replace", alt: "最初の写真" };
  let response = await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(first), overview: { name: "photo.jpg", mimeType: "image/jpeg", buffer: photo } } });
  expect(response.status()).toBe(200); const initial = await current(page), old = initial.images.overview!;
  const { location: _location, ...legacy } = { ...empty(), text: first.text, revision: initial.revision };
  response = await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(legacy) } });
  expect(response.status()).toBe(200); expect((await current(page)).location).toBe("第1展示室");
  response = await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(first), overview: { name: "other.jpg", mimeType: "image/jpeg", buffer: photo } } });
  expect(response.status()).toBe(409); expect((await current(page)).text).toBe("元のヒント");
  expect(await db.characterHintImage.count({ where: { characterId: id } })).toBe(1);
  const next = { ...first, revision: (await current(page)).revision, location: "第2展示室", text: "差し替えたヒント" };
  response = await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(next), overview: { name: "replacement.jpg", mimeType: "image/jpeg", buffer: photo } } });
  expect(response.status()).toBe(200); const replaced = await current(page); expect(replaced.images.overview!.id).not.toBe(old.id);
  expect(replaced.location).toBe("第2展示室");
  expect((await page.request.get(old.src)).status()).toBe(404);
  const remove = empty(); remove.revision = replaced.revision; remove.images.overview.action = "remove";
  response = await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(remove) } });
  expect(response.status()).toBe(200); expect((await current(page)).images.overview).toBeNull();
  expect(await db.characterHintImage.count({ where: { characterId: id } })).toBe(0);
});

test("hint editing requires an administrator and rejects forged origins, unrelated edits and invalid images", async ({ page, request }) => {
  expect((await request.get(apiPath())).status()).toBe(401);
  expect((await request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(empty()) } })).status()).toBe(401);
  expect((await page.request.patch(apiPath(), { headers: { origin: "https://evil.example" }, multipart: { data: JSON.stringify(empty()) } })).status()).toBe(403);
  expect((await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify({ ...empty(), name: "書き換え" }) } })).status()).toBe(400);
  const invalid = empty(); invalid.images.overview.action = "replace";
  expect((await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(invalid), overview: { name: "bad.jpg", mimeType: "image/jpeg", buffer: Buffer.from("invalid") } } })).status()).toBe(400);
  expect((await page.request.patch(apiPath(), { headers: { origin }, multipart: { data: JSON.stringify(invalid), overview: { name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") } } })).status()).toBe(415);
  expect(await db.characterLocationHint.count({ where: { characterId: id } })).toBe(0);
});

test("the four departments, Keidentera and Kanreki expose one-photo editing by fixed ID", async ({ page }) => {
  for (const specialId of ["forest-golem", "thunder-fox", "flame-dragon", "aqua-spirit", "four-pro", "temp-12"]) {
    const response = await page.request.get(`/api/admin/characters/${specialId}/hint`); expect(response.status()).toBe(200);
    const hint: CharacterHintEditorData = (await response.json()).hint; expect(hint.singlePhoto).toBe(true);
    await page.goto(`/admin/characters/${specialId}`);
    const editor = page.getByRole("region", { name: "場所のヒントを編集", exact: true });
    await expect(editor.locator('input[type="file"]')).toHaveCount(1);
    await expect(editor.getByLabel("展示の写真", { exact: true })).toBeVisible();
    await page.goto(`/collection/${specialId}/hint`);
    await expect(page.locator("[data-hint-media]")).toHaveCount(1);
    await expect(page.locator('[data-hint-media="map"]')).toHaveCount(0);
  }
  const forbidden = empty(); forbidden.images.map.action = "replace";
  expect((await page.request.patch("/api/admin/characters/four-pro/hint", { headers: { origin }, multipart: { data: JSON.stringify(forbidden), map: { name: "map.png", mimeType: "image/png", buffer: map } } })).status()).toBe(400);
});

test("Kanreki stores a single venue photo without rewriting its existing identity", async ({ page }) => {
  const target = "temp-12", before = await db.character.findUniqueOrThrow({ where: { id: target } });
  expect(await db.characterLocationHint.count({ where: { characterId: target } })).toBe(0);
  try {
    const edit = empty(); edit.location = "4プロ会場"; edit.text = "4プロ会場の目印を探してね。"; edit.images.overview = { action: "replace", alt: "4プロ会場の写真" };
    const response = await page.request.patch(`/api/admin/characters/${target}/hint`, { headers: { origin }, multipart: { data: JSON.stringify(edit), overview: { name: "venue.jpg", mimeType: "image/jpeg", buffer: photo } } });
    expect(response.status()).toBe(200);
    const hint: CharacterHintEditorData = (await response.json()).hint;
    expect(hint.images.overview).not.toBeNull(); expect(hint.images.detail).toBeNull(); expect(hint.images.map).toBeNull();
    expect(await db.character.findUniqueOrThrow({ where: { id: target } })).toEqual(before);
    await page.goto(`/collection/${target}/hint`);
    await expect(page.locator("[data-hint-media]")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "展示の写真を拡大する", exact: true })).toBeVisible();
    await expect(page.getByLabel("獲得場所", { exact: true })).toHaveText("4プロ会場");
    await expect(page.getByText("4プロ会場の目印を探してね。", { exact: true })).toBeVisible();
  } finally { await db.characterLocationHint.deleteMany({ where: { characterId: target } }); }
});
