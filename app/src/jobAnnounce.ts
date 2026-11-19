import type { ProjectStatus } from "./types";

/** What a screen-reader user hears about a running job: when the stage changes and at each quarter, never on every tick. */
export interface ProgressMark { label: string; quarter: number }

export function progressAnnouncement(last: ProgressMark | null, label: string, fraction: number | null, say: (stage: string, percent: number | null) => string): { text: string; mark: ProgressMark } {
  const quarter = fraction == null ? 0 : Math.min(4, Math.max(0, Math.floor(fraction * 4)));
  if (!last || last.label !== label) return { text: say(label, null), mark: { label, quarter } };
  if (quarter > last.quarter && quarter < 4) return { text: say(label, quarter * 25), mark: { label, quarter } };
  return { text: "", mark: last };
}

/** The sentence for a project that just stopped running, or "" when nothing finished or failed. */
export function finishAnnouncement(prev: ProjectStatus | undefined, next: ProjectStatus, done: () => string, failed: () => string): string {
  if (prev !== "running" && prev !== "queued") return "";
  return next === "done" ? done() : next === "error" ? failed() : "";
}
