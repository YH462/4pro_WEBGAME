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
        if (target && !element.contains(target)) failures.push(`${element.tagName}.${element.className}「${element.textContent?.trim()}」: ${target.tagName}.${target.className}が操作を遮る`);
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

        for (const route of ["/", "/collection", "/collection/four-pro", "/profile", "/battle", "/battle/raid?preview=1", "/dev"]) {
          await page.goto(route);
          await expect(page.locator(".game-main")).toBeVisible();
          await expectScreenFits(page);
          if (route === "/collection") {
            await expect(page.getByRole("list", { name: "キャラクター一覧" }).locator(":scope > li")).toHaveCount(12);
            for (const name of ["フォレストゴーレム", "サンダーフォックス", "フレイムドラゴン", "アクアスピリット", "4プロ"]) {
              await page.getByRole("link", { name: `${name}の場所のヒントを見る（未獲得）`, exact: true }).click();
              await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
              await expect(page.getByRole("group", { name: "場所のヒント写真", exact: true })).toBeVisible();
              await expectScreenFits(page);
              await page.getByRole("link", { name: "図鑑に戻る", exact: true }).click();
              await expect(page.getByRole("heading", { name: "キャラ図鑑", exact: true })).toBeVisible();
            }
          }
          if (route === "/battle") {
            await expect(page.getByRole("heading", { name: "同期レイド", exact: true })).toBeVisible();
            await expect(page.getByRole("button", { name: "QRでレイドに参加", exact: true })).toBeVisible();
            await expect(page.getByRole("button", { name: "このキャラで対戦", exact: true })).toHaveCount(0);
            await expectScreenFits(page);
          }
          if (route === "/profile") {
            await page.getByRole("tab", { name: "冒険の記録", exact: true }).click();
            await expectScreenFits(page);
          }
          if (route === "/battle/raid?preview=1") {
            const character = await page.getByRole("region", { name: "自分のキャラクター", exact: true }).boundingBox();
            const controls = await page.getByRole("region", { name: "スマホ操作画面", exact: true }).boundingBox();
            expect(character).not.toBeNull(); expect(controls).not.toBeNull();
            if (viewport.height > 500) expect(character!.y + character!.height).toBeLessThanOrEqual(controls!.y);
            for (const button of await page.getByRole("region", { name: "スマホ操作画面", exact: true }).getByRole("button").all()) {
              const size = await button.boundingBox();
              expect(size!.height).toBeGreaterThanOrEqual(44);
              expect(size!.width).toBeGreaterThanOrEqual(44);
            }
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
