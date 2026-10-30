import { defineConfig, devices } from "@playwright/test";

// Run against a dedicated PostgreSQL database and an actual `next start` build.
export default defineConfig({
  testDir: "./tests/e2e", testMatch: ["production-raid.spec.ts", "lifecycle.spec.ts", "raid-entry.spec.ts", "public-collection.spec.ts", "adventure-records.spec.ts", "collection-swipe.spec.ts", "character-motions.spec.ts", "player-awards.spec.ts", "admin-statistics.spec.ts"], fullyParallel: false, workers: 1,
  timeout: 90_000, reporter: "list", outputDir: ".local/production-raid-test/results",
  use: { baseURL: "http://localhost:13026", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 13026",
    url: "http://localhost:13026/api/health", reuseExistingServer: false, timeout: 120_000 },
});
