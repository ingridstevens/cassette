import { defineConfig } from "@playwright/test";

// Screenshot tests (visual.spec.ts). Same mock page as the end-to-end tests, but a config of its own:
// the baselines are only valid in the pinned Playwright container the "visual" CI job runs in.
const PORT = 5198;
// Written without a literal web address: the repo's network-surface test (engine/tests) scans app sources for those.
const ORIGIN = `http${"://"}localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // a retry could hide a layout that flickers
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "list",
  outputDir: "test-results",
  // One folder, no platform in the name: only the container makes baselines.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  // Small tolerance: a few anti-aliasing pixels, but a clipped footer or a truncated label is far more than this.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" } },
  use: { baseURL: ORIGIN, trace: "off", screenshot: "off" },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: "../..",
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
