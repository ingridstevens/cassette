/** Find helpers: matching ignores accents ("lucia" finds "Lucía") and, unless asked otherwise, capitals; it can be limited to whole words; a search with no hits can suggest near misses. */

export interface FindOpts { matchCase: boolean; wholeWord: boolean }
export const FIND_DEFAULTS: FindOpts = { matchCase: false, wholeWord: false };

/** Strip accents (and lower-case unless `keepCase`), one UTF-16 unit at a time, so the result is exactly as long as the input and positions line up with the original text. */
export function fold(s: string, keepCase = false): string {
  let out = "";
  for (const ch of s) {
    if (ch.length !== 1) { out += ch; continue; }
    const base = ch.normalize("NFD").charAt(0);
    if (keepCase) { out += base; continue; }
    const low = base.toLowerCase();
    out += low.length === 1 ? low : base;
  }
  return out;
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

export interface Matcher {
  /** False when nothing was typed. */
  active: boolean;
  /** The typed text, folded: what is actually compared. */
  q: string;
  /** [start, end) of every match in `text`. */
  ranges: (text: string) => Array<[number, number]>;
  test: (text: string) => boolean;
  count: (text: string) => number;
  /** Replace every match; the replacement is taken literally. */
  replace: (text: string, to: string) => { text: string; n: number };
  /** `text` cut into pieces, with `hit` set on the matching ones. */
  parts: (text: string) => Array<{ text: string; hit: boolean }>;
}

export function matcher(query: string, o: FindOpts = FIND_DEFAULTS): Matcher {
  const q = fold(query.trim(), o.matchCase);
  const ranges = (text: string): Array<[number, number]> => {
    if (!q) return [];
    const hay = fold(text, o.matchCase);
    const out: Array<[number, number]> = [];
    let at = 0;
    for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, at)) {
      if (o.wholeWord && (isWordChar(hay[i - 1]) || isWordChar(hay[i + q.length]))) { at = i + 1; continue; }
      out.push([i, i + q.length]);
      at = i + q.length;
    }
    return out;
  };
  const parts = (text: string) => {
    const out: Array<{ text: string; hit: boolean }> = [];
    let at = 0;
    for (const [a, b] of ranges(text)) { if (a > at) out.push({ text: text.slice(at, a), hit: false }); out.push({ text: text.slice(a, b), hit: true }); at = b; }
    if (at < text.length) out.push({ text: text.slice(at), hit: false });
    return out;
  };
  return {
    active: !!q, q, ranges, parts,
    test: (text) => ranges(text).length > 0,
    count: (text) => ranges(text).length,
    replace: (text, to) => {
      const r = ranges(text);
      if (!r.length) return { text, n: 0 };
      let out = "", at = 0;
      for (const [a, b] of r) { out += text.slice(at, a) + to; at = b; }
      return { text: out + text.slice(at), n: r.length };
    },
  };
}

export type NearMiss = { word: string; count: number };

/** Words in the transcript that look like what was typed: the text with one or two letters cut off the end, or a longer word that starts with it. At most three, most frequent first. `q` is the folded query. */
export function nearMisses(texts: string[], q: string): NearMiss[] {
  q = fold(q);
  if (q.length < 3) return [];
  const stems = [q.slice(0, -1), q.slice(0, -2)].filter((s) => s.length >= 3);
  const seen = new Map<string, { forms: Map<string, number>; count: number }>();
  for (const text of texts) {
    for (const raw of text.split(/[\s.,;:!?"“”„«»()¿¡…–—-]+/)) {
      const word = raw.replace(/^['’]+|['’]+$/g, "");
      if (word.length < 3) continue;
      const key = fold(word);
      if (!stems.some((s) => key.startsWith(s)) && !q.startsWith(key)) continue;
      const e = seen.get(key) ?? { forms: new Map(), count: 0 };
      e.count++;
      e.forms.set(word, (e.forms.get(word) ?? 0) + 1);
      seen.set(key, e);
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((e) => ({ word: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0], count: e.count }));
}
