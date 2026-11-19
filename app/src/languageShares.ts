/** How much of the speech is in each language, from the language tag each line already carries (a line without its own tag has the recording's language). Nothing is detected here. */
export interface LanguageShare { lang: string; seconds: number; percent: number }

export function languageShares(segments: readonly { start: number; end: number; lang?: string }[], fileLanguage?: string): LanguageShare[] {
  const secs = new Map<string, number>();
  for (const s of segments) {
    const code = s.lang || fileLanguage;
    if (code) secs.set(code, (secs.get(code) ?? 0) + Math.max(0, s.end - s.start));
  }
  const total = [...secs.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const rows = [...secs].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const pct = rows.map(([, v]) => Math.floor((v / total) * 100));
  // The largest remainders get the missing points, so the shares add up to 100 (same rule as the engine's exports).
  const order = rows.map((_, i) => i).sort((i, j) => (rows[j][1] / total) * 100 - pct[j] - ((rows[i][1] / total) * 100 - pct[i]));
  for (const i of order.slice(0, 100 - pct.reduce((a, b) => a + b, 0))) pct[i]++;
  return rows.map(([lang, seconds], i) => ({ lang, seconds, percent: pct[i] }));
}
