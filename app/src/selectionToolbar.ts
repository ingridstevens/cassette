/** Logic for the floating toolbar above a selection of words in the transcript (no DOM here, so it can be tested). */

export interface Box { top: number; left: number; width: number; height: number }
export interface Viewport { width: number; height: number }

const MARGIN = 8, GAP = 8;

/** Where to put the toolbar (viewport px, for position: fixed): above the selection, or below it when there is no room above, kept inside the viewport and off the selection where it fits. */
export function toolbarPosition(sel: Box, bar: { width: number; height: number }, view: Viewport): { top: number; left: number; placement: "above" | "below" } {
  const above = sel.top - GAP - bar.height, below = sel.top + sel.height + GAP;
  const fitsAbove = above >= MARGIN, fitsBelow = below + bar.height <= view.height - MARGIN;
  const placement = fitsAbove || !fitsBelow ? "above" : "below";
  const rawTop = placement === "above" ? above : below;
  const top = Math.max(MARGIN, Math.min(rawTop, view.height - MARGIN - bar.height));
  const left = Math.max(MARGIN, Math.min(sel.left + sel.width / 2 - bar.width / 2, view.width - MARGIN - bar.width));
  return { top, left, placement };
}

/** The selected words as a quote with the speaker and the time of the first selected word. */
export function quoteText(speaker: string, time: string, words: { word: string }[], from: number, to: number): string {
  const text = words.slice(from, to + 1).map((w) => w.word).join("").replace(/\s+/g, " ").trim();
  return `${speaker} (${time}): ${text}`;
}
