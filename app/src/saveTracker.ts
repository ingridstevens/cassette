/** Keeps track of whether the latest project list reached the disk. One save runs at a time, and every snapshot has a number, so a slow answer about an older save can never mark a newer edit as saved or failed. No React in here, so it is easy to test. */
export type SaveResult = { ok: boolean; error?: string };
export type SaveState = { status: "saved" | "pending" | "saving" | "failed"; error?: string };

export interface SaveTracker<T> {
  /** A new snapshot of everything: it replaces the one before and counts as an edit that is not saved yet. */
  submit(snapshot: T): void;
  /** Writes the latest snapshot (and any newer one that arrives meanwhile), one write after the other. Resolves when nothing is left to write or a write failed. */
  drain(): Promise<void>;
  /** The Retry button: the same as drain, but also tries again when the last write failed. */
  retry(): Promise<void>;
  /** Close time: writes the latest snapshot now, with the synchronous save. Returns true when everything is on disk. */
  flushSync(): boolean;
  state(): SaveState;
}

export function createSaveTracker<T>(save: (s: T) => Promise<SaveResult>, saveSync: (s: T) => boolean, onChange: (s: SaveState) => void): SaveTracker<T> {
  let latest: T | undefined;
  let latestV = 0;      // number of the newest snapshot
  let savedV = 0;       // number of the newest snapshot known to be on disk
  let failedV = 0;      // number of the newest snapshot whose write failed (0 = none)
  let failedMsg: string | undefined;
  let running: Promise<void> | null = null;
  let last: SaveState = { status: "saved" };

  const compute = (): SaveState => {
    if (savedV >= latestV) return { status: "saved" };
    if (failedV > savedV && !running) return { status: "failed", error: failedMsg };
    return { status: running ? "saving" : "pending" };
  };
  const emit = () => { const s = compute(); if (s.status !== last.status || s.error !== last.error) { last = s; onChange(s); } };

  const loop = async () => {
    while (savedV < latestV) {
      const v = latestV; const snap = latest as T;
      let r: SaveResult;
      try { r = await save(snap); } catch (e) { r = { ok: false, error: String(e) }; }
      if (r.ok) { savedV = Math.max(savedV, v); if (failedV <= savedV) failedV = 0; }
      else if (v > savedV) { failedV = Math.max(failedV, v); failedMsg = r.error ?? "unknown"; if (v === latestV) return; }  // the newest snapshot failed: stop and wait for a retry
      // a failure for a snapshot that a later write already covered is ignored
      emit();
    }
  };
  const start = (): Promise<void> => {
    if (!running) { running = loop().finally(() => { running = null; emit(); }); emit(); }
    return running;
  };

  return {
    submit(snapshot) { latest = snapshot; latestV++; emit(); },
    drain: start,
    retry: start,
    flushSync() {
      if (savedV >= latestV) return true;
      const v = latestV;
      let ok: boolean;
      try { ok = saveSync(latest as T); } catch { ok = false; }
      if (ok) { savedV = Math.max(savedV, v); failedV = 0; }
      else { failedV = Math.max(failedV, v); failedMsg ??= "unknown"; }
      emit();
      return ok;
    },
    state: () => last,
  };
}
