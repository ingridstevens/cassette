import type { SaveTracker } from "./saveTracker";
import type { Project, SourceId } from "./types";

/** A file the person chose with "Locate recording", with its identity (size and sampled checksum), as the main process reports it. */
export interface Located { path: string; name: string; source: SourceId }

/**
 * Is the chosen file the recording the project belongs to?
 * "same": its identity matches (or it is the very file the project already uses). "different": the project has an identity and this file does not match it,
 * whatever its name or length. "unverified": the project was saved before identities existed, so only the person can say; the window shows a preview and asks.
 */
export function judgeLocated(project: Pick<Project, "path" | "source">, c: Located): "same" | "different" | "unverified" {
  if (project.source) return project.source.size === c.source.size && project.source.sample === c.source.sample ? "same" : "different";
  return c.path === project.path ? "same" : "unverified";
}

/**
 * Point project `id` at the located recording (and remember its identity), and wait until that is on disk. Only the path and identity change: the id,
 * transcript, speaker names, edits, highlights (their seek positions are seconds in the recording) and restore point stay as they are.
 * When the write fails the old list is saved again, so the project is unchanged on screen and on disk.
 */
export async function commitRelink(tracker: Pick<SaveTracker<Project[]>, "submit" | "drain" | "state">, list: Project[], id: string, c: Located): Promise<{ ok: boolean; error?: string }> {
  const next = list.map((p) => (p.id === id ? { ...p, path: c.path, source: c.source } : p));
  tracker.submit(next);
  await tracker.drain();
  const s = tracker.state();
  if (s.status !== "failed") return { ok: true };
  tracker.submit(list);
  return { ok: false, error: s.error };
}
