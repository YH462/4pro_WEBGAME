import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Optional Safari-engine checks: npx playwright install webkit
export default defineConfig({
  ...base,
  testMatch: ["**/battle.spec.ts", "**/local-raid.spec.ts", "**/raid-mobile-design.spec.ts", "**/acquisition.spec.ts"],
  projects: [{ name: "iphone-webkit", use: { ...devices["iPhone 13"] } }],
});
