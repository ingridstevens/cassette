import { saferModel, tooBigForMemory } from "./estimate";

/**
 * "Suggested for this computer" (#187). A pure function of what the computer reports (system, memory) and nothing else:
 * no network, no timing run, no identifier. It only suggests a Whisper size, never changes a setting or downloads anything;
 * the start sheet offers it as a button. Sizes and memory needs are the repo's own (docs/models.md, estimate.ts).
 * No speed is claimed here: the start sheet's time estimate is already labelled a rough guess.
 */
const ORDER = ["tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"];
const rank = (m: string) => ORDER.indexOf(m);

export interface Machine { platform: string; arch: string; memGB?: number }
export interface Suggestion {
  model: string;
  /** "memory": the chosen size may not fit; "better": the chosen size is smaller than this computer comfortably runs. */
  reason: "memory" | "better";
  /** False everywhere except Apple silicon Macs, the only system the app has been run on (docs/compatibility.md). */
  tested: boolean;
  /** Apple silicon only: the Apple GPU version of the suggested size is available but not downloaded. */
  appleGpuMissing: boolean;
}

export const isTested = (m: Machine) => m.platform === "darwin" && m.arch === "arm64";

/** The size to start with: Small (the documented default) unless it will not fit in memory, then the biggest that does. */
export const recommendedModel = (m: Machine, speakers: boolean) => (tooBigForMemory("small", speakers, m.memGB) ? saferModel(speakers, m.memGB) : "small");

/** A suggestion to offer instead of `current`, or null when `current` is fine. A bigger size that fits is never "corrected". */
export function suggest(current: string, m: Machine, speakers: boolean, status?: { mlxAvailable?: boolean; mlx?: Record<string, boolean> } | null): Suggestion | null {
  if (rank(current) < 0) return null; // Parakeet, Moonshine or an unknown id: a deliberate choice
  const model = recommendedModel(m, speakers);
  if (model === current) return null;
  const reason = tooBigForMemory(current, speakers, m.memGB) ? "memory" : rank(current) < rank(model) ? "better" : null;
  if (!reason) return null;
  return { model, reason, tested: isTested(m), appleGpuMissing: isTested(m) && !!status?.mlxAvailable && !status.mlx?.[model] };
}

const KEY = "modelSuggestionDismissed";
/** Remembered per suggested size, so a different suggestion later (new memory, new choice) is not hidden by an old "no thanks". Stays on this computer. */
export function loadDismissed(): string { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } }
export function saveDismissed(model: string): void { try { localStorage.setItem(KEY, model); } catch { /* storage unavailable: it just shows again */ } }
