// Fails if the print stylesheet stops hiding the app chrome, or the export menu and main process lose their print wiring.
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles/print.css", "utf8");
const tsx = ["src/components/ProjectView.tsx", "src/components/Inspector.tsx", "src/components/ProjectSidebar.tsx", "src/components/Transcript.tsx"].map((f) => readFileSync(f, "utf8")).join("\n");
let bad = 0;
const fail = (m) => { console.log(m); bad++; };

const hidden = css.match(/@media print\s*{([^}]*display:\s*none\s*!important)/)?.[1] ?? "";
for (const cls of ["side", "inspector", "pv-dock", "tool", "pv-copy", "pv-edit"]) {
  if (!new RegExp(`\\.${cls}\\b`).test(hidden)) fail(`print.css does not hide .${cls}`);
  if (!new RegExp(`class(Name)?=[{"'][^>]*\\b${cls}\\b`).test(tsx)) fail(`.${cls} is hidden in print.css but no longer used in the app`);
}
if (!/html\.print-large/.test(css)) fail("print.css has no html.print-large rule");
if (!/\.pv-turn\s*{[^}]*break-inside:\s*avoid/.test(css)) fail("print.css lets a turn break across pages");

const main = readFileSync("electron/main.ts", "utf8");
if (!/ipcMain\.handle\("print-pdf"/.test(main) || !/printToPDF/.test(main)) fail("main.ts has no print-pdf handler");
if (!/printPdf/.test(readFileSync("electron/preload.ts", "utf8"))) fail("preload.ts does not expose printPdf");
const menu = readFileSync("src/components/ExportMenu.tsx", "utf8");
if (!/DEFAULT_SHOWN[^=]*= \[[^\]]*"print"[^\]]*"print-large"/.test(readFileSync("src/exportFormats.ts", "utf8"))) fail("the export menu does not list the print formats in the most-used group");

// "Again" export: the last export is saved with the project and offered first in the menu
if (!/lastExport/.test(readFileSync("src/useProjects.ts", "utf8"))) fail("useProjects.ts no longer saves lastExport");
if (!/onRemember\?\.\(f/.test(menu) || !/menu-again/.test(menu)) fail("the export menu does not remember or offer the last export");
if (!/defaultExport/.test(readFileSync("src/components/settings/SavingSection.tsx", "utf8"))) fail("Settings has no default export format");

console.log(`print check: ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
