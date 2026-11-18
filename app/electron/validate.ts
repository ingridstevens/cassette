/** Checks for what the window sends to the main process. Pure (no Electron, no disk), so the rules are easy to test.
 *  The engine checks again (argparse choices); these catch bad input before an engine process starts. */
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const MODEL = /^(tiny|base|small|medium|large-v3|large-v3-turbo|parakeet-v3|moonshine-[a-z0-9-]{1,30})$/;
export const LANG = /^(auto|[a-z]{2,3})$/;
export const DEVICE = new Set(["auto", "cpu", "cuda", "mps"]);
export const MODEL_ACTIONS = new Set(["status", "download", "delete", "check"]);
export const MODEL_NAME = /^(diarization|(mlx-|llm-)?[a-z0-9][a-z0-9.-]{0,40}|moonshine-[a-z0-9-]{1,30})$/;
export const EXPORT_FORMATS = new Set(["txt", "srt", "vtt", "md", "json", "csv", "docx", "chapters", "edl", "minutes", "highlights", "redacted", "quotes", "changes", "combined-csv"]);
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
  return null;
}

export const modelsOk = (action: unknown, name: unknown): boolean =>
  typeof action === "string" && MODEL_ACTIONS.has(action) && (!name || (typeof name === "string" && MODEL_NAME.test(name)));

export const saveClipOk = (start: unknown, end: unknown): boolean => isNum(start) && isNum(end) && end > start;
