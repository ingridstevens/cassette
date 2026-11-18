import { createHash } from "node:crypto";
import path from "node:path";

/** Pure helpers for the `media:` protocol (streams a recording to the player with Range support) and the waveform cache. No Electron, no disk. */
export const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", flac: "audio/flac", ogg: "audio/ogg", opus: "audio/ogg",
  aac: "audio/aac", mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm",
};
export const mimeFor = (file: string): string => MIME_BY_EXT[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";

/** The recording path inside a `media://file/<encoded path>` URL, or null for any other shape (another host, a query, a malformed escape). */
export function mediaPathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "media:" || u.hostname !== "file" || u.search || u.hash) return null;
    const p = decodeURIComponent(u.pathname.slice(1));
    return p && !p.includes("\0") ? p : null;
  } catch { return null; }
}

export type ByteRange = { status: 200 | 206; start: number; end: number } | { status: 416 };
/** The bytes to send for a `Range` header on a file of `size` bytes. Handles `a-b`, `a-` and `-n` (the last n bytes); a single range only. */
export function byteRange(header: string | null, size: number): ByteRange {
  if (!header) return size > 0 ? { status: 200, start: 0, end: size - 1 } : { status: 200, start: 0, end: -1 };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return { status: 416 };
  let start: number, end: number;
  if (!m[1]) { const n = Number(m[2]); if (n === 0) return { status: 416 }; start = Math.max(0, size - n); end = size - 1; }
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return { status: 416 };
  return { status: 206, start, end };
}

/** Name of the cached waveform for a recording: changes when the file is moved, edited or replaced. */
export const peaksCacheName = (file: string, mtimeMs: number, size: number): string =>
  createHash("sha1").update(`${path.resolve(file)}\0${mtimeMs}\0${size}`).digest("hex") + ".json";
