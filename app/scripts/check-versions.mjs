// One version for the whole project. app/package.json is the source of truth; engine/pyproject.toml, app/package-lock.json
// and the engine entry in engine/uv.lock must match it. With a tag argument (v1.2.3, or refs/tags/v1.2.3) the tag must match too.
// Used by `npm run links:check` (every push) and by the release job (the pushed tag).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

export function versionProblems({ pkg, lock, pyproject, uvLock, tag }) {
  const want = JSON.parse(pkg).version;
  const problems = [];
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(want ?? "")) problems.push(`app/package.json version "${want}" is not semver (1.2.3)`);
  const l = JSON.parse(lock);
  if (l.version !== want) problems.push(`app/package-lock.json version is ${l.version}, expected ${want}`);
  if (l.packages?.[""]?.version !== want) problems.push(`app/package-lock.json packages[""] version is ${l.packages?.[""]?.version}, expected ${want}`);
  const py = /^version\s*=\s*"([^"]+)"/m.exec(pyproject)?.[1];
  if (py !== want) problems.push(`engine/pyproject.toml version is ${py}, expected ${want}`);
  const uv = /\[\[package\]\]\r?\nname = "engine"\r?\nversion = "([^"]+)"/.exec(uvLock)?.[1];
  if (uv !== want) problems.push(`engine/uv.lock engine version is ${uv}, expected ${want} (run uv lock, but do not commit unrelated lock changes)`);
  if (tag !== undefined) {
    const t = tag.replace(/^refs\/tags\//, "");
    if (t !== `v${want}`) problems.push(`tag ${t} does not match the version in app/package.json (v${want})`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = versionProblems({
    pkg: read("app/package.json"),
    lock: read("app/package-lock.json"),
    pyproject: read("engine/pyproject.toml"),
    uvLock: read("engine/uv.lock"),
    tag: process.argv[2],
  });
  if (problems.length) {
    for (const p of problems) console.error("version check: " + p);
    process.exit(1);
  }
  console.log("version check: all versions agree" + (process.argv[2] ? ` and match tag ${process.argv[2]}` : ""));
}
