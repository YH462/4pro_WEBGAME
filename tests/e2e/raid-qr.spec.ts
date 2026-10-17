import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const qrImage = `data:image/svg+xml;base64,${readFileSync(new URL("../fixtures/raid-entry.svg", import.meta.url)).toString("base64")}`;
let playerIds: string[] = [];
async function guest(page: Page) {
  const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "QR確認" } });
  expect(response.status()).toBe(201);
  playerIds.push((await response.json()).player.id);
  const home = await page.goto("/");
  expect(home?.headers()["permissions-policy"]).toBe("camera=(self), microphone=(), geolocation=()");
}
test.afterEach(async () => { await db.player.deleteMany({ where: { id: { in: playerIds } } }); playerIds = []; });
test.afterAll(async () => { await db.$disconnect(); });

test("reads a real QR from camera frames and releases the camera before navigating", async ({ page }) => {
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
      const track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => { state.stopped++; cancelAnimationFrame(frame); stop(); };
      return stream;
    } });
  }, { source: qrImage });
  await guest(page);
  await expect(page.getByRole("dialog", { name: "レイドQRを読み取る" })).not.toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { qrCameraState: { started: number } }).qrCameraState.started)).toBe(0);
  await page.getByRole("button", { name: "QRでレイドに参加", exact: true }).click();
  await expect(page).toHaveURL(/\/battle$/);
  await expect(page.getByRole("heading", { name: "バトル", exact: true })).toBeVisible();
  const state = await page.evaluate(() => (window as unknown as { qrCameraState: { started: number; stopped: number } }).qrCameraState);
  expect(state.started).toBe(1);
  expect(state.stopped).toBeGreaterThanOrEqual(1);
});

test("permission denial stays on home and the scanner closes and retries", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => { throw new DOMException("denied", "NotAllowedError"); } });
  });
  await guest(page);
  await page.getByRole("button", { name: "QRでレイドに参加", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("カメラへのアクセスが許可されていません");
  await page.getByRole("button", { name: "もう一度カメラを開く" }).click();
  await expect(page.getByRole("status")).toContainText("カメラへのアクセスが許可されていません");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "レイドQRを読み取る" })).not.toBeVisible();
  await expect(page).toHaveURL("http://localhost:3000/");
});

test("a late camera permission grant is released after closing the scanner", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: () => new Promise<MediaStream>((resolve) => {
      Object.defineProperty(window, "resolveQrCamera", { value: () => {
        const canvas = document.createElement("canvas");
        const stream = canvas.captureStream();
        Object.defineProperty(window, "lateQrTrack", { value: stream.getVideoTracks()[0] });
        resolve(stream);
      } });
    }) });
  });
  await guest(page);
  await page.getByRole("button", { name: "QRでレイドに参加", exact: true }).click();
  await page.waitForFunction(() => "resolveQrCamera" in window);
  await page.getByRole("button", { name: "QR読み取りを閉じる" }).click();
  await expect(page.getByRole("dialog", { name: "レイドQRを読み取る" })).not.toBeVisible();
  await page.evaluate(() => (window as unknown as { resolveQrCamera: () => void }).resolveQrCamera());
  await expect.poll(() => page.evaluate(() => (window as unknown as { lateQrTrack: MediaStreamTrack }).lateQrTrack.readyState)).toBe("ended");
});
