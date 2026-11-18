import type { Result } from "./types";

/** What an undo step brings back: the transcript and the speaker names. `label` names the edit that moved away from this state. */
export interface Snap { result: Result; names: Record<string, string>; label?: string; at?: number }
export interface History { past: Snap[]; future: Snap[] }

export const HISTORY_LIMIT = 200;
/** Edits with the same `merge` label closer together than this (typing a speaker's name) count as one step. */
export const MERGE_MS = 1500;
export const emptyHistory = (): History => ({ past: [], future: [] });

/** The state before an edit goes on the undo stack, and the redo stack is cleared. With `merge`, a quick repeat of the same kind of edit adds nothing. */
export function record(h: History, before: Snap, label: string | undefined, now: number, merge = false): History {
  const last = h.past[h.past.length - 1];
  if (merge && label && last && last.label === label && now - (last.at ?? 0) < MERGE_MS) return { past: [...h.past.slice(0, -1), { ...last, at: now }], future: [] };
  return { past: [...h.past, { ...before, label, at: now }].slice(-HISTORY_LIMIT), future: [] };
}

/** One step back: the state to show, or null when there is nothing to undo. */
export function stepBack(h: History, cur: Snap): { h: History; snap: Snap } | null {
  const prev = h.past[h.past.length - 1];
  if (!prev) return null;
  return { h: { past: h.past.slice(0, -1), future: [...h.future, { ...cur, label: prev.label }] }, snap: prev };
}

/** One step forward again after an undo. */
export function stepForward(h: History, cur: Snap): { h: History; snap: Snap } | null {
  const next = h.future[h.future.length - 1];
  if (!next) return null;
  return { h: { past: [...h.past, { ...cur, label: next.label }], future: h.future.slice(0, -1) }, snap: next };
}
