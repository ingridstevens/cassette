// Fails if a t("…") string in src has no German, French and Spanish translation, or a dictionary entry has mismatched {placeholders}.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (p.includes("i18n") ? [] : walk(p)) : /\.tsx?$/.test(p) ? [p] : []; });
const used = new Map();
for (const f of walk("src")) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)) used.set(JSON.parse(m[1]), f);
}
const dir = "src/i18n/dict";
const dict = { de: {}, fr: {}, es: {} };
for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
  const out = `${process.env.TMPDIR || "/tmp"}/i18n-${f}.mjs`;
  await build({ entryPoints: [join(dir, f)], outfile: out, bundle: true, format: "esm", logLevel: "silent" });
  const mod = (await import(pathToFileURL(out).href + "?" + Date.now())).default;
  for (const l of ["de", "fr", "es"]) Object.assign(dict[l], mod[l] ?? {});
}
const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
let bad = 0;
for (const [text, file] of used) for (const l of ["de", "fr", "es"]) {
  if (!dict[l][text]) { console.log(`missing ${l}: "${text}" (${file})`); bad++; }
  else if (ph(dict[l][text]) !== ph(text)) { console.log(`placeholder mismatch ${l}: "${text}"`); bad++; }
}
console.log(`${used.size} strings used, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
