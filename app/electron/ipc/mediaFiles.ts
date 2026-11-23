/** Recordings: the media:// player source, the waveform, picking and registering files, the sample, file facts, and saving one clip. */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { app, dialog, protocol, shell } from "electron";
import { EngineEvent, runEngine } from "../engine-client";
import { byteRange, mediaPathFromUrl, mimeFor, peaksCacheName } from "../media";
import { AUDIO_CLEANUP, saveClipOk } from "../validate";
import { privateTmp } from "../tempJson";
import type { CleanupLevels } from "../ipcChannels";
import { fingerprintFile } from "../sourceId";
import { handle, type IpcContext } from "./typed";

/** The sample interview shipped with the app (extraResources in electron-builder.yml; docs/samples when run from source). */
const SAMPLE_FILE = "test-interview-english-two-voices.m4a";

export function registerMediaFiles({ known, mediaFile, knownMedia, baseEnv }: IpcContext) {
  // The player's source: media://file/<encoded path>, with Range support so seeking works and nothing is read into memory. Only known recordings are served.
  protocol.handle("media", async (req) => {
    const p = mediaPathFromUrl(req.url);
    if (!p || !knownMedia(p)) return new Response(null, { status: 403 });
    let size: number;
    try { size = (await fs.promises.stat(p)).size; } catch { return new Response(null, { status: 404 }); }
    const r = byteRange(req.headers.get("range"), size);
    if (r.status === 416) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const headers: Record<string, string> = { "Content-Type": mimeFor(p), "Content-Length": String(r.end - r.start + 1), "Accept-Ranges": "bytes" };
    if (r.status === 206) headers["Content-Range"] = `bytes ${r.start}-${r.end}/${size}`;
    if (size === 0) return new Response(null, { status: 200, headers });
    const stream = fs.createReadStream(p, { start: r.start, end: r.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: r.status, headers });
  });
  // The waveform of a recording (largest sample in each of 8000 slices) and its length, computed by the engine and cached in userData/peaks.
  // null when the recording is gone (a normal situation: the waveform area says so).
  handle("peaks", async (_e, p: unknown) => {
    if (!knownMedia(p)) return null;
    const st = fs.statSync(p);
    const cache = path.join(app.getPath("userData"), "peaks", peaksCacheName(p, st.mtimeMs, st.size));
    try { const c = JSON.parse(fs.readFileSync(cache, "utf8")); if (Array.isArray(c?.peaks) && typeof c.duration === "number") return c as { peaks: number[]; duration: number }; } catch { /* not cached yet, or unreadable */ }
    const r = await runEngine(randomUUID(), ["peaks", p, "--points", "8000"], {}, () => {}) as EngineEvent | null;
    if (r?.type !== "done" || !Array.isArray(r.peaks) || typeof r.duration !== "number") throw new Error(String(r?.message ?? "The waveform could not be made.").slice(0, 300));
    const out = { peaks: r.peaks as number[], duration: r.duration };
    try { fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, JSON.stringify(out)); } catch { /* the cache is only a speed-up */ }
    return out;
  });
  // Before and after figures for an audio cleanup on the start of a recording. The engine works on temporary copies in the app's private temp folder.
  handle("cleanup-estimate", async (_e, p: unknown, mode: unknown) => {
    if (!knownMedia(p)) return { ok: false as const, error: "The recording could not be found." };
    if (typeof mode !== "string" || mode === "off" || !AUDIO_CLEANUP.has(mode)) return { ok: false as const, error: "Unsupported audio cleanup" };
    const dir = privateTmp();
    const r = await runEngine(randomUUID(), ["cleanup-estimate", p, "--mode", mode], { ...baseEnv(), TMPDIR: dir, TEMP: dir, TMP: dir }, () => {}) as EngineEvent | null;
    if (r?.type !== "done" || !r.before || !r.after) return { ok: false as const, error: String(r?.message ?? "The estimate could not be made.").slice(0, 300) };
    return { ok: true as const, before: r.before as CleanupLevels, after: r.after as CleanupLevels, seconds: Number(r.seconds) || 0 };
  });
  handle("pick-file", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "Audio / Video", extensions: ["mp3", "wav", "m4a", "flac", "ogg", "opus", "aac", "mp4", "mov", "mkv", "webm"] }] });
    if (!r.canceled) known.add(r.filePaths);
    return r.canceled ? [] : r.filePaths;
  });
  // Files dropped on the window (their paths come from webUtils.getPathForFile) become known too.
  // "Try a sample": copies the bundled English interview into userData/recordings (so deleting the project deletes the copy, never the bundled file) and returns its path.
  handle("sample", () => {
    try {
      const src = app.isPackaged ? path.join(process.resourcesPath, "sample", SAMPLE_FILE) : path.join(app.getAppPath(), "..", "docs", "samples", SAMPLE_FILE);
      const dir = path.join(app.getPath("userData"), "recordings");
      fs.mkdirSync(dir, { recursive: true });
      let n = 1, dest = path.join(dir, "Sample interview.m4a");
      while (fs.existsSync(dest)) dest = path.join(dir, `Sample interview (${++n}).m4a`);
      fs.copyFileSync(src, dest);
      known.add([dest]);
      return { ok: true as const, path: dest };
    } catch (e) { return { ok: false as const, error: String((e as Error).message) }; }
  });
  handle("register-paths", (_e, paths: unknown) => { if (Array.isArray(paths)) known.add(paths.filter(mediaFile)); });
  handle("reveal-path", (_e, p: unknown) => { if (knownMedia(p)) shell.showItemInFolder(p); });
  // Read-only: the size in bytes of a recording the user added (null if it is gone or is not a regular file).
  handle("file-size", (_e, p: unknown) => {
    if (typeof p !== "string") return null;
    try { const st = fs.statSync(p); return st.isFile() ? st.size : null; } catch { return null; }
  });
  handle("fingerprint-file", (_e, p: unknown) => (knownMedia(p) ? fingerprintFile(p) : null));
  // "Locate recording": the person picks the moved file. It becomes known (so it can be played) and its identity comes back; the project is changed by the window, only after it has checked the identity and saved.
  handle("locate-recording", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Audio / Video", extensions: ["mp3", "wav", "m4a", "flac", "ogg", "opus", "aac", "mp4", "mov", "mkv", "webm"] }] });
    const p = r.filePaths[0];
    if (r.canceled || !p) return { ok: false as const, cancelled: true };
    const source = mediaFile(p) ? await fingerprintFile(p) : null;
    if (!source) return { ok: false as const };
    known.add([p]);
    return { ok: true as const, path: p, name: path.basename(p), source };
  });

  handle("save-clip", async (_e, input: string, start: number, end: number) => {
    if (!mediaFile(input) || !saveClipOk(start, end)) return null;
    // the engine re-encodes to the extension of the chosen file, so the save dialog offers the same formats as "Audio clips as"
    const FORMATS = [["MP3", "mp3"], ["M4A", "m4a"], ["WAV", "wav"]] as const;
    const src = path.extname(input).slice(1).toLowerCase();
    const first = FORMATS.find(([, e]) => e === src) ?? FORMATS[0];
    const r = await dialog.showSaveDialog({
      defaultPath: `${path.basename(input, path.extname(input))}_clip.${first[1]}`,
      filters: [first, ...FORMATS.filter((f) => f !== first)].map(([name, e]) => ({ name, extensions: [e] })),
    });
    if (r.canceled || !r.filePath) return null;
    if (!FORMATS.some(([, e]) => path.extname(r.filePath!).toLowerCase() === `.${e}`)) r.filePath += `.${first[1]}`;
    const res = await runEngine(randomUUID(), ["clip", input, r.filePath, "--start", String(start), "--end", String(end)], {}, () => {});
    return res?.type === "done" ? r.filePath : null;
  });
}
