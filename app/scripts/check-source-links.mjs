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

// parseTime (the "Go to a time" box)
const out2 = join(dir, "parsetime.mjs");
await build({ entryPoints: ["src/parseTime.ts"], outfile: out2, bundle: true, format: "esm", logLevel: "silent" });
const { parseTime } = await import(pathToFileURL(out2).href);
assert.equal(parseTime("12:30"), 750);
assert.equal(parseTime("1:02:03"), 3723);
assert.equal(parseTime(" 90 "), 90);
assert.equal(parseTime("0:05"), 5);
assert.equal(parseTime("12:75"), null, "seconds over 59");
assert.equal(parseTime("soon"), null);
assert.equal(parseTime(""), null);
console.log("go to a time: all checks pass");

// dueForRetention (ask-before-deleting old projects)
const out3 = join(dir, "retention.mjs");
await build({ entryPoints: ["src/retention.ts"], outfile: out3, bundle: true, format: "esm", logLevel: "silent" });
const { dueForRetention, ageDays } = await import(pathToFileURL(out3).href);
const NOW = Date.UTC(2026, 10, 18), D = 86_400_000;
const proj = (id, daysAgo, status = "done") => ({ id, name: id, addedAt: NOW - daysAgo * D, status });
assert.deepEqual(dueForRetention([proj("a", 10), proj("b", 40), proj("c", 400)], 30, NOW).map((p) => p.id), ["b", "c"]);
assert.deepEqual(dueForRetention([proj("a", 40)], undefined, NOW), [], "off means nothing is due");
assert.deepEqual(dueForRetention([proj("a", 40)], 0, NOW), []);
assert.deepEqual(dueForRetention([proj("run", 400, "running"), proj("q", 400, "queued"), proj("idle", 400, "idle")], 30, NOW).map((p) => p.id), ["idle"], "never ask about a project that is being worked on");
assert.deepEqual(dueForRetention([proj("edge", 30)], 30, NOW), [], "exactly 30 days is not older than 30 days");
assert.equal(ageDays(NOW - 45.9 * D, NOW), 45);
console.log("retention: all checks pass");
