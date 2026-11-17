// Checks the summary-to-transcript matching (src/sourceLinks.ts). No test runner in this app, so esbuild + plain asserts.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";

const dir = mkdtempSync(join(tmpdir(), "links-"));
const out = join(dir, "links.mjs");
await build({ entryPoints: ["src/sourceLinks.ts"], outfile: out, bundle: true, format: "esm", logLevel: "silent" });
const { sourceTime } = await import(pathToFileURL(out).href);

const segs = [
  { start: 0.5, text: "Thanks everyone for joining, let's start with last week's actions." },
  { start: 4, text: "I shipped the fix on Friday, the report is in the shared folder." },
  { start: 9, text: "Great. I will send the budget numbers by Wednesday." },
  { start: 14, text: "Only the access request, which is still waiting for approval." },
];
assert.equal(sourceTime("Send the budget numbers on Wednesday", segs), 9, "matches by shared words");
assert.equal(sourceTime("The fix was shipped on Friday", segs), 4, "matches across word endings");
assert.equal(sourceTime("Hire two designers in spring", segs), null, "no clear match gives no time");
assert.equal(sourceTime("ok", segs), null, "too short to match");
assert.equal(sourceTime("Genehmigung der Zugangsanfrage", [{ start: 3, text: "Die Zugangsanfrage wartet noch auf die Genehmigung." }]), 3, "German");
console.log("source links: all checks pass");
