/** Selecting words in a line with the keyboard (no DOM here, so it can be tested). */

export interface WordSel { anchor: number; head: number }

/** Where a keyboard selection starts: the word being played in this line, else the first word (going right) or the last (going left). Null for a line without words. */
export function startSel(words: { start: number; end: number }[], time: number, dir: 1 | -1): WordSel | null {
  if (!words.length) return null;
  const now = words.findIndex((w) => time >= w.start && time < w.end);
  const at = now >= 0 ? now : dir > 0 ? 0 : words.length - 1;
  return { anchor: at, head: at };
}

/** Move the free end one word left or right, staying inside the line. */
export function extendSel(sel: WordSel, dir: 1 | -1, count: number): WordSel {
  return { anchor: sel.anchor, head: Math.min(count - 1, Math.max(0, sel.head + dir)) };
}

/** The first and last selected word, whichever way the selection was extended. */
export function selBounds(sel: WordSel): [number, number] {
  return [Math.min(sel.anchor, sel.head), Math.max(sel.anchor, sel.head)];
}
