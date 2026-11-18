import { defineConfig } from "@playwright/test";

// Runs the real renderer in Chromium against the dev mock (src/dev-mock.ts), which fakes window.api.
// No engine, no models, no network: vite serves the page and the mock answers.
const PORT = 5199;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "en-US" },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: "..",
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
