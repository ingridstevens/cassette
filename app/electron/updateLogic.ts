/**
 * The decisions behind the optional update notice (Settings, Privacy, "Tell me when a new version is out"), kept free of Electron and of the network
 * so they can be tested. The one request itself is made in ipc/updates.ts, and only when the switch is on.
 */
export const WEEK_MS = 7 * 24 * 3600 * 1000;

/** What is kept on disk (update-check.json in the app's data folder). A missing or unreadable file means the switch is off and nothing was ever checked. */
export type UpdateFile = { on: boolean; lastChecked: number | null; latest: string | null; failed: boolean };
export const UPDATES_OFF: UpdateFile = { on: false, lastChecked: null, latest: null, failed: false };

/** What the window is shown. "newer" is the newest release's version when it is newer than this app, otherwise null. */
export type UpdateState = { on: boolean; lastChecked: number | null; newer: string | null; failed: boolean; current: string };

/** "v1.2.3" or "1.2.3" to [1, 2, 3]. Anything else (a pre-release such as 1.2.3-beta, a date, text) is not a version this check acts on. */
export function parseVersion(s: unknown): number[] | null {
  if (typeof s !== "string") return null;
  const m = /^v?(\d{1,6})\.(\d{1,6})(?:\.(\d{1,6}))?$/.exec(s.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

export function isNewer(latest: unknown, current: unknown): boolean {
  const a = parseVersion(latest), b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The version number out of GitHub's "latest release" answer, or null when the answer is not what we expect (a draft or pre-release is never "latest" there, but is refused anyway). */
export function releaseVersion(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const r = body as { tag_name?: unknown; draft?: unknown; prerelease?: unknown };
  if (r.draft === true || r.prerelease === true || !parseVersion(r.tag_name)) return null;
  return String(r.tag_name).trim().replace(/^v/, "");
}

/** Once a week, and only while the switch is on. A last-checked time in the future (a clock that was wrong) counts as due, so a check is never postponed for good. */
export function dueForCheck(f: Pick<UpdateFile, "on" | "lastChecked">, now: number): boolean {
  if (!f.on) return false;
  if (f.lastChecked === null) return true;
  return f.lastChecked > now || now - f.lastChecked >= WEEK_MS;
}

export function readUpdateFile(text: string): UpdateFile {
  try {
    const j = JSON.parse(text) as Partial<UpdateFile>;
    return {
      on: j.on === true,
      lastChecked: typeof j.lastChecked === "number" && Number.isFinite(j.lastChecked) ? j.lastChecked : null,
      latest: parseVersion(j.latest) ? String(j.latest) : null,
      failed: j.failed === true,
    };
  } catch { return UPDATES_OFF; }
}

export function updateState(f: UpdateFile, current: string): UpdateState {
  return { on: f.on, lastChecked: f.lastChecked, newer: f.on && isNewer(f.latest, current) ? f.latest : null, failed: f.on && f.failed, current };
}
