/**
 * Which line of the transcript a summary item (a decision or an action item) came from.
 * The language model gives no times for these, so each item is matched to the line that shares the most of its words.
 * Nothing is sent anywhere; when no line is a clear match the item gets no time, rather than a wrong one.
 */
import type { Segment } from "./types";

const words = (s: string): Set<string> => {
  const out = new Set<string>();
  for (const w of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w.length >= 3) out.add(w.slice(0, 5)); // 5 letters: "decided" and "decision" meet, so do German endings
  return out;
};

/** Start time of the line that best matches `text`, or null when no line shares enough words (at least two, and a third of the item's own). */
export function sourceTime(text: string, segments: Segment[]): number | null {
  const mine = words(text);
  if (mine.size < 2) return null;
  let best = 0, at: number | null = null;
  for (const seg of segments) {
    const theirs = words(seg.text);
    let shared = 0;
    for (const w of mine) if (theirs.has(w)) shared++;
    if (shared < 2 || shared / mine.size < 0.34) continue;
    // prefer more shared words; on a tie the earlier line wins (strictly greater)
    if (shared > best) { best = shared; at = seg.start; }
  }
  return at;
}
