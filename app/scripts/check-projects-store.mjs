// Checks the saved project list (electron/projectsStore.ts): backups, and recovery from a damaged file. Plain asserts through esbuild.
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";

const out = join(mkdtempSync(join(tmpdir(), "pstore-")), "s.mjs");
await build({ entryPoints: ["electron/projectsStore.ts"], outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent" });
const { createProjectsStore } = await import(pathToFileURL(out).href);
const fresh = () => { const dir = mkdtempSync(join(tmpdir(), "pdata-")); return { dir, store: createProjectsStore(dir) }; };

// no file yet: an empty list, nothing to report
assert.deepEqual(fresh().store.load(), { projects: [] });

// a normal save and load; non-lists are refused
{
  const { dir, store } = fresh();
  store.save([{ id: "a" }]);
  assert.deepEqual(store.load(), { projects: [{ id: "a" }] });
  assert.throws(() => store.save({ nope: 1 }));
  assert.ok(!existsSync(join(dir, "projects.json.tmp")));
}

// the second save (after the first minute rule allows it) keeps the previous file as .bak1
{
  const { dir, store } = fresh();
  store.save([{ id: "a" }]);
  store.save([{ id: "b" }]);          // first backup is allowed straight away (the file existed)
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "projects.json.bak1"), "utf8")), [{ id: "a" }]);
  store.save([{ id: "c" }]);          // within the same minute: no new backup
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "projects.json.bak1"), "utf8")), [{ id: "a" }]);
}

// the issue's "Done when": a damaged file is kept aside and the .bak1 projects come back
{
  const { dir, store } = fresh();
  store.save([{ id: "a" }]);
  store.save([{ id: "b" }]);
  writeFileSync(join(dir, "projects.json"), "{");
  const r = store.load();
  assert.deepEqual(r.projects, [{ id: "a" }]);
  assert.equal(r.recoveredFrom, "projects.json.bak1");
  assert.equal(typeof r.recoveredAt, "number");
  assert.match(r.corruptCopy, /^projects\.corrupt-\d+\.json$/);
  assert.equal(readFileSync(join(dir, r.corruptCopy), "utf8"), "{");
  assert.ok(!existsSync(join(dir, "projects.json")));
}

// a damaged backup is skipped; with none usable the list is empty but the damaged file is still kept
{
  const { dir, store } = fresh();
  writeFileSync(join(dir, "projects.json"), "[1,");
  writeFileSync(join(dir, "projects.json.bak1"), "garbage");
  writeFileSync(join(dir, "projects.json.bak2"), JSON.stringify([{ id: "old" }]));
  const r = store.load();
  assert.equal(r.recoveredFrom, "projects.json.bak2");
  assert.deepEqual(r.projects, [{ id: "old" }]);
  const { dir: d2, store: s2 } = fresh();
  writeFileSync(join(d2, "projects.json"), "{}");  // valid JSON but not a list
  const r2 = s2.load();
  assert.deepEqual(r2.projects, []);
  assert.equal(r2.recoveredFrom, undefined);
  assert.ok(readdirSync(d2).some((f) => f.startsWith("projects.corrupt-")));
}

// a damaged file is never copied over a good backup
{
  const { dir, store } = fresh();
  store.save([{ id: "a" }]);
  store.save([{ id: "b" }]);
  writeFileSync(join(dir, "projects.json"), "{");
  store.save([{ id: "c" }]);          // file is unreadable: the backups stay as they were
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "projects.json.bak1"), "utf8")), [{ id: "a" }]);
}
console.log("projects store: all checks passed");
