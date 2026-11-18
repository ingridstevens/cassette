// WCAG contrast check for the Clean look's colour pairs. Reads the tokens from src/styles/themes.css so the numbers can't drift from the real colours.
// Text pairs need 4.5:1 (normal text); UI pairs (borders, focus ring, switches) need 3:1. Exit code 1 on any failure.
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/styles/themes.css", import.meta.url), "utf8");
const block = (sel) => { const i = css.indexOf(sel + " {"); if (i < 0) throw new Error("missing " + sel); return css.slice(i, css.indexOf("}", i)); };
const tokens = (b) => Object.fromEntries([...b.matchAll(/--([a-z0-9-]+):\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)].map((m) => [m[1], "#" + (m[2].length === 3 ? [...m[2]].map((c) => c + c).join("") : m[2])]));
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const looks = {
  "Clean light": tokens(block('html[data-look="clean"]')),
  "Clean dark": { ...tokens(block('html[data-look="clean"]')), ...tokens(block('html[data-look="clean"][data-mode="dark"]')) },
};
// [foreground token, background token, minimum, what]
const pairs = [["ink", "paper", 4.5, "body text"], ["ink2", "paper", 4.5, "secondary text"], ["ink3", "paper", 4.5, "hints"], ["violet-ink", "paper", 4.5, "accent text"], ["on-sun", "sun-btn", 4.5, "primary button text"], ["focus", "paper", 3, "focus ring"], ["hot", "paper", 3, "current line marker"], ["warn", "surface", 3, "unsure-word underline"], ["ink", "dawn", 4.5, "text on page"], ["ink2", "dawn", 4.5, "secondary on page"]];
let fail = 0, pass = 0;
for (const [name, t] of Object.entries(looks)) for (const [f, b, min, what] of pairs) {
  if (!t[f] || !t[b]) { console.error(`${name}: missing token ${!t[f] ? f : b} for ${what}`); fail++; continue; }
  const r = ratio(t[f], t[b]);
  if (r < min) { console.error(`FAIL ${name}: ${what} ${t[f]} on ${t[b]} = ${r.toFixed(2)} (needs ${min})`); fail++; } else pass++;
}
console.log(`${pass} pairs pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
