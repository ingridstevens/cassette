import type { Project } from "./types";

const VIDEO_EXT = /\.(mp4|mov|mkv|webm)$/i;
/** Whether a recording is a video file (shown as a small badge in the project list). Everything else the app accepts is audio. */
export const mediaKind = (path: string): "video" | "audio" => (VIDEO_EXT.test(path) ? "video" : "audio");

/** "Name copy", then "Name copy 2", "Name copy 3"... the first one no project has. `suffix` is the translated word ("copy"). */
export function copyName(name: string, taken: string[], suffix: string): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  const base = `${name} ${suffix}`;
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/**
 * A copy of a project's app data: transcript, speaker names, settings and run details. It points at the same recording file (nothing
 * on disk is copied), starts without undo history, an older-transcript step, or a last-export memory, and never carries a running job.
 */
export function duplicateProject(p: Project, id: string, name: string, now: number): Project {
  return {
    id, path: p.path, name, addedAt: now, editedAt: now,
    result: p.result ? structuredClone(p.result) : null,
    names: { ...p.names },
    opts: p.opts ? structuredClone(p.opts) : undefined,
    meta: p.meta ? structuredClone(p.meta) : undefined,
    trial: p.trial,
    status: p.result ? "done" : "idle",
  };
}

/** Another project uses the same recording file: deleting one must not delete the recording or backup file the other still needs. */
export const sharesRecording = (projects: Pick<Project, "id" | "path">[], p: Pick<Project, "id" | "path">): boolean =>
  projects.some((o) => o.id !== p.id && o.path === p.path);

/** The next item in a menu of `count` items when an arrow key, Home or End is pressed (wraps). -1 when the key does nothing. */
export function menuStep(key: string, current: number, count: number): number {
  if (!count) return -1;
  if (key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowUp") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return -1;
}
