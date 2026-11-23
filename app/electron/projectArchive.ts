/**
 * Back up one project to a single file and restore it as a new project, entirely offline. Plain Node (no Electron), so it is tested directly.
 *
 * File layout (version 1), all streamed, so a recording of any size never sits in memory:
 *   16 bytes   magic "CASSETTE-BACKUP\n"
 *    4 bytes   manifest length (unsigned, big endian)
 *   32 bytes   SHA-256 of the manifest bytes
 *    n bytes   manifest (UTF-8 JSON): format, version, createdAt, app version, the project (without its path on this computer),
 *              and the recording as { path: "media/<file name>", size, sha256 }
 *    m bytes   the recording itself (exactly `size` bytes, nothing after)
 *
 * Every failure is a BackupError with a code, and leaves earlier archives, existing projects and the recordings folder as they were:
 * the archive is written to a ".partial" file and renamed over the destination only when complete, and a restore writes into a temporary
 * file, checks size and checksum, and only then renames it into the name it reserved.
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform, Writable } from "node:stream";

export const MAGIC = Buffer.from("CASSETTE-BACKUP\n", "latin1");
export const FORMAT = "cassette-project-backup";
export const VERSION = 1;
const HEAD = MAGIC.length + 4 + 32;
const MAX_MANIFEST = 64 * 1024 * 1024;
/** Room kept free on top of the bytes to write (the folder entry, the manifest, other programs writing meanwhile). */
const MARGIN = 1024 * 1024;
const MEDIA_EXT = /\.(mp3|wav|m4a|flac|ogg|opus|aac|mp4|mov|mkv|webm)$/i;

export type BackupErrorCode = "missing-source" | "source-changed" | "unwritable" | "low-disk" | "not-backup" | "damaged" | "unsupported" | "unsafe-path" | "failed";
export class BackupError extends Error {
  constructor(public code: BackupErrorCode, message: string) { super(message); this.name = "BackupError"; }
}

export interface Manifest {
  format: typeof FORMAT; version: number; createdAt: number; app: string;
  project: Record<string, unknown>;
  media: { path: string; size: number; sha256: string };
}
export type FreeBytes = (dir: string) => Promise<number | null>;
/** Bytes free on the disk holding `dir`, or null when the system cannot say (then the write itself reports a full disk). */
export const diskFree: FreeBytes = async (dir) => { try { const s = await fs.promises.statfs(dir); return s.bavail * s.bsize; } catch { return null; } };

/** Windows device names cannot be file names, whatever the extension. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
/** A recording's file name inside an archive or the recordings folder: no folders, no dots-only names, nothing a file system treats specially. */
export function safeMediaName(name: unknown): name is string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what a file name must not keep
  return typeof name === "string" && name.length > 0 && name.length <= 200 && !/[\\/:*?"<>|\x00-\x1f]/.test(name) && !/[. ]$/.test(name) && !name.startsWith(".") && !RESERVED.test(name) && MEDIA_EXT.test(name);
}
/** The name a recording is stored under: its own file name with anything unsafe replaced, or "recording.<ext>" when nothing usable is left. */
export function mediaNameFor(file: string): string {
  const base = path.basename(file.replace(/\\/g, "/"));
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/^\.+/, "").replace(/[. ]+(?=\.[^.]+$)/, "").slice(-200);
  if (safeMediaName(cleaned)) return cleaned;
  const ext = /\.[A-Za-z0-9]{2,4}$/.exec(base)?.[0] ?? "";
  return `recording${MEDIA_EXT.test(`x${ext}`) ? ext : ".wav"}`;
}

const SHA = /^[0-9a-f]{64}$/;
/** The media entry of a manifest, checked: a path of the exact shape `media/<safe name>`, a whole-number size, a SHA-256. Throws BackupError. */
export function checkMedia(m: unknown): Manifest["media"] {
  const e = m as { path?: unknown; size?: unknown; sha256?: unknown } | null;
  if (!e || typeof e !== "object") throw new BackupError("damaged", "The backup has no recording in it.");
  if (typeof e.path !== "string" || !e.path.startsWith("media/") || !safeMediaName(e.path.slice(6))) throw new BackupError("unsafe-path", "The backup names a recording path that is not safe to restore.");
  if (typeof e.size !== "number" || !Number.isSafeInteger(e.size) || e.size < 0 || typeof e.sha256 !== "string" || !SHA.test(e.sha256)) throw new BackupError("damaged", "The backup's recording details are not valid.");
  return { path: e.path, size: e.size, sha256: e.sha256 };
}

/** The bytes before the recording: magic, manifest length and checksum, manifest. */
export function encodeHead(manifest: Manifest): Buffer {
  const body = Buffer.from(JSON.stringify(manifest), "utf8");
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  return Buffer.concat([MAGIC, len, createHash("sha256").update(body).digest(), body]);
}

/** Counts bytes and hashes them; `check` runs once at the end and can fail the stream. */
function meter(check: (size: number, sha: string) => void) {
  const h = createHash("sha256"); let size = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) { h.update(chunk); size += chunk.length; cb(null, chunk); },
    flush(cb) { try { check(size, h.digest("hex")); cb(); } catch (e) { cb(e as Error); } },
  });
}
async function hashFile(file: string): Promise<{ size: number; sha256: string }> {
  let out = { size: 0, sha256: "" };
  await pipeline(fs.createReadStream(file), meter((size, sha256) => { out = { size, sha256 }; }), new Writable({ write(_c, _e, cb) { cb(); } }));
  return out;
}

/** What a failed file operation means to the person: a full disk, a place that cannot be written, or something else. */
function ioError(e: unknown, what: string): BackupError {
  if (e instanceof BackupError) return e;
  const code = (e as NodeJS.ErrnoException)?.code;
  if (code === "ENOSPC" || code === "EDQUOT") return new BackupError("low-disk", "There is not enough free disk space.");
  if (code === "EACCES" || code === "EPERM" || code === "EROFS" || code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR") return new BackupError("unwritable", `${what} cannot be written to.`);
  return new BackupError("failed", String((e as Error)?.message ?? e).slice(0, 300));
}
const rm = (f: string) => { try { fs.rmSync(f, { force: true }); } catch { /* best effort: it is our own temporary file */ } };

export interface BackupInput { dest: string; project: Record<string, unknown>; mediaPath: string; app: string; now?: number; freeBytes?: FreeBytes }

/** Writes the archive for one project to `dest` (replacing an earlier archive there only once the new one is complete). Returns its size in bytes. */
export async function writeBackup({ dest, project, mediaPath, app, now = Date.now(), freeBytes = diskFree }: BackupInput): Promise<{ bytes: number }> {
  let st: fs.Stats;
  try { st = fs.statSync(mediaPath); } catch { throw new BackupError("missing-source", "The recording this project belongs to is not there any more."); }
  if (!st.isFile()) throw new BackupError("missing-source", "The recording this project belongs to is not there any more.");
  const { path: _own, ...rest } = project; // the path on this computer is of no use elsewhere (and is private)
  const tmp = `${dest}.partial`;
  try {
    const dir = path.dirname(dest);
    try { fs.accessSync(dir, fs.constants.W_OK); } catch { throw new BackupError("unwritable", "That folder cannot be written to."); }
    const free = await freeBytes(dir);
    if (free !== null && free < st.size + MARGIN + JSON.stringify(rest).length) throw new BackupError("low-disk", "There is not enough free disk space for the backup.");
    const sum = await hashFile(mediaPath);
    const manifest: Manifest = { format: FORMAT, version: VERSION, createdAt: now, app, project: rest, media: { path: `media/${mediaNameFor(mediaPath)}`, size: sum.size, sha256: sum.sha256 } };
    const head = encodeHead(manifest);
    // The recording is read a second time while writing and checked against the first pass, so a file that changed in between is caught, not archived half-and-half.
    const media = fs.createReadStream(mediaPath).pipe(meter((size, sha) => { if (size !== sum.size || sha !== sum.sha256) throw new BackupError("source-changed", "The recording changed while it was being backed up. Try again."); }));
    media.on("error", () => { /* surfaced through the pipeline below */ });
    await pipeline(Readable.from((async function* () { yield head; for await (const c of media) yield c; })()), fs.createWriteStream(tmp));
    const fh = await fs.promises.open(tmp, "r+"); // flushed to the disk before the rename, so a power cut cannot leave a complete-looking archive with missing data
    try { await fh.sync(); } finally { await fh.close(); }
    fs.renameSync(tmp, dest);
    return { bytes: head.length + sum.size };
  } catch (e) { rm(tmp); throw ioError(e, "That place"); }
}

/** Reads and checks everything before the recording. Throws BackupError; touches nothing on disk. */
export async function readManifest(archive: string): Promise<{ manifest: Manifest; dataStart: number; fileSize: number }> {
  let fh: fs.promises.FileHandle;
  try { fh = await fs.promises.open(archive, "r"); } catch { throw new BackupError("failed", "The backup file could not be opened."); }
  try {
    const fileSize = (await fh.stat()).size;
    const head = Buffer.alloc(HEAD);
    const { bytesRead } = await fh.read(head, 0, HEAD, 0);
    const seen = head.subarray(0, Math.min(bytesRead, MAGIC.length));
    if (!seen.equals(MAGIC.subarray(0, seen.length))) throw new BackupError("not-backup", "This is not a Cassette project backup.");
    if (bytesRead < HEAD) throw new BackupError("damaged", "The backup is cut short.");
    const len = head.readUInt32BE(MAGIC.length);
    if (len > MAX_MANIFEST || HEAD + len > fileSize) throw new BackupError("damaged", "The backup is cut short or damaged.");
    const body = Buffer.alloc(len);
    const r = await fh.read(body, 0, len, HEAD);
    if (r.bytesRead !== len || !createHash("sha256").update(body).digest().equals(head.subarray(MAGIC.length + 4))) throw new BackupError("damaged", "The backup's contents list is damaged.");
    let m: Partial<Manifest> | null;
    try { m = JSON.parse(body.toString("utf8")); } catch { throw new BackupError("damaged", "The backup's contents list is damaged."); }
    if (!m || typeof m !== "object" || m.format !== FORMAT || typeof m.version !== "number" || !Number.isInteger(m.version) || m.version < 1) throw new BackupError("not-backup", "This is not a Cassette project backup.");
    if (m.version > VERSION) throw new BackupError("unsupported", "This backup was made by a newer version of Cassette.");
    if (!m.project || typeof m.project !== "object" || Array.isArray(m.project)) throw new BackupError("damaged", "The backup has no project in it.");
    const media = checkMedia(m.media);
    if (fileSize !== HEAD + len + media.size) throw new BackupError("damaged", "The backup is cut short or has extra data.");
    return { manifest: { format: FORMAT, version: m.version, createdAt: Number(m.createdAt) || 0, app: String(m.app ?? ""), project: m.project as Record<string, unknown>, media }, dataStart: HEAD + len, fileSize };
  } finally { await fh.close().catch(() => {}); }
}

export interface RestoreInput { archive: string; mediaDir: string; freeBytes?: FreeBytes }
export interface Restored { project: Record<string, unknown>; mediaPath: string; bytes: number; createdAt: number }

/** The first free name in `dir` for `name` ("Talk.m4a", "Talk (2).m4a", ...), reserved by creating it empty, so nothing is overwritten even by a second restore at the same time. */
function reserve(dir: string, name: string): string {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  for (let n = 1; n < 10000; n++) {
    const dest = path.join(dir, n === 1 ? name : `${stem} (${n})${ext}`);
    try { fs.closeSync(fs.openSync(dest, "wx")); return dest; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  }
  throw new BackupError("failed", "No free file name was found for the recording.");
}

/** Checks the archive completely (contents list, size, checksum) and only then puts its recording into `mediaDir` under a name nobody uses. The caller adds the project. */
export async function restoreBackup({ archive, mediaDir, freeBytes = diskFree }: RestoreInput): Promise<Restored> {
  const { manifest, dataStart } = await readManifest(archive);
  const media = manifest.media;
  let reserved = "", tmp = "";
  try {
    try { fs.mkdirSync(mediaDir, { recursive: true }); } catch (e) { throw ioError(e, "The recordings folder"); }
    const free = await freeBytes(mediaDir);
    if (free !== null && free < media.size + MARGIN) throw new BackupError("low-disk", "There is not enough free disk space to restore the recording.");
    tmp = path.join(mediaDir, `.restoring-${randomBytes(6).toString("hex")}.part`);
    const check = meter((size, sha) => { if (size !== media.size || sha !== media.sha256) throw new BackupError("damaged", "The recording in the backup does not match its checksum: the backup is damaged."); });
    // an empty recording has no byte range to read (a stream cannot end before it starts), but its checksum is still checked
    const source = media.size === 0 ? Readable.from([]) : fs.createReadStream(archive, { start: dataStart, end: dataStart + media.size - 1 });
    await pipeline(source, check, fs.createWriteStream(tmp, { flags: "wx" }));
    reserved = reserve(mediaDir, path.basename(media.path));
    fs.renameSync(tmp, reserved); tmp = "";
    return { project: manifest.project, mediaPath: reserved, bytes: media.size, createdAt: manifest.createdAt };
  } catch (e) {
    if (tmp) rm(tmp);
    if (reserved) rm(reserved);
    throw ioError(e, "The recordings folder");
  }
}
