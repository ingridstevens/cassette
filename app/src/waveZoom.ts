/** Zoom for the waveform: pure helpers. A zoom is a factor over "the whole recording across the width" (1 = fit). */

const STEPS = [1, 2, 4, 8, 16, 32, 64, 128];
/** Never draw more than this many pixels per second, and never stretch one cached peak wider than PX_PER_PEAK pixels. */
const MAX_PX_PER_SEC = 400;
const PX_PER_PEAK = 10;

/** The largest zoom factor that still shows real detail (1 when zooming would show nothing new). */
export function maxZoom(width: number, duration: number, peaks: number): number {
  if (!(width > 0) || !(duration > 0) || !(peaks > 0)) return 1;
  const fit = width / duration;
  const limit = Math.min(MAX_PX_PER_SEC, (peaks * PX_PER_PEAK) / duration);
  const m = Math.floor(limit / fit);
  return m >= 2 ? Math.min(m, STEPS[STEPS.length - 1]) : 1;
}

export const clampZoom = (f: number, max: number): number => (Number.isFinite(f) ? Math.min(Math.max(1, f), Math.max(1, max)) : 1);

/** The next zoom in a direction: doubles (1, 2, 4 …), ends exactly at the maximum, never leaves 1..max. */
export function stepZoom(f: number, dir: 1 | -1, max: number): number {
  const cur = clampZoom(f, max);
  if (dir > 0) { const next = STEPS.find((s) => s > cur + 1e-9); return clampZoom(next === undefined || next > max ? max : next, max); }
  const prev = [...STEPS].reverse().find((s) => s < cur - 1e-9);
  return prev ?? 1;
}

/** wavesurfer's minPxPerSec for a factor (0 = fit to the width). */
export const pxPerSec = (f: number, width: number, duration: number): number => (f <= 1 || !(duration > 0) ? 0 : (f * width) / duration);

/** "2×", "1.5×"; "" at fit. Used in the buttons and the live region. */
export const zoomLabel = (f: number): string => (f <= 1 ? "" : `${Math.round(f * 10) / 10}×`);

/** Where to scroll (px) to keep the playhead in view while following; null when it is already comfortably visible. */
export function followScroll(time: number, pps: number, scrollLeft: number, viewWidth: number): number | null {
  if (!(pps > 0) || !(viewWidth > 0) || !Number.isFinite(time)) return null;
  const x = time * pps;
  if (x >= scrollLeft + viewWidth * 0.08 && x <= scrollLeft + viewWidth * 0.85) return null;
  return Math.max(0, x - viewWidth * 0.3);
}
