/** Projects older than the retention period the user chose. The app only ASKS about them; it never deletes anything by itself. */
export interface Dated { id: string; name: string; addedAt: number; status: string }

const DAY = 86_400_000;
/** Projects added more than `days` ago that are not being worked on (not queued or running). `days` of 0 or undefined means retention is off. */
export function dueForRetention<T extends Dated>(projects: T[], days: number | undefined, now = Date.now()): T[] {
  if (!days || days <= 0) return [];
  return projects.filter((p) => !["queued", "running"].includes(p.status) && now - p.addedAt > days * DAY);
}

/** Whole days a project has existed, for the list ("added 45 days ago"). */
export const ageDays = (addedAt: number, now = Date.now()) => Math.max(0, Math.floor((now - addedAt) / DAY));
