import { displayName, fmt, PALETTE, type Result } from "../types";

export interface Share { id: string; name: string; seconds: number; pct: number; color: string; }
export interface QuoteOption { index: number; name: string; text: string; start: number; label: string; }

/** Talk time per speaker (seconds), sorted descending; the tail beyond `max` is grouped as "Others". */
export function talkShares(result: Result, names: Record<string, string>, max = 6): Share[] {
  const secs = new Map<string, number>();
  for (const s of result.segments) {
    const d = Math.max(0, (s.end || 0) - (s.start || 0));
    secs.set(s.speaker, (secs.get(s.speaker) ?? 0) + d);
  }
  const total = [...secs.values()].reduce((a, b) => a + b, 0);
  const colorOf = (id: string) => PALETTE[Math.max(0, result.speakers.indexOf(id)) % PALETTE.length];
  const sorted = [...secs.entries()].sort((a, b) => b[1] - a[1]);
  const rows: Share[] = sorted.slice(0, max).map(([id, seconds]) => ({
    id, name: displayName(id, result.speakers, names), seconds, pct: total ? (seconds / total) * 100 : 0, color: colorOf(id),
  }));
  const rest = sorted.slice(max);
  if (rest.length) {
    const seconds = rest.reduce((a, [, v]) => a + v, 0);
    rows.push({ id: "__others", name: "Others", seconds, pct: total ? (seconds / total) * 100 : 0, color: PALETTE[7] });
  }
  return rows;
}

/** Whole percentages that add up to 100 (largest remainder). */
export function roundPercents(pcts: number[]): number[] {
  const floors = pcts.map(Math.floor);
  let left = Math.round(pcts.reduce((a, b) => a + b, 0)) - floors.reduce((a, b) => a + b, 0);
  const order = pcts.map((p, i) => [p - Math.floor(p), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left-- <= 0) break; floors[i]++; }
  return floors;
}

const firstWords = (t: string, n = 7) => { const w = t.split(/\s+/); return w.slice(0, n).join(" ") + (w.length > n ? "…" : ""); };

/** The longest ~8 lines; lines under `pref` characters come first (they fit a card), longest first. */
export function pickQuotes(result: Result, names: Record<string, string>, count = 8, pref = 140): QuoteOption[] {
  const items = result.segments
    .map((s, index) => ({ s, index, text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((x) => x.text.length >= 12);
  const short = items.filter((x) => x.text.length < pref).sort((a, b) => b.text.length - a.text.length);
  const long = items.filter((x) => x.text.length >= pref).sort((a, b) => a.text.length - b.text.length);
  return [...short, ...long].slice(0, count).map(({ s, index, text }) => {
    const name = displayName(s.speaker, result.speakers, names);
    return { index, name, text, start: s.start, label: `${name} (${fmt(s.start)}): ${firstWords(text)}` };
  });
}

/** Greedy word wrap using a measure function; at most maxLines, last line ends with an ellipsis when cut. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const trial = cur ? cur + " " + words[i] : words[i];
    if (measure(trial) <= maxWidth || !cur) { cur = trial; continue; }
    if (lines.length === maxLines - 1) break;
    lines.push(cur); cur = words[i];
  }
  if (cur) lines.push(cur);
  if (i < words.length) {
    let last = lines[lines.length - 1] + " " + words.slice(i).join(" ");
    last = last.trimEnd();
    while (last.length > 1 && measure(last + "…") > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = last + "…";
  } else if (lines.length && measure(lines[lines.length - 1]) > maxWidth) {
    let l = lines[lines.length - 1];
    while (l.length > 1 && measure(l + "…") > maxWidth) l = l.slice(0, -1);
    lines[lines.length - 1] = l + "…";
  }
  return lines;
}

export const fileSlug = (title: string) =>
  (title.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 40) || "recording") + "-who-talks-the-most.png";

/** What the share card picture says, as text for a screen reader: the title, who talked how much, and the quote when one is on the card. `say` is the translating function (`t`). */
export function cardDescription(title: string, shares: Share[], quote: { text: string; name: string } | null, say: (text: string, vars?: Record<string, string | number>) => string): string {
  const pcts = roundPercents(shares.map((s) => s.pct));
  const talk = shares.map((s, i) => `${s.name} ${pcts[i]}%`).join(", ");
  const parts = [say("Share card for “{title}”.", { title })];
  if (talk) parts.push(say("Talk time: {talk}.", { talk }));
  if (quote) parts.push(say("Quote from {name}: “{text}”", { name: quote.name, text: quote.text }));
  return parts.join(" ");
}
