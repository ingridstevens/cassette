/** Checks for what the window sends to the main process. Pure (no Electron, no disk), so the rules are easy to test.
 *  The engine checks again (argparse choices); these catch bad input before an engine process starts. */
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const MODEL = /^(tiny|base|small|medium|large-v3|large-v3-turbo|parakeet-v3|moonshine-[a-z0-9-]{1,30})$/;
export const LANG = /^(auto|[a-z]{2,3})$/;
export const AUDIO_CLEANUP = new Set(["off", "level", "denoise", "both"]);
export const DEVICE = new Set(["auto", "cpu", "cuda", "mps"]);
export const MODEL_ACTIONS = new Set(["status", "download", "delete", "check", "verify", "repair"]);
export const MODEL_NAME = /^(diarization|(mlx-|llm-)?[a-z0-9][a-z0-9.-]{0,40}|moonshine-[a-z0-9-]{1,30})$/;
/** The folders "reveal" may open. A closed list: the window names a place, never a path. */
export const REVEAL_TARGETS = new Set(["models", "log", "data", "recordings", "peaks", "tmp"]);
export const EXPORT_FORMATS = new Set(["txt", "srt", "vtt", "md", "md-copy", "json", "csv", "docx", "chapters", "edl", "minutes", "highlights", "redacted", "quotes", "changes", "combined-csv"]);
// eslint-disable-next-line no-control-regex -- control characters are exactly what a file name must not keep
export const safeName = (s: unknown, fallback: string): string => String(s || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").slice(0, 120);

/** A speaker count as the window sends it (a number or a digit string): an integer from 1 to 20, else null. */
export function speakerCount(v: unknown): number | null {
  const n = typeof v === "string" && /^\d{1,2}$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}

/** The first problem with the options for "transcribe", or null when they are fine (the recording itself is checked by the caller). */
export function transcribeProblem(o: Record<string, unknown>): string | null {
  if (typeof o.model !== "string" || !MODEL.test(o.model)) return "Unsupported speech model";
  if (typeof o.language !== "string" || !LANG.test(o.language)) return "Unsupported language";
  if (o.device != null && o.device !== "" && (typeof o.device !== "string" || !DEVICE.has(o.device))) return "Unsupported device";
  if (o.audioCleanup != null && (typeof o.audioCleanup !== "string" || !AUDIO_CLEANUP.has(o.audioCleanup))) return "Unsupported audio cleanup";
  return null;
}

/** "repair" works on one model, so it needs a name; "verify" without a name checks every downloaded model. */
export const modelsOk = (action: unknown, name: unknown): boolean =>
  typeof action === "string" && MODEL_ACTIONS.has(action) && (action !== "repair" || !!name) && (!name || (typeof name === "string" && MODEL_NAME.test(name)));

export const saveClipOk = (start: unknown, end: unknown): boolean => isNum(start) && isNum(end) && end > start;

export interface EpisodeClip { start: number; end: number; speaker: string }
/** What "export-episode" takes from the window's transcript payload: the lines, whether any has a chapter, and the kept highlights as clips (speaker ids turned into names).
 *  Returns a message when the payload is unusable (no lines, or a highlight whose start/end is not a finite start < end). */
export function episodeInput(payload: unknown): { chapters: boolean; clips: EpisodeClip[] } | string {
  const p = payload as { segments?: unknown; highlights?: unknown; speakers?: unknown } | null;
  if (!p || typeof p !== "object" || !Array.isArray(p.segments) || !p.segments.length || !p.segments.every((s) => !!s && typeof s === "object")) return "There is nothing to export.";
  const names = p.speakers && typeof p.speakers === "object" ? (p.speakers as Record<string, unknown>) : {};
  const list = p.highlights == null ? [] : p.highlights;
  if (!Array.isArray(list)) return "The highlights are not valid.";
  const clips: EpisodeClip[] = [];
  for (const h of list as { start?: unknown; end?: unknown; speaker?: unknown }[]) {
    if (!h || !saveClipOk(h.start, h.end)) return "A highlight has no valid start and end.";
    const who = typeof h.speaker === "string" ? (typeof names[h.speaker] === "string" ? (names[h.speaker] as string) : h.speaker) : "";
    clips.push({ start: h.start as number, end: h.end as number, speaker: who.slice(0, 80) });
  }
  const chapters = (p.segments as { chapter?: unknown }[]).some((s) => typeof s.chapter === "string" && s.chapter.trim() !== "");
  return { chapters, clips };
}
/** The folder name for the nth try: "Name episode", then "Name episode (2)", so an existing folder is never reused or overwritten. */
export const episodeFolder = (name: unknown, n: number): string => `${safeName(typeof name === "string" ? name.trim() : "", "Episode")} episode${n > 1 ? ` (${n})` : ""}`;
