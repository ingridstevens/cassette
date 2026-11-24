import { expect, test, type Page } from "@playwright/test";

// Screenshot tests: three screens in four looks, compared with the baselines in ./__screenshots__.
// The baselines come from the "visual" CI job (a pinned Playwright container, so fonts and Chromium are identical).
// Never commit baselines made on a laptop: fonts differ and every run would fail. To refresh them, run the
// build workflow by hand with "Update the visual baselines" ticked and commit the artifact it uploads.
// The page is the dev mock (app/src/dev-mock.ts), as in ../flows.spec.ts.

type Look = { name: string; opts: Record<string, unknown>; scheme: "light" | "dark" };
const LOOKS: Look[] = [
  { name: "light", opts: { colorScheme: "light" }, scheme: "light" },
  { name: "dark", opts: { colorScheme: "dark" }, scheme: "dark" },
  { name: "arabic-rtl", opts: { colorScheme: "light", appLanguage: "ar" }, scheme: "light" },
  { name: "text-150", opts: { colorScheme: "light", textSize: 1.5 }, scheme: "light" },
];
/** "easy: false" and the Clean look keep the first-run question and the decorative gradient out of the pictures. */
const baseOpts = (more: Record<string, unknown>) => ({ easy: false, look: "clean", contrast: "standard", appLanguage: "en", colorScheme: "light", ...more });

/** Starts the app in a look. The settings are written by a script that runs before the app boots (from "visual-opts"), so the app's own save of its defaults can never overwrite them. */
async function setLook(page: Page, opts: Record<string, unknown>) {
  await page.evaluate((o) => localStorage.setItem("visual-opts", JSON.stringify(o)), baseOpts(opts));
  await page.goto("/?ready"); // without ?fresh, which would wipe the saved projects
  await page.evaluate(() => document.fonts.ready);
}

/** Opens the mock with a frozen clock (the project list shows dates) and no motion. */
async function open(page: Page, look: Look) {
  await page.clock.install({ time: new Date("2026-03-04T10:00:00Z") });
  await page.emulateMedia({ colorScheme: look.scheme, reducedMotion: "reduce" });
  await page.addInitScript(() => { try { const o = localStorage.getItem("visual-opts"); if (o) localStorage.setItem("opts", o); } catch { /* storage unavailable */ } });
  await page.goto("/?ready"); // a new browser context starts with empty storage, so no ?fresh is needed
}

/** One transcribed project from the mock recordings. Done in English, whatever the look: the labels are what the flow tests use. */
async function transcribe(page: Page) {
  await setLook(page, {});
  await page.getByRole("button", { name: "Choose files…" }).click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible({ timeout: 20_000 });
}

for (const look of LOOKS) {
  test.describe(look.name, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("start screen", async ({ page }) => {
      await open(page, look);
      await setLook(page, look.opts);
      await expect(page.locator("html")).toHaveAttribute("dir", look.name === "arabic-rtl" ? "rtl" : "ltr");
      await expect(page).toHaveScreenshot(`start-${look.name}.png`);
    });

    test("transcript", async ({ page }) => {
      await open(page, look);
      await transcribe(page);
      await setLook(page, look.opts);
      await expect(page.locator(".toast")).toHaveCount(0);
      await expect(page).toHaveScreenshot(`transcript-${look.name}.png`);
    });

    test("settings", async ({ page }) => {
      await open(page, look);
      await setLook(page, look.opts);
      await page.locator("button.settings-row").click();
      await expect(page.getByRole("navigation").filter({ has: page.locator("button") }).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`settings-${look.name}.png`);
    });
  });
}
