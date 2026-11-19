import type { Highlight, Segment, Word } from "./types";

/** Which end of a highlight is moved. */
export type Edge = "start" | "end";
/** The smallest a highlight may get, in seconds. */
export const MIN_LEN = 0.1;
/** The fixed step of a fine nudge, in seconds. */
export const FINE_STEP = 0.1;

const flat = (segments: Segment[]): Word[] => segments.flatMap((s) => s.words).filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.word.trim()).sort((a, b) => a.start - b.start || a.end - b.end);
const textOf = (ws: Word[]) => ws.map((w) => w.word).join("").trim();

/** The text of the words that lie in start..end (a word counts when most of it is inside); the old text when no word does. */
function textFor(segments: Segment[], h: Highlight, start: number, end: number): string {
  const ws = flat(segments).filter((w) => { const mid = (w.start + w.end) / 2; return mid >= start && mid <= end; });
  return ws.length ? textOf(ws) : h.text;
}

/** The highlight with new bounds, or null when they are not valid (finite, start < end by at least MIN_LEN, inside 0..duration) or change nothing. */
export function withBounds(segments: Segment[], h: Highlight, start: number, end: number, duration: number): Highlight | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const s = Math.max(0, start), e = duration > 0 ? Math.min(duration, end) : end;
  if (e - s < MIN_LEN - 1e-9) return null;
  if (s === h.start && e === h.end) return null;
  return { ...h, start: s, end: e, text: textFor(segments, h, s, e) };
}

/** Moves one edge to the previous (-1) or next (+1) word boundary. Null at the limit (the other edge, the start of the recording or its last word). */
export function nudgeWord(segments: Segment[], h: Highlight, edge: Edge, dir: -1 | 1, duration: number): Highlight | null {
  const ws = flat(segments);
  if (edge === "start") {
    const starts = [...new Set(ws.map((w) => w.start))];
    const next = dir < 0 ? [...starts].reverse().find((x) => x < h.start - 0.05) : starts.find((x) => x > h.start + 0.05 && x <= h.end - MIN_LEN);
    return next === undefined ? null : withBounds(segments, h, next, h.end, duration);
  }
  const ends = [...new Set(ws.map((w) => w.end))];
  const next = dir < 0 ? [...ends].reverse().find((x) => x < h.end - 0.05 && x >= h.start + MIN_LEN) : ends.find((x) => x > h.end + 0.05);
  return next === undefined ? null : withBounds(segments, h, h.start, next, duration);
}

/** Moves one edge by a fixed step (seconds; negative = earlier), kept valid. Null when it cannot move. */
export function nudgeStep(segments: Segment[], h: Highlight, edge: Edge, delta: number, duration: number): Highlight | null {
  const round = (x: number) => Math.round(x * 1000) / 1000;
  if (edge === "start") return withBounds(segments, h, round(Math.min(Math.max(0, h.start + delta), h.end - MIN_LEN)), h.end, duration);
  const top = duration > 0 ? duration : Infinity;
  return withBounds(segments, h, h.start, round(Math.max(Math.min(top, h.end + delta), h.start + MIN_LEN)), duration);
}

/** A dragged edge: the time snaps to the closest word boundary (a start to a word start, an end to a word end) and stays valid. */
export function dragEdge(segments: Segment[], h: Highlight, edge: Edge, time: number, duration: number): Highlight | null {
  if (!Number.isFinite(time)) return null;
  const ws = flat(segments);
  const pool = [...new Set(ws.map((w) => (edge === "start" ? w.start : w.end)))].filter((x) => (edge === "start" ? x <= h.end - MIN_LEN : x >= h.start + MIN_LEN));
  const snapped = pool.length ? pool.reduce((a, b) => (Math.abs(b - time) < Math.abs(a - time) ? b : a)) : time;
  return edge === "start" ? withBounds(segments, h, snapped, h.end, duration) : withBounds(segments, h, h.start, snapped, duration);
}
