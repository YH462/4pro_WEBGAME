import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";
import { collectSmallText } from "../../scripts/ui-review/small-text";

const eventId = "raid-production-test", origin = "http://localhost:13026";
test.skip(process.env.EVENT_ID !== eventId || new URL(process.env.DATABASE_URL || "postgresql://localhost:5432/unused").port !== "55436", "Use the isolated production raid environment.");
const db = new PrismaClient(), playerIds: string[] = [];
async function register(page: Page) {
  const response = await page.request.post("/api/guest", { headers: { origin }, data: { nickname: "レイドQR確認" } });
  expect(response.status()).toBe(201);
  playerIds.push((await response.json()).player.id);
}
test.beforeEach(async () => {
  await db.event.upsert({ where: { id: eventId }, create: { id: eventId, name: "レイド参加の専用検証" }, update: { status: "ACTIVE", endedAt: null, purgeAt: null } });
  await db.raidRoom.deleteMany({ where: { eventId } });
});
test.afterEach(async () => {
  await db.raidRoom.deleteMany({ where: { eventId } });
  await db.player.deleteMany({ where: { id: { in: playerIds.splice(0) } } });
});
test.afterAll(async () => { await db.$disconnect(); });

test("guest registration returns to the raid QR entry instead of the retired CPU battle", async ({ page }) => {
  await page.goto("/battle");
  await expect(page.getByRole("heading", { name: "同期レイド", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "QRでレイドに参加", exact: true })).toHaveAttribute("href", "/start?next=battle");
  await page.getByRole("link", { name: "QRでレイドに参加", exact: true }).click();
  await page.getByRole("textbox", { name: "ニックネーム", exact: true }).fill("バトルから参加");
  const registration = page.waitForResponse(response => response.url() === `${origin}/api/guest` && response.request().method() === "POST");
  await page.getByRole("button", { name: "ゲストではじめる", exact: true }).click();
  playerIds.push((await (await registration).json()).player.id);
  await expect(page).toHaveURL(`${origin}/battle`);
  await expect(page.getByRole("button", { name: "QRでレイドに参加", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "このキャラで対戦", exact: true })).toHaveCount(0);
  expect(await db.raidRoom.count({ where: { eventId } })).toBe(0);
});

test("battle reads the venue QR from camera frames, releases the camera and joins the persisted raid", async ({ page }) => {
  const source = await QRCode.toDataURL(`${origin}/battle/raid`, { width: 640, margin: 4 });
  await page.addInitScript(({ source }) => {
    const state = { started: 0, stopped: 0 };
    Object.defineProperty(window, "qrCameraState", { value: state });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async (constraints: MediaStreamConstraints) => {
      if (constraints.audio !== false) throw new Error("Audio must not be requested");
      state.started++;
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 640;
      const context = canvas.getContext("2d")!;
      const stream = canvas.captureStream(12);
      let frame = 0;
      const draw = () => { context.drawImage(image, 0, 0, 640, 640); frame = requestAnimationFrame(draw); };
      draw();
      const track = stream.getVideoTracks()[0], stop = track.stop.bind(track);
      track.stop = () => { state.stopped++; cancelAnimationFrame(frame); stop(); };
      return stream;
    } });
  }, { source });
  await register(page);
  const raidRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/raid") raidRequests.push(request.method()); });
  await page.goto("/battle");
  await expect(page.getByRole("button", { name: "QRでレイドに参加", exact: true })).toBeVisible();
  expect(raidRequests).toEqual([]);
  await page.getByRole("button", { name: "QRでレイドに参加", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/battle/raid`);
  await expect.poll(async () => (await (await page.request.get("/api/raid?personal=1")).json()).state?.me?.characterId).toBeTruthy();
  const camera = await page.evaluate(() => (window as unknown as { qrCameraState: { started: number; stopped: number } }).qrCameraState);
  expect(camera.started).toBe(1); expect(camera.stopped).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "レイドバトル", exact: true })).toBeVisible();
});

test("camera denial can retry and close on battle and the shared home entry", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => { throw new DOMException("denied", "NotAllowedError"); } });
  });
  await register(page);
  for (const route of ["/battle", "/"]) {
    await page.goto(route);
    await page.getByRole("button", { name: "QRでレイドに参加", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("カメラへのアクセスが許可されていません");
    await page.getByRole("button", { name: "もう一度カメラを開く", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("カメラへのアクセスが許可されていません");
    await page.getByRole("button", { name: "QR読み取りを閉じる", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "レイドQRを読み取る", exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(`${origin}${route}`);
  }
  expect(await db.raidRoom.count({ where: { eventId } })).toBe(0);
});

test("raid entry fits phones, landscape and desktop without bringing back small copy", async ({ page }, testInfo) => {
  await register(page);
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport); await page.goto("/battle");
    await expect(page.getByRole("button", { name: "QRでレイドに参加", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "デスドラグーン", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect((await collectSmallText(page)).filter(item => item.size <= 10)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`raid-entry-${viewport.width}-${viewport.height}.png`) });
  }
});
