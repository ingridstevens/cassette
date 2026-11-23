import type { Project } from "./types";
import { readParts } from "./sources";

/** What the window gets back from "Back up project" or "Restore project backup" (see electron/ipcChannels.ts). */
export type BackupFailure = "missing-source" | "source-changed" | "unwritable" | "low-disk" | "not-backup" | "damaged" | "unsupported" | "unsafe-path" | "failed";

/**
 * The project a restored backup becomes: a new project that points at the restored recording, never one that replaces another.
 * The id is kept when it is free; when a project with that id is already in the list (the original, or an earlier restore of the same
 * backup) it gets a fresh one and the name says so, so the existing project is untouched. Anything that only makes sense while the app
 * runs (a job in progress, an error) is dropped, and the status follows the transcript.
 * `saved.appended` (the added recordings) arrives with each one's path already pointing at where it was restored; their order, offsets and boundary notes are kept as they were.
 */
export function restoredProject(existing: Pick<Project, "id" | "name">[], saved: Record<string, unknown>, mediaPath: string, freshId: string, now: number, collisionSuffix: string): { project: Project; collided: boolean } {
  const text = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
  const id = text(saved.id, freshId);
  const collided = existing.some((p) => p.id === id);
  const name = text(saved.name, "Restored project");
  const taken = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  let finalName = name;
  if (collided) { finalName = `${name} ${collisionSuffix}`; for (let n = 2; taken.has(finalName.toLowerCase()); n++) finalName = `${name} ${collisionSuffix} ${n}`; }
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : undefined);
  const src = obj(saved.source) as Record<string, unknown> | undefined;
  const result = obj(saved.result) as Project["result"] | undefined;
  const project: Project = {
    id: collided ? freshId : id, path: mediaPath, name: finalName,
    addedAt: typeof saved.addedAt === "number" ? saved.addedAt : now, openedAt: now, editedAt: now,
    result: result && Array.isArray((result as { segments?: unknown }).segments) ? result : null,
    names: (obj(saved.names) as Record<string, string> | undefined) ?? {},
    opts: obj(saved.opts) as Project["opts"], meta: obj(saved.meta) as Project["meta"], trial: saved.trial === true ? true : undefined,
    previous: obj(saved.previous) as Project["previous"], lastExport: obj(saved.lastExport) as Project["lastExport"],
    source: src && typeof src.size === "number" && typeof src.sample === "string" ? { size: src.size, sample: src.sample } : undefined,
    appended: readParts(saved.appended),
    status: "idle",
  };
  project.status = project.result ? "done" : "idle";
  return { project, collided };
}
