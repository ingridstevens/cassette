// Fails if the built renderer (dist/) names a remote font, stylesheet or CDN address. Run after `vite build`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const root = new URL("../dist/", import.meta.url).pathname;
const bad = [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i, /cdn\.jsdelivr\.net/i, /cdnjs\.cloudflare\.com/i, /unpkg\.com/i, /@font-face[^}]*url\(\s*["']?https?:/i, /<link[^>]+href=["']https?:/i, /@import\s+url\(\s*["']?https?:/i];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let problems = 0, fonts = 0;
for (const f of walk(root)) {
  if (/\.woff2?$/.test(f)) { fonts++; continue; }
  if (!/\.(html|css|js|mjs)$/.test(f)) continue;
  const s = readFileSync(f, "utf8");
  for (const re of bad) if (re.test(s)) { console.error(`${f}: matches ${re}`); problems++; }
}
if (fonts === 0) { console.error("no font files in dist/: run `npm run build` first"); problems++; }
// The recorder loads its audio worklet from a bundled file (the content policy allows script-src 'self'), so it must be in the build.
if (!walk(root).some((f) => /pcm16\.worklet-.*\.js$/.test(f))) { console.error("no pcm16 audio worklet in dist/: the recorder would not start"); problems++; }
console.log(`${fonts} font files, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
