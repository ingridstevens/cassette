/** Projects older than the retention period the user chose. The app only ASKS about them; it never deletes anything by itself. */
export interface Dated { id: string; name: string; addedAt: number; openedAt?: number; editedAt?: number; meta?: { finishedAt?: number }; status: string }

const DAY = 86_400_000;
/** When the project was last used: added, opened, edited or transcribed, whichever is latest. */
export const lastUsed = (p: Dated) => Math.max(p.addedAt, p.openedAt ?? 0, p.editedAt ?? 0, p.meta?.finishedAt ?? 0);
/** Projects not used for more than `days` that are not being worked on (not queued or running). `days` of 0 or undefined means retention is off. */
export function dueForRetention<T extends Dated>(projects: T[], days: number | undefined, now = Date.now()): T[] {
  if (!days || days <= 0) return [];
  return projects.filter((p) => !["queued", "running"].includes(p.status) && now - lastUsed(p) > days * DAY);
}

/** Whole days since a time, for the list ("not opened for 45 days"). */
export const ageDays = (addedAt: number, now = Date.now()) => Math.max(0, Math.floor((now - addedAt) / DAY));
