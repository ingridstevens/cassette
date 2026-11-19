/** "Play from selection" stops at the end of the selection. The player has no play-range of its own, so this small controller watches the playhead. */

/** The start and end (seconds) of words `from`..`to`, or null when they have no usable timing. */
export function rangeOfWords(words: { start: number; end: number }[], from: number, to: number): { start: number; end: number } | null {
  const lo = Math.max(0, Math.min(from, to)), hi = Math.min(words.length - 1, Math.max(from, to));
  const a = words[lo], b = words[hi];
  if (!a || !b || !Number.isFinite(a.start) || !Number.isFinite(b.end) || b.end <= a.start) return null;
  return { start: a.start, end: b.end };
}

/** Remembers where a played range ends. Normal playback never arms it, so it never changes plain play. */
export class RangeStop {
  private end: number | null = null;
  /** Stop when the playhead reaches `end`. */
  arm(end: number) { this.end = Number.isFinite(end) ? end : null; }
  /** Forget the range (manual pause, seek, a new play, a new recording). */
  clear() { this.end = null; }
  get armed() { return this.end !== null; }
  /** Call on every time update: true once, when the playhead has reached the end (the range is then forgotten). */
  tick(time: number): boolean {
    if (this.end === null || !Number.isFinite(time) || time < this.end) return false;
    this.end = null;
    return true;
  }
}
