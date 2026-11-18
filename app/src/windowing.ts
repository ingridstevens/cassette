/** Windowing for the transcript: only the lines near the viewport are in the page, the rest are stood in for by blank space of the right height. */

/** Height guessed for a line that has not been drawn yet, in px (replaced by the average of the measured ones). */
export const DEFAULT_ROW = 110;

/** Top edge of every row, with the total height last: offsets[i] is where row i starts, offsets[n] is the end. `gap` is the space between rows. */
export function rowOffsets(heights: ArrayLike<number | undefined>, count: number, gap: number): number[] {
  let sum = 0, known = 0;
  for (let i = 0; i < count; i++) { const h = heights[i]; if (h) { sum += h; known++; } }
  const guess = known ? sum / known : DEFAULT_ROW;
  const out = new Array<number>(count + 1);
  let y = 0;
  for (let i = 0; i < count; i++) { out[i] = y; y += (heights[i] || guess) + gap; }
  out[count] = y;
  return out;
}

/** The rows [start, end) that touch the span from `top` to `bottom` (px from the start of the list), widened by `overscan` px on both sides. */
export function visibleRange(offsets: number[], top: number, bottom: number, overscan: number): [number, number] {
  const n = offsets.length - 1;
  if (n <= 0) return [0, 0];
  const lo = top - overscan, hi = bottom + overscan;
  // first row whose end is below `lo`
  let a = 0, b = n;
  while (a < b) { const m = (a + b) >> 1; if (offsets[m + 1] <= lo) a = m + 1; else b = m; }
  const start = Math.min(a, n - 1);
  // first row that starts at or after `hi`
  a = start; b = n;
  while (a < b) { const m = (a + b) >> 1; if (offsets[m] < hi) a = m + 1; else b = m; }
  return [start, Math.max(a, Math.min(n, start + 1))];
}

/** The rows to draw: the window plus every pinned row (one being edited, focused or scrolled to), in order. */
export function renderIndices(count: number, range: [number, number], pinned: Iterable<number>): number[] {
  const set = new Set<number>();
  for (let i = Math.max(0, range[0]); i < Math.min(count, range[1]); i++) set.add(i);
  for (const p of pinned) if (Number.isInteger(p) && p >= 0 && p < count) set.add(p);
  return [...set].sort((x, y) => x - y);
}

/** Height of the blank space standing in for rows [from, to): flex items are `gap` apart, so the space and its two gaps must add up to the rows' own. */
export function spacerHeight(offsets: number[], from: number, to: number, gap: number): number {
  return Math.max(0, offsets[to] - offsets[from] - gap);
}

/** Ask the transcript on screen to scroll a line into view (drawing it first if it is outside the window); resolves with the line's element, or null when no transcript is shown. */
export const SCROLL_EVENT = "cassette:scroll-turn";
export interface ScrollJob { index: number; block: "center" | "nearest"; behavior: "smooth" | "auto"; handled?: boolean; resolve(el: HTMLElement | null): void }
export function scrollToTurn(index: number, opts: { block?: "center" | "nearest"; behavior?: "smooth" | "auto" } = {}): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const job: ScrollJob = { index, block: opts.block ?? "center", behavior: opts.behavior ?? "smooth", resolve };
    if (typeof document === "undefined") { resolve(null); return; }
    document.dispatchEvent(new CustomEvent<ScrollJob>(SCROLL_EVENT, { detail: job }));
    if (!job.handled) resolve(null);
  });
}
