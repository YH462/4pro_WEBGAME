import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
test.afterAll(async () => { await db.$disconnect(); });

async function expectScreenFits(page: Page) {
  const problems = await page.evaluate(() => {
    const failures: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollHeight > innerHeight + 1 || doc.scrollWidth > innerWidth + 1) failures.push("ページにスクロールが発生");
    for (const element of document.querySelectorAll(".game-main *, .command-dock a, dialog[open] *")) {
      if (!(element instanceof HTMLElement) || element.closest("svg")) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(element).visibility === "hidden") continue;
      if (rect.top < -1 || rect.left < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) failures.push(`${element.tagName}.${element.className}: 画面外`);
      if (element.matches("button, a, input")) {
        const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        // Native modal dialogs intentionally cover the background controls.
        if (document.querySelector("dialog[open]") && !element.closest("dialog")) continue;
        if (target && !element.contains(target)) failures.push(`${element.tagName}.${element.className}: 他の要素が操作を遮る`);
      }
    }
    const dialog = document.querySelector("dialog[open]");
    if (dialog && dialog.scrollHeight > dialog.clientHeight + 1) failures.push("ガイドにスクロールが発生");
    return failures;
  });
  expect(problems).toEqual([]);
}

// Each viewport is checked once; the normal journey tests still run on both projects.
test.describe("viewport-contained game screens", () => {
  for (const viewport of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    test(`${viewport.width}x${viewport.height}: all controls fit without scrolling`, async ({ page }) => {
      await page.setViewportSize(viewport);
      let playerId: string | undefined;
      try {
        await page.goto("/start");
        await expect(page.getByRole("button", { name: "ゲストではじめる" })).toBeVisible();
        await expectScreenFits(page);
        const response = await page.request.post("/api/guest", { headers: { origin: "http://localhost:3000" }, data: { nickname: "画面サイズ確認" } });
        expect(response.status()).toBe(201);
        playerId = (await response.json()).player.id;

        for (const route of ["/", "/collection", "/collection/four-pro", "/profile", "/battle", "/dev"]) {
          await page.goto(route);
          await expect(page.locator(".game-main")).toBeVisible();
          await expectScreenFits(page);
          if (route === "/collection") {
            for (const name of ["フォレストゴーレム", "サンダーフォックス", "フレイムドラゴン", "アクアスピリット", "4プロ"]) {
              await page.getByRole("button", { name: `${name}を選択` }).click();
              await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
              for (const tab of ["固有技", "紹介", "ステータス"]) { await page.getByRole("tab", { name: tab, exact: true }).click(); await expectScreenFits(page); }
            }
          }
          if (route === "/profile") {
            await page.getByRole("tab", { name: "冒険の記録", exact: true }).click();
            await expectScreenFits(page);
          }
        }
        await page.getByRole("button", { name: "遊び方を開く" }).click();
        await expect(page.getByRole("dialog", { name: "冒険のガイド" })).toBeVisible();
        await expectScreenFits(page);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).not.toBeVisible();
      } finally { if (playerId) await db.player.deleteMany({ where: { id: playerId } }); }
    });
  }
});
