import type { CleanupLevels } from "../electron/ipcChannels";

type Levels = CleanupLevels;

/** What the before/after figures say, in plain terms: how much louder the speech got, how much the background changed, and whether the
 *  gap between them (a signal-to-noise estimate) grew. Small changes (under 1 dB) are not worth announcing. */
export interface CleanupVerdict { speech: number; background: number; gap: number; gapKind: "wider" | "narrower" | "same" }

const round = (n: number) => Math.round(n * 10) / 10;

export function cleanupVerdict(before: Levels, after: Levels): CleanupVerdict {
  const gap = round(after.gap_db - before.gap_db);
  return { speech: round(after.speech_db - before.speech_db), background: round(after.noise_floor_db - before.noise_floor_db), gap, gapKind: gap >= 1 ? "wider" : gap <= -1 ? "narrower" : "same" };
}
