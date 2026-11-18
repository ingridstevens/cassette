// Checks the set of recordings the window may read, reveal or delete (electron/knownPaths.ts). Plain asserts through esbuild.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";

const out = join(mkdtempSync(join(tmpdir(), "known-")), "k.mjs");
await build({ entryPoints: ["electron/knownPaths.ts"], outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent" });
const { createKnownPaths } = await import(pathToFileURL(out).href);

const k = createKnownPaths();
assert.equal(k.has("/some/other/file.mp3"), false);
k.remember([{ path: "/a/one.mp3" }, { id: "no path" }, null, { path: 5 }]);
assert.equal(k.has("/a/one.mp3"), true);
assert.equal(k.has("/a/../a/one.mp3"), true);   // compared resolved
assert.equal(k.has("/a/two.mp3"), false);
assert.equal(k.has(undefined), false);
k.add(["/b/two.mp3", 7]);
assert.equal(k.has("/b/two.mp3"), true);
k.remember([{ path: "/c/three.mp3" }]);          // a saved list replaces the set
assert.equal(k.has("/a/one.mp3"), false);
k.remember("not a list");                         // garbage changes nothing
assert.equal(k.has("/c/three.mp3"), true);
console.log("known paths ok");
