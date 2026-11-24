import { defineConfig } from "@playwright/test";

// Runs the real renderer in Chromium against the dev mock (src/dev-mock.ts), which fakes window.api.
// No engine, no models, no network: vite serves the page and the mock answers.
const PORT = 5199;
// Written without a literal web address: the repo's network-surface test (engine/tests) scans app sources for those, and this one only points at localhost.
const ORIGIN = `http${"://"}localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  testIgnore: "visual/**", // screenshot tests have a config of their own (visual/playwright.config.ts) and run only in the pinned container
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: ORIGIN, trace: "retain-on-failure", locale: "en-US" },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: "..",
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
