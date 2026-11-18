// Checks the window navigation guard (electron/navGuard.ts): plain asserts through esbuild, like check-log-redact.mjs.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";

const out = join(mkdtempSync(join(tmpdir(), "nav-")), "n.mjs");
await build({ entryPoints: ["electron/navGuard.ts"], outfile: out, bundle: true, format: "esm", logLevel: "silent" });
const { isAppNavigation } = await import(pathToFileURL(out).href);

const dist = "file:///Applications/Cassette/app/dist";
assert.equal(isAppNavigation(dist, dist + "/index.html", false), true);
assert.equal(isAppNavigation(dist, dist + "/", false), true);
assert.equal(isAppNavigation(dist, "file:///Applications/Cassette/app/dist-electron/main.cjs", false), false);
assert.equal(isAppNavigation(dist, "file:///Applications/Cassette/app/distilled/x.html", false), false);
assert.equal(isAppNavigation(dist, "https://example.com/dist/index.html", false), false);
assert.equal(isAppNavigation(dist, "not a url", false), false);
const dev = "http://localhost:5173";
assert.equal(isAppNavigation(dev, "http://localhost:5173/#/record", true), true);
assert.equal(isAppNavigation(dev, "http://localhost:51730/", true), false);
assert.equal(isAppNavigation(dev, "http://localhost:5173.evil.com/", true), false);
assert.equal(isAppNavigation(dev, "file:///etc/passwd", true), false);
console.log("nav guard ok");
