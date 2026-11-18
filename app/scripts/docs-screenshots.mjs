// Regenerates docs/screenshots/*.jpg from the browser mock (src/dev-mock.ts), so the pictures match the current UI.
//
//   cd app && npm i --no-save playwright-core && npx vite --port 5173      # terminal 1
//   cd app && node scripts/docs-screenshots.mjs                            # terminal 2
//
// Needs Google Chrome (or set CHROME=/path/to/chrome). URL=http://localhost:5173 overrides the dev server address.
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL_ = process.env.URL || "http://localhost:5173";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/screenshots") + "/";
const W = 1440, H = 900;

let browser, p;
async function launch(query = "?ready") {
  browser ??= await chromium.launch({ executablePath: CHROME });
  p = await (await browser.newContext({ viewport: { width: W, height: H }, locale: "en-US" })).newPage();
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL_ + "/" + query); await p.waitForTimeout(800);
}
async function snap(name, { keepMouse = false } = {}) {
  if (!keepMouse) await p.mouse.move(2, 2);
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + name + ".jpg", type: "jpeg", quality: 84 });
  console.log("ok", name);
}
const step = async (name, f) => { try { await f(); } catch (e) { console.log("FAILED", name, e.message.split("\n")[0]); process.exitCode = 1; } };
const tall = async (h, f) => { await p.setViewportSize({ width: W, height: h }); await p.waitForTimeout(300); await f(); await p.setViewportSize({ width: W, height: H }); };
const tab = (n) => p.locator("[role=tablist]").getByText(n, { exact: true }).first().click();
const addAndTranscribe = async () => {
  await p.getByRole("button", { name: /choose files/i }).click(); await p.waitForTimeout(900);
  await p.getByRole("button", { name: /^start/i }).click(); await p.getByText(/unsure words/).first().waitFor({ timeout: 15000 }); await p.waitForTimeout(500);
};

// First launch (nothing downloaded yet)
await launch("");
await snap("02-first-launch");
await step("speaker setup", async () => { await p.getByRole("button", { name: /set up speaker (names|detection)/i }).click(); await p.waitForTimeout(400); await snap("03-speaker-setup"); });
await p.close();

// A normal session
await launch();
await snap("01-empty");
await p.getByRole("button", { name: /choose files/i }).click(); await p.waitForTimeout(900);
await step("start sheet", async () => {
  await p.getByRole("button", { name: /change settings/i }).click(); await p.waitForTimeout(500);
  await tall(1160, () => snap("04-start-sheet"));
});
await p.getByRole("button", { name: /^start/i }).click(); await p.getByText(/unsure words/).first().waitFor(); await p.waitForTimeout(500);
await step("rename speakers", async () => {
  const from = ["Speaker 2", "Speaker 1", "Speaker 3"], to = ["Ben", "Anna", "Carla"];
  for (let i = 0; i < 3; i++) { const el = p.locator(`input[placeholder='${from[i]}']`).first(); await el.fill(to[i]); await el.press("Enter").catch(() => {}); await el.blur(); }
  await p.waitForTimeout(300);
});
await snap("05-transcript");
await step("line actions", async () => { await p.getByText("Danke für die Einladung").hover(); await p.waitForTimeout(300); await snap("06-line-actions", { keepMouse: true }); });
await step("speaker menu", async () => { await p.getByRole("button", { name: /Ben/ }).first().click(); await p.waitForTimeout(300); await snap("07-speaker-menu", { keepMouse: true }); await p.keyboard.press("Escape"); });
await step("language dialog", async () => { await p.getByRole("button", { name: /Ben/ }).first().click(); await p.getByText(/Language and translation/).click(); await p.waitForTimeout(400); await snap("08-language-dialog", { keepMouse: true }); await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); });
await step("options", () => tall(1160, async () => { await tab("Details"); await p.waitForTimeout(400); await snap("11-options"); }));
await step("info", async () => { await tab("Details"); await p.evaluate(() => document.querySelector(".pv-details section:last-child")?.scrollIntoView()); await p.waitForTimeout(400); await snap("12-info"); });
await step("export menu", async () => { await tab("Speakers"); await tall(1060, async () => { await p.getByRole("button", { name: /export/i }).first().click(); await p.waitForTimeout(400); await snap("13-export-menu", { keepMouse: true }); await p.keyboard.press("Escape"); }); });
await step("highlight selection", async () => {
  await tab("AI");
  const box = await p.getByText("Projekt begann vor drei Jahren").first().boundingBox();
  await p.mouse.move(box.x + 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
  await snap("14-highlight-selection", { keepMouse: true });
  await p.getByRole("button", { name: /Highlight this passage/ }).click(); await p.waitForTimeout(400);
});
await step("suggestions", async () => { await p.getByRole("button", { name: /Suggest highlights/ }).click(); await p.waitForTimeout(3500); await snap("15-highlights-panel"); });
await step("summary", async () => {
  await p.getByRole("button", { name: /Write a summary/ }).click(); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll("*").forEach((e) => { if (e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== "visible" && e.getBoundingClientRect().left > 1000) e.scrollTop = e.scrollHeight; }));
  await snap("16-summary");
});
await p.close();

// Review mode and search and replace on a fresh transcript (so earlier highlights don't show)
await launch();
await addAndTranscribe();
await step("review mode", async () => { await p.getByText(/Review 8 unsure/).click(); await p.waitForTimeout(800); await snap("09-review-mode"); await p.keyboard.press("Escape"); });
await step("search and replace", async () => { await p.getByPlaceholder(/Find in transcript/).fill("Projekt"); await p.getByRole("button", { name: "Replace" }).click(); await p.waitForTimeout(400); await snap("10-search-replace"); });
await step("settings", async () => {
  await p.getByRole("button", { name: /^Settings/ }).first().click(); await p.waitForTimeout(600);
  const nav = async (n, file) => { await p.getByRole("button", { name: n }).first().click(); await p.waitForTimeout(500); await snap(file); };
  await nav("Advanced", "17-settings-performance"); await nav("Transcription", "18-settings-storage"); await nav("Privacy", "19-settings-privacy");
});
// README hero: the transcript at 1.25x, light and dark
await step("hero", async () => {
  p = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.25, locale: "en-US" })).newPage();
  await p.goto(URL_ + "/?ready"); await p.waitForTimeout(800); await addAndTranscribe();
  for (const mode of ["light", "dark"]) { await p.emulateMedia({ colorScheme: mode }); await p.waitForTimeout(400); await p.mouse.move(2, 2); await p.screenshot({ path: OUT + `00-hero-${mode}.jpg`, type: "jpeg", quality: 84 }); console.log("ok", "00-hero-" + mode); }
});
await browser.close();
