/**
 * Safe exports: a file is first written to a private staging folder INSIDE the destination folder (same disk, so the final step is a rename),
 * and only a finished file replaces the one that was there. If the engine fails, the disk fills up, or the destination cannot be replaced
 * (open in another program, read-only), the earlier file is still there and still readable. The staged file keeps the destination's own name
 * (the engine takes the title of Word files and markers from it). Plain Node, so it can be tested without Electron.
 * A crash can leave a `.cassette-staging-…` folder behind; it holds only an unfinished copy and is safe to delete.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Why a save failed, in words the window can translate: the file is in use or read-only, the folder is missing, the disk is full, or something else. */
export type FailKind = "locked" | "folder" | "space" | "other";

export class ExportFailure extends Error {
  constructor(readonly kind: FailKind, message: string) { super(message); }
}

const LOCKED = new Set(["EACCES", "EPERM", "EBUSY", "EROFS", "EISDIR", "EEXIST", "ENOTEMPTY", "EMFILE"]);
const MISSING = new Set(["ENOENT", "ENOTDIR"]);
const FULL = new Set(["ENOSPC", "EDQUOT", "EFBIG"]);
export function failKind(e: unknown): FailKind {
  const code = (e as NodeJS.ErrnoException | null)?.code;
  return typeof code !== "string" ? "other" : LOCKED.has(code) ? "locked" : MISSING.has(code) ? "folder" : FULL.has(code) ? "space" : "other";
}
/** Any thrown value as an ExportFailure (the message is cut to a sensible length). */
export const plainFailure = (e: unknown): ExportFailure => e instanceof ExportFailure ? e : new ExportFailure(failKind(e), String((e as Error)?.message ?? e).slice(0, 300));

const STAGING = ".cassette-staging-";

/**
 * Runs `run` with a staging path that has the same file name as `dest`, then moves the result over `dest`.
 * `beside` lists other file names the run writes next to the staged file (for example the anonymisation report); the ones that exist are moved
 * next to `dest` as well. On any failure nothing is moved over an existing file, and the staging folder is removed.
 */
export async function withStaged(dest: string, run: (staged: string) => Promise<void>, beside: string[] = []): Promise<void> {
  const folder = path.dirname(dest);
  const stage = path.join(folder, `${STAGING}${randomUUID().slice(0, 8)}`);
  try { fs.mkdirSync(stage); } catch (e) { throw plainFailure(e); }
  try {
    const staged = path.join(stage, path.basename(dest));
    await run(staged);
    if (!fs.existsSync(staged)) throw new ExportFailure("other", "The export finished but no file was written.");
    for (const name of beside) { const s = path.join(stage, name); if (fs.existsSync(s)) fs.renameSync(s, path.join(folder, name)); }
    fs.renameSync(staged, dest);
  } catch (e) { throw plainFailure(e); }
  finally { fs.rmSync(stage, { recursive: true, force: true }); }
}

/** Writes bytes to `dest` through the staging step. */
export const writeStaged = (dest: string, data: string | Uint8Array): Promise<void> => withStaged(dest, async (s) => { fs.writeFileSync(s, data); });

export interface EpisodeStep { id: string; file: string; run: (staged: string) => Promise<void> }
export interface StepFailure { id: string; file: string; kind: FailKind; message: string }
/**
 * Runs each step into `dir` (a step is one file or folder), keeping going after a failure so one bad file does not cost the others.
 * `only` limits the run to those step ids (a retry). Files that were saved are never touched again by a retry.
 */
export async function runSteps(dir: string, steps: EpisodeStep[], only?: string[]): Promise<{ saved: string[]; failed: StepFailure[] }> {
  const saved: string[] = [], failed: StepFailure[] = [];
  for (const s of steps) {
    if (only && !only.includes(s.id)) continue;
    try { await withStaged(path.join(dir, s.file), s.run); saved.push(s.id); }
    catch (e) { const f = plainFailure(e); failed.push({ id: s.id, file: s.file, kind: f.kind, message: f.message }); }
  }
  return { saved, failed };
}
