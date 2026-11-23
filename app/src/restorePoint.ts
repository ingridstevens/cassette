import type { SaveTracker } from "./saveTracker";
import type { Project, RestorePoint, Result, Segment } from "./types";

/** The project as it is now, kept as the restore point. Null when there is no transcript to keep. `label` says what is about to happen. */
export function takeRestorePoint(p: Pick<Project, "result" | "names" | "meta">, label: string, at: number): RestorePoint | null {
  if (!p.result) return null;
  return { result: p.result, names: p.names, meta: p.meta, label, at };
}

/**
 * Put the restore point back. What was on screen becomes the new restore point, so a restore can itself be taken back
 * (and a restore that does not reach the disk loses nothing: the old point is still in the saved file).
 */
export function restoreFrom(p: Pick<Project, "result" | "names" | "meta" | "previous">, label: string, at: number): Partial<Project> | null {
  const prev = p.previous;
  if (!prev) return null;
  return { result: prev.result, names: prev.names, meta: prev.meta, previous: takeRestorePoint(p, label, at) ?? undefined, trial: undefined };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A restore point as read from projects.json. Older versions saved only { result, names, meta } (no label or time), and a hand-edited or
 * damaged file may hold less. Returns undefined when there is no usable transcript in it; otherwise fills in what is missing.
 */
export function readRestorePoint(raw: unknown): RestorePoint | undefined {
  if (!isObj(raw) || !isObj(raw.result) || !Array.isArray(raw.result.segments)) return undefined;
  const r = raw.result as unknown as Partial<Result>;
  const segments = (r.segments as Segment[]).filter(isObj).map((s) => (Array.isArray(s.words) ? s : { ...s, words: [] }));
  const speakers = Array.isArray(r.speakers) ? r.speakers : Array.from(new Set(segments.map((s) => s.speaker)));
  const result: Result = { ...(r as Result), language: typeof r.language === "string" ? r.language : "en", duration: typeof r.duration === "number" ? r.duration : 0, speakers, segments };
  if (!Array.isArray(result.highlights)) delete result.highlights;
  return {
    result, names: isObj(raw.names) ? (raw.names as Record<string, string>) : {},
    ...(isObj(raw.meta) ? { meta: raw.meta as RestorePoint["meta"] } : {}),
    ...(typeof raw.label === "string" ? { label: raw.label } : {}), ...(typeof raw.at === "number" ? { at: raw.at } : {}),
  };
}

/**
 * Store a restore point for project `id` and wait until it is on disk. The caller starts the operation only when `ok` is true; when the
 * write fails the returned list is the old one again (the restore point is taken back), so nothing was changed and nothing half-done is saved.
 */
export async function writeRestorePoint(tracker: Pick<SaveTracker<Project[]>, "submit" | "drain" | "state">, list: Project[], id: string, point: RestorePoint): Promise<{ ok: boolean; list: Project[]; error?: string }> {
  const next = list.map((p) => (p.id === id ? { ...p, previous: point } : p));
  tracker.submit(next);
  await tracker.drain();
  const s = tracker.state();
  if (s.status !== "failed") return { ok: true, list: next };
  const back = list;
  tracker.submit(back);
  return { ok: false, list: back, error: s.error };
}
