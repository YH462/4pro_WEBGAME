import { test, expect } from "@playwright/test";

test.skip(process.env.EVENT_ID !== "raid-production-test" || new URL(process.env.DATABASE_URL || "postgresql://localhost:5432/unused").port !== "55436", "Use the isolated production raid environment.");

test("an unregistered visitor browses collection and detail tabs without a nickname or guest session", async ({ page, context }) => {
  const registrations: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/guest" && request.method() === "POST") registrations.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("link", { name: "キャラ図鑑", exact: true }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByRole("heading", { name: "キャラ図鑑", exact: true })).toBeVisible();
  await expect(page.locator(".collection-card")).toHaveCount(12);
  await expect(page.getByRole("progressbar", { name: "キャラクター獲得進捗" })).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("link", { name: "フォレストゴーレムの場所のヒントを見る（未獲得）", exact: true }).click();
  await expect(page).toHaveURL(/\/collection\/forest-golem\/hint$/);
  await expect(page.getByRole("region", { name: "フォレストゴーレムの場所のヒント", exact: true })).toBeVisible();
  await page.goto("/collection/forest-golem");
  await expect(page.getByRole("heading", { name: "フォレストゴーレム", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "必殺技", exact: true })).toHaveCount(0);
  for (const label of ["紹介", "ステータス"]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await page.reload();
  await expect(page).toHaveURL(/\/collection\/forest-golem$/);
  await expect(page.getByRole("group", { name: "HP", exact: true })).toContainText("170");
  expect(registrations).toEqual([]);
  expect((await context.cookies()).some(cookie => cookie.name === "fourpro_guest")).toBe(false);
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("home character links and direct detail URLs remain public while personal APIs stay protected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "機械科：未獲得", exact: true }).click();
  await expect(page).toHaveURL(/\/collection\/forest-golem$/);
  await page.goto("/");
  await page.getByRole("link", { name: "4学科合同：全学科コンプリートで解放", exact: true }).click();
  await expect(page).toHaveURL(/\/collection\/four-pro$/);
  await expect(page.getByRole("heading", { name: "4プロ", exact: true })).toBeVisible();
  await page.goto("/collection/temp-12");
  await expect(page.getByRole("heading", { name: "還暦", exact: true })).toBeVisible();
  const missing = await page.goto("/collection/missing-public-character");
  expect(missing?.status()).toBe(404);
  expect((await page.request.get("/api/characters")).status()).toBe(401);
  expect((await page.request.get("/api/raid?personal=1")).status()).toBe(401);
});
