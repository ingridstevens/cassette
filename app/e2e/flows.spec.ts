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

test("Export > Copy as Markdown puts the text on the clipboard and is not remembered as an export", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const exported = exportsOf(page);
  await startFirstRecording(page);
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: "More formats…" }).click();
  await page.getByRole("menuitem", { name: /^Copy as Markdown/ }).click();
  await expect(page.locator(".toast").getByText("Copied as Markdown ✓")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("**Anna**");
  expect(exported).toEqual([]); // nothing was saved to a file
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("menuitem", { name: /^Again:/ })).toHaveCount(0);
});

test("Settings > Formats in the Export menu changes what the menu lists first, and More formats still reaches the rest", async ({ page }) => {
  await startFirstRecording(page);
  await page.getByRole("button", { name: /^Settings/ }).click();
  await page.getByRole("button", { name: "Saving and export" }).click();
  const csv = page.getByRole("checkbox", { name: /^Spreadsheet/ });
  await csv.focus(); await page.keyboard.press("Space"); // keyboard operable
  await page.getByRole("checkbox", { name: /^Plain text/ }).uncheck();
  await page.getByRole("button", { name: "Back to projects" }).click();
  await page.getByRole("button", { name: "Export" }).click();
  const first = page.getByRole("group", { name: "Most used" });
  await expect(first.getByRole("menuitem", { name: /^Spreadsheet/ })).toBeVisible();
  await expect(first.getByRole("menuitem", { name: /^Plain text/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "More formats…" }).click();
  await expect(page.getByRole("menuitem", { name: /^Plain text/ })).toBeVisible();
  await page.getByRole("menuitem", { name: "Choose which formats to show…" }).click();
  await expect(page.getByRole("button", { name: "Reset to the default set" })).toBeEnabled();
});

test("screen-reader announcements: a finished transcription and an export are spoken in live regions", async ({ page }) => {
  await startFirstRecording(page);
  // the polite region is always in the page; its text is what a screen reader reads out
  await expect(page.getByRole("status").filter({ hasText: /^Finished transcribing / })).toHaveCount(1);
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem").first().click();
  await expect(page.getByRole("status").filter({ hasText: /Exported/ })).toHaveCount(1);
});

test("who said this line: add a new speaker from the menu with the keyboard, then undo in one step", async ({ page }) => {
  await startFirstRecording(page);
  const who = page.getByRole("button", { name: /^Change who said the line at 0:00/ });
  await who.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Who said this line?" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitemradio", { checked: true })).toBeFocused();
  await menu.getByRole("menuitem", { name: "+ New speaker…" }).focus();
  await page.keyboard.press("Enter");
  const name = page.getByRole("textbox", { name: "Name of the new speaker" });
  await expect(name).toBeFocused();
  await page.keyboard.press("Escape"); // back to the menu, which stays open
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "+ New speaker…" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Mia");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change who said the line at 0:00. Now: Mia" })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Added speaker Mia" })).toBeAttached();
  await page.keyboard.press("ControlOrMeta+z"); // one step takes back the speaker, the name and the line
  await expect(page.getByRole("button", { name: /^Change who said the line at 0:00. Now: (?!Mia)/ })).toBeVisible();
});

test("project actions menu: keyboard, Duplicate, Escape returns focus, audio badge", async ({ page }) => {
  await startFirstRecording(page);
  const list = page.getByRole("list", { name: "Projects" });
  await expect(list.getByText("Audio").first()).toBeVisible();
  const trigger = page.getByRole("button", { name: "Actions for Interview 2026" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Actions for Interview 2026" });
  await expect(menu.getByRole("menuitem", { name: "Rename" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Duplicated as “Interview 2026 copy”" })).toBeAttached();
  await expect(list.getByText("Interview 2026 copy")).toBeVisible();
});

test("keyboard-only word selection: Shift+Right selects, Shift+Down reaches the toolbar, Esc cancels", async ({ page }) => {
  await startFirstRecording(page);
  await page.getByRole("button", { name: /^Edit the text of the line/ }).first().focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  const bar = page.getByRole("toolbar", { name: "Actions for the selected words" });
  await expect(bar).toBeVisible();
  await expect(page.getByText(/2 words selected, from/).first()).toBeAttached();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(bar.getByRole("button", { name: "Highlight this passage" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(bar).toBeHidden();
  await expect(page.getByRole("button", { name: /^Edit the text of the line/ }).first()).toBeFocused();
});
