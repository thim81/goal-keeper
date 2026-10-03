import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 40_000 },
  use: {
    baseURL: "http://127.0.0.1:8790",
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: "npm run e2e:serve",
    wait: { stdout: /Synthetic Pages and Durable Object runtime ready\./ },
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
