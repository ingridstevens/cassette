import type { NetActivity } from "../electron/netWatch";

/** Counts for the Network activity card. "duringTranscription" counts every kind of entry made while a transcription was running. */
export function netSummary(a: NetActivity) {
  const n = (k: string) => a.entries.filter((e) => e.kind === k).length;
  return { requests: n("request"), models: n("model"), links: n("link"), duringTranscription: a.entries.filter((e) => e.whileTranscribing).length, transcriptions: a.transcriptions };
}
