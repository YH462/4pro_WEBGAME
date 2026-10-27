import { test, expect, type Page } from "@playwright/test";
import { collectSmallText } from "../../scripts/ui-review/small-text";

test.skip(process.env.EVENT_ID !== "raid-production-test" || new URL(process.env.DATABASE_URL || "postgresql://localhost:5432/unused").port !== "55436", "Use the isolated production raid environment.");
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function swipe(page: Page, dx: number, dy = 0, cancel = false) {
  const bounds = await page.locator("[data-character-id]").boundingBox();
  if (!bounds) throw new Error("Character panel not visible");
  const start = { x: bounds.x + bounds.width * (dx > 0 ? 0.28 : 0.72), y: bounds.y + Math.min(bounds.height * 0.23, 90) };
  const touch = await page.context().newCDPSession(page);
  try {
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let step = 1; step <= 8; step++) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + dx * step / 8, y: start.y + dy * step / 8 }] });
      await page.waitForTimeout(16);
    }
    await touch.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
  } finally { await touch.detach(); }
}

test("touch swipes follow adjacent database numbers across departments, legend and extra characters", async ({ page, context }) => {
  await page.goto("/collection/forest-golem");
  await swipe(page, -150); await expect(page).toHaveURL(/\/collection\/thunder-fox$/);
  await expect(page.locator("[data-character-id]")).toHaveAttribute("data-character-id", "thunder-fox");
  await swipe(page, -150); await expect(page).toHaveURL(/\/collection\/flame-dragon$/);
  await swipe(page, 150); await expect(page).toHaveURL(/\/collection\/thunder-fox$/);
  await page.goto("/collection/aqua-spirit");
  await swipe(page, -150); await expect(page).toHaveURL(/\/collection\/four-pro$/);
  await swipe(page, -150); await expect(page).toHaveURL(/\/collection\/temp-06$/);
  expect((await context.cookies()).some(cookie => cookie.name === "fourpro_guest")).toBe(false);
});

test("vertical, diagonal, short, cancelled, mouse and multi-touch gestures do not navigate or break tabs", async ({ page }) => {
  await page.goto("/collection/forest-golem");
  for (const [dx, dy, cancel] of [[0, 90, false], [-90, 100, false], [-24, 0, false], [-150, 0, true]] as const) {
    await swipe(page, dx, dy, cancel); await expect(page).toHaveURL(/\/collection\/forest-golem$/);
  }
  const box = (await page.locator("[data-character-id]").boundingBox())!;
  await page.mouse.move(box.x + 250, box.y + 85); await page.mouse.down(); await page.mouse.move(box.x + 70, box.y + 85, { steps: 6 }); await page.mouse.up();
  await expect(page).toHaveURL(/\/collection\/forest-golem$/);
  const touch = await page.context().newCDPSession(page);
  try {
    const y = box.y + 90;
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 240, y, id: 1 }, { x: box.x + 280, y: y + 40, id: 2 }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 100, y, id: 1 }, { x: box.x + 140, y: y + 40, id: 2 }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await touch.detach(); }
  await expect(page).toHaveURL(/\/collection\/forest-golem$/);
  await page.getByRole("tab", { name: "紹介", exact: true }).tap();
  await expect(page.getByRole("tab", { name: "紹介", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "ステータス", exact: true }).focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "必殺技", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/\/collection\/forest-golem$/);
});

test("first and last characters stop at the boundary", async ({ page }) => {
  await page.goto("/collection/forest-golem");
  await expect(page.getByRole("button", { name: "前のキャラクター", exact: true })).toBeDisabled();
  await swipe(page, 150); await expect(page).toHaveURL(/\/collection\/forest-golem$/);
  await page.goto("/collection/temp-12");
  await expect(page.getByRole("button", { name: "次のキャラクター", exact: true })).toBeDisabled();
  await swipe(page, -150); await expect(page).toHaveURL(/\/collection\/temp-12$/);
});

// Keep native tap checks in a fresh input context: Chromium's raw CDP drag
// injection can suppress later compatibility clicks even on a plain HTML button.
test("arrow links support native touch taps and fit small screens", async ({ page }, testInfo) => {
  await page.goto("/collection/temp-12");
  await page.getByRole("link", { name: /^前のキャラクター：/ }).tap();
  await expect(page).toHaveURL(/\/collection\/temp-11$/);
  await page.getByRole("link", { name: /^次のキャラクター：/ }).tap(); await expect(page).toHaveURL(/\/collection\/temp-12$/);
  for (const viewport of [{ width: 375, height: 667 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect((await collectSmallText(page)).filter(item => item.size <= 10)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`collection-navigation-${viewport.width}.png`) });
  }
});
