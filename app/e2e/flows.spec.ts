import { expect, test, type Page } from "@playwright/test";

// The dev mock (app/src/dev-mock.ts) takes its switches from the query string:
//   ?fresh      start with no saved projects or settings
//   ?ready      models and speaker detection already set up, so the first run goes straight to the empty screen
//   ?enginefail the engine stops after decoding
const OPEN = "/?fresh&ready";

/** First run in the full interface: choose "Full", add the three mock recordings and press Start. */
async function startFirstRecording(page: Page) {
  await page.goto(OPEN);
  await page.getByRole("button", { name: /^Full/ }).click();
  await page.getByRole("button", { name: "Choose files…" }).click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible({ timeout: 20_000 });
}

/** Collects what the mock logs when a transcript is exported (it stands in for the engine's export call). */
function exportsOf(page: Page) {
  const seen: string[] = [];
  page.on("console", (m) => { if (m.type() === "log" && m.text().startsWith("export")) seen.push(m.text()); });
  return seen;
}

/** Presses Tab until the control has focus, so the test only passes if the control is reachable by keyboard. */
async function tabTo(page: Page, target: ReturnType<Page["getByRole"]>, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the control");
}

test("main flow: add, start, rename a speaker, edit a line, undo, export", async ({ page }) => {
  const exported = exportsOf(page);
  await startFirstRecording(page);
  await expect(page.getByRole("heading", { name: "Interview 2026", level: 1 })).toBeVisible();
  await expect(page.getByText("Hallo zusammen und willkommen zum Interview.")).toBeVisible();

  // rename a speaker: the name shows in the inspector and on the lines
  await page.getByRole("textbox", { name: "Rename Speaker 1" }).fill("Anna"); // the label follows the name
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Change who said the line at 0:00. Now: Anna" })).toBeVisible();

  // edit a line
  await page.getByRole("button", { name: "Edit the text of the line at 0:00" }).click();
  await page.getByRole("textbox", { name: "Edit this line" }).fill("Hallo Welt.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Hallo Welt.")).toBeVisible();
  await expect(page.getByText("Hallo zusammen und willkommen zum Interview.")).toHaveCount(0);

  // undo brings the old text back
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByText("Hallo zusammen und willkommen zum Interview.")).toBeVisible();
  await expect(page.getByText("Hallo Welt.")).toHaveCount(0);

  // export: the mock logs the format it was asked for
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: /^Plain text/ }).click();
  await expect.poll(() => exported.length).toBe(1);
  expect(exported[0]).toContain("txt");
});

test("the sample interview can be tried with one click", async ({ page }) => {
  await page.goto(OPEN);
  await page.getByRole("button", { name: /^Full/ }).click();
  await page.getByRole("button", { name: "Try a 30-second sample interview" }).click();
  await expect(page.getByRole("heading", { name: "Sample interview", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tabpanel", { name: "Speakers" }).getByRole("textbox", { name: /^Rename / })).toHaveCount(3);
});

test("keyboard only: add, start, rename a speaker and edit a line", async ({ page }) => {
  await page.goto(OPEN);
  await tabTo(page, page.getByRole("button", { name: /^Full/ }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("button", { name: "Choose files…" }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("button", { name: /^Start/ }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible({ timeout: 20_000 });

  await tabTo(page, page.getByRole("textbox", { name: "Rename Speaker 1" }));
  await page.keyboard.type("Hana");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Change who said the line at 0:00. Now: Hana" })).toBeVisible();

  await tabTo(page, page.getByRole("button", { name: "Edit the text of the line at 0:00" }));
  await page.keyboard.press("Enter");
  const edit = page.getByRole("textbox", { name: "Edit this line" });
  await expect(edit).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Tastatur geht.");
  await page.keyboard.press("Enter"); // Enter saves an edit
  await expect(page.getByText("Tastatur geht.")).toBeVisible();

  // the Export menu opens with its shortcut and closes with Escape
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("ControlOrMeta+e");
  await expect(page.getByRole("menu", { name: "Export transcript" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Export transcript" })).toHaveCount(0);
});

test("?enginefail shows the error card", async ({ page }) => {
  await page.goto("/?fresh&ready&enginefail");
  await page.getByRole("button", { name: /^Full/ }).click();
  await page.getByRole("button", { name: "Choose files…" }).click();
  await page.getByRole("button", { name: /^Start/ }).click();
  const card = page.getByRole("alert").filter({ has: page.getByRole("heading", { name: /Couldn't transcribe/ }) });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
});
