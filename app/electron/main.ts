import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, app, dialog, ipcMain, powerMonitor, safeStorage, session, shell } from "electron";
import { EngineEvent, cancelJob, runEngine } from "./engine-client";
import { redactNames } from "./logRedact";
import { registerLive } from "./live";
import { createKnownPaths } from "./knownPaths";
import { isAppNavigation } from "./navGuard";
import { createProjectsStore } from "./projectsStore";

// Show "Cassette" as the app name (menus, About, Dock) instead of "Electron" when run from source.
// setName also moves the data folder, so keep it exactly where it was: nobody loses their projects or downloaded models.
{ const userData = app.getPath("userData"); app.setName("Cassette"); app.setPath("userData", userData); }

const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".mp4", ".mov", ".mkv", ".webm"]);

// One running copy only: two would both rewrite projects.json and erase each other's edits. The lock is tied to the userData path, so it comes after setPath.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    const files = argv.filter((a) => AUDIO_EXT.has(path.extname(a).toLowerCase()) && fs.existsSync(a));
    if (files.length) win?.webContents.send("open-files", files);
  });
}

const modelsDir = () => path.join(app.getPath("userData"), "models");
const tokenFile = () => path.join(app.getPath("userData"), "hf-token.bin");
const baseEnv = () => ({ ENGINE_MODELS_DIR: modelsDir() });

let win: BrowserWindow | null = null;
/** The running model download/delete job, so the renderer can cancel it. */
let modelsJob: string | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 1040, minHeight: 600, title: "Cassette", ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 18, y: 18 } } : {}),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const dev = process.env.VITE_DEV_SERVER_URL;
  const appUrl = dev ?? pathToFileURL(path.join(__dirname, "..", "dist")).href;
  // Hardening: the window never navigates away from the app, and no web permission is granted except writing to the
  // clipboard, which the Copy buttons need. Reading the clipboard stays refused.
  win.webContents.on("will-navigate", (e, url) => { if (!isAppNavigation(appUrl, url, !!dev)) e.preventDefault(); });
  // The microphone is allowed only as audio-only capture (the Record page); the camera and everything else stay refused.
  const micOnly = (perm: string, details?: { mediaTypes?: string[] }) => perm === "media" && !!details?.mediaTypes?.length && details.mediaTypes.every((m) => m === "audio");
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb, details) => cb(perm === "clipboard-sanitized-write" || micOnly(perm, details as { mediaTypes?: string[] })));
  session.defaultSession.setPermissionCheckHandler((_wc, perm, _origin, details) => perm === "clipboard-sanitized-write" || (perm === "media" && (details as { mediaType?: string }).mediaType === "audio"));
  // A renderer that crashes (often out of memory) or fails to load leaves a blank white window: log why and reload, but not in a loop.
  let reloads: number[] = [];
  const reload = () => {
    const now = Date.now();
    reloads = reloads.filter((t) => now - t < 60_000);
    if (reloads.length >= 3 || !win || win.isDestroyed()) return;
    reloads.push(now);
    win.webContents.reload();
  };
  win.webContents.on("render-process-gone", (_e, d) => { logLine("crash", `renderer gone: ${d.reason} (exit code ${d.exitCode})`); if (d.reason !== "clean-exit") reload(); });
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 is a navigation we cancelled ourselves
    logLine("crash", `failed to load ${url}: ${desc} (${code})`);
    setTimeout(reload, 1000);
  });
  win.on("unresponsive", () => logLine("crash", "window is unresponsive"));
  if (dev) win.loadURL(dev); else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

const logFile = () => path.join(app.getPath("userData"), "activity.log");
/** The log is on unless the marker file exists. A file, not a setting in the window, so the main process (which writes the log) never has to ask. */
const logOffFile = () => path.join(app.getPath("userData"), "activity-log-off");
const logOn = () => !fs.existsSync(logOffFile());
/** Marker: when present, file and folder names it recognises are replaced before a line is written (new lines only). */
const logHideFile = () => path.join(app.getPath("userData"), "activity-log-hide-names");
const logHides = () => fs.existsSync(logHideFile());
const logText = (message: string) => (logHides() ? redactNames(message) : message);
const logLine = (level: string, message: string) => {
  if (!logOn()) return;
  try { fs.appendFileSync(logFile(), `${new Date().toISOString()} [${level}] ${logText(message)}\n`); } catch { /* best effort */ }
};
const send = (channel: string, payload: unknown) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload); // the window can be closed while an engine job still runs (macOS keeps the app alive)
  const e = payload as { type?: string; level?: string; message?: string; stage?: string };
  if (channel === "engine-event" && (e.type === "log" || e.type === "error") && logOn()) {
    try { fs.appendFileSync(logFile(), `${new Date().toISOString()} [${e.level ?? e.type}] ${logText(String(e.message))}\n`); } catch { /* best effort */ }
  }
};

function readToken(): string {
  try { return safeStorage.decryptString(fs.readFileSync(tokenFile())); } catch { return ""; }
}

// Transcript text handed to the engine as a file lives in a private folder (owner-only), not the shared system temp folder, and is always deleted afterwards.
const privateTmp = () => { const d = path.join(app.getPath("userData"), "tmp"); fs.mkdirSync(d, { recursive: true, mode: 0o700 }); return d; };
async function withTempJson<T>(data: unknown, fn: (file: string) => Promise<T>): Promise<T> {
  const f = path.join(privateTmp(), `${randomUUID()}.json`);
  fs.writeFileSync(f, JSON.stringify(data), { mode: 0o600 });
  try { return await fn(f); } finally { fs.rmSync(f, { force: true }); }
}

app.whenReady().then(() => {
  try { fs.rmSync(path.join(app.getPath("userData"), "tmp"), { recursive: true, force: true }); } catch { /* leftovers from a crash; nothing to do */ }
  // In development the Dock shows Electron's own icon; show ours instead. Packaged builds get it from resources/icon.icns.
  const devIcon = path.join(__dirname, "..", "resources", "icon.png");
  if (process.platform === "darwin" && process.env.VITE_DEV_SERVER_URL) app.dock?.setIcon(devIcon);
  // The About window: our name, version and icon, also in development (where it would otherwise say "Electron").
  // Packaged builds take the icon from the app bundle, so iconPath is only set when the PNG is there.
  app.setAboutPanelOptions({
    applicationName: "Cassette", applicationVersion: app.getVersion(), version: app.getVersion(),
    copyright: "Public domain (The Unlicense)", ...(fs.existsSync(devIcon) ? { iconPath: devIcon } : {}),
  });
  const known = createKnownPaths();
  registerLive(send, baseEnv, known);
  ipcMain.on("renderer-error", (_e, message: unknown) => logLine("renderer", String(message).slice(0, 4000)));
  // Returns the raw bytes of an audio/video file so the renderer can build a Blob URL (no custom protocol needed).
  /** A recording path from the renderer must be a string, an audio/video extension and an existing regular file. */
  const mediaFile = (p: unknown): p is string => {
    if (typeof p !== "string" || !AUDIO_EXT.has(path.extname(p).toLowerCase())) return false;
    try { return fs.statSync(p).isFile(); } catch { return false; }
  };
  /** A recording the app knows about (see knownPaths.ts): the window may only read, reveal or delete those. */
  const knownMedia = (p: unknown): p is string => mediaFile(p) && known.has(p);
  ipcMain.handle("read-audio", async (_e, p: string) => {
    if (typeof p !== "string" || !AUDIO_EXT.has(path.extname(p).toLowerCase())) throw new Error("Unsupported file type");
    if (!knownMedia(p)) return null; // moved, renamed or deleted: a normal situation, so no error: the waveform area says so
    const buf = await fs.promises.readFile(p);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  });

  // English translation of one stretch of a recording (the "Translate to English" action on a line).
  ipcMain.handle("translate-line", async (_e, p: { input: unknown; start: unknown; end: unknown; model: unknown; language: unknown; backend?: unknown }) => {
    if (!mediaFile(p?.input) || typeof p.start !== "number" || typeof p.end !== "number" || !(p.end > p.start)) return { ok: false, error: "Unsupported or missing recording" };
    const a = ["translate", p.input, "--start", String(p.start), "--end", String(p.end), "--model", String(p.model || "small"), "--language", String(p.language || "auto"), ...(p.backend === "faster" ? ["--backend", "faster"] : [])];
    const r = await runEngine(randomUUID(), a, baseEnv(), () => {}) as EngineEvent | null;
    return r?.type === "done" ? { ok: true, text: String(r.text ?? "") } : { ok: false, error: String(r?.message ?? "The translation failed.").slice(0, 300) };
  });
  // The local language model: "highlights" (suggest quotable passages), "summarize", or "ask" (answer a question, `payload.question`, about the transcript). The renderer picks the job id so it can cancel with `cancel`.
  ipcMain.handle("llm-run", async (_e, kind: unknown, payload: { segments: unknown[]; speakers: Record<string, string>; language: string; question?: string; history?: { q: string; a: string }[] }, o: { jobId?: unknown; clientId?: unknown; model?: unknown; count?: unknown }) => {
    if (kind !== "highlights" && kind !== "summarize" && kind !== "ask") return { type: "error", message: "Unknown job" };
    const jobId = typeof o?.jobId === "string" && o.jobId.length <= 80 ? o.jobId : randomUUID();
    return await withTempJson(payload, (tmp) => {
      const a = [kind, tmp, ...(typeof o?.model === "string" && /^[a-z0-9][a-z0-9.-]{0,40}$/.test(o.model) ? ["--model", o.model] : []), ...(kind === "highlights" && Number.isInteger(o?.count) && (o.count as number) > 0 ? ["--count", String(o.count)] : [])];
      return runEngine(jobId, a, baseEnv(), (e) => send("engine-event", { jobId, source: "llm", clientId: o?.clientId, ...e }));
    });
  });
  // One audio file per highlight, written into a folder the user picks (created if needed), then shown in the file manager.
  ipcMain.handle("export-clips", async (_e, input: unknown, clips: { start: number; end: number; speaker?: string }[], format: unknown, name: unknown) => {
    if (!mediaFile(input) || !Array.isArray(clips) || !clips.length || !clips.every((c) => Number.isFinite(c?.start) && Number.isFinite(c?.end) && c.end > c.start)) return { ok: false, error: "Unsupported or missing recording" };
    const r = await dialog.showOpenDialog({ title: "Choose where to save the clips", properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { cancelled: true };
    const fmt = format === "wav" || format === "m4a" ? format : "mp3";
    const dir = path.join(r.filePaths[0], `${String(name || "Highlights").replace(/[\\/:*?"<>|]/g, "-")} highlights`);
    const res = await withTempJson(clips.map((c) => ({ start: c.start, end: c.end, speaker: String(c.speaker ?? "") })), (tmp) => runEngine(randomUUID(), ["export-clips", input, dir, "--clips", tmp, "--format", fmt], {}, () => {})) as EngineEvent | null;
    if (res?.type !== "done") return { ok: false, error: String(res?.message ?? "The export failed.").slice(0, 300) };
    const paths = res.paths as string[];
    if (paths[0]) shell.showItemInFolder(paths[0]);
    return { ok: true, count: paths.length, path: dir };
  });
  // Whether the computer is running on battery (the start sheet warns before a long job).
  ipcMain.handle("power-state", () => { try { return { onBattery: powerMonitor.isOnBatteryPower() }; } catch { return { onBattery: false }; } });
  ipcMain.handle("pick-file", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "Audio / Video", extensions: ["mp3", "wav", "m4a", "flac", "ogg", "opus", "aac", "mp4", "mov", "mkv", "webm"] }] });
    if (!r.canceled) known.add(r.filePaths);
    return r.canceled ? [] : r.filePaths;
  });
  // Files dropped on the window (their paths come from webUtils.getPathForFile) become known too.
  ipcMain.handle("register-paths", (_e, paths: unknown) => { if (Array.isArray(paths)) known.add(paths.filter(mediaFile)); });

  ipcMain.handle("transcribe", async (_e, opts: Record<string, unknown>) => {
    if (!mediaFile(opts?.input)) throw new Error("Unsupported or missing recording");
    const jobId = randomUUID();
    const a = ["transcribe", String(opts.input), "--model", String(opts.model), "--language", String(opts.language)];
    const range = opts.numSpeakers === "range";
    if (range) { a.push("--min-speakers", String(opts.minSpeakers ?? "2"), "--max-speakers", String(opts.maxSpeakers ?? "4")); }
    if (opts.language === "auto") a.push("--mixed-languages", opts.multilingual === true ? "on" : opts.multilingual === false ? "off" : "auto");
    if (typeof opts.detectModel === "string" && /^[a-z0-9-]{1,20}$/.test(opts.detectModel)) a.push("--detect-model", opts.detectModel);
    if (opts.translate) a.push(typeof opts.translateTo === "string" && /^[a-zA-Z-]{2,8}$/.test(opts.translateTo) && opts.translateTo !== "en" ? "--translate-to" : "--translate", ...(typeof opts.translateTo === "string" && /^[a-zA-Z-]{2,8}$/.test(opts.translateTo) && opts.translateTo !== "en" ? [opts.translateTo] : []));
    if (opts.whisperEngine === "faster") a.push("--backend", "faster");
    if (opts.verbatim) a.push("--verbatim");
    for (const k of ["numSpeakers", "start", "end"] as const) {
      if (k === "numSpeakers" && range) continue;
      if (opts[k] != null && opts[k] !== "") a.push(`--${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`, String(opts[k]));
    }
    if (opts.device && opts.device !== "auto") a.push("--device", String(opts.device));
    if (opts.vad) a.push("--vad");
    if (opts.prompt) a.push(`--prompt=${String(opts.prompt).slice(0, 2000)}`); // "=" form: a value starting with "-" would be read as an option
    if (opts.noDiarize) a.push("--no-diarize");
    if (opts.acceptFit) a.push("--accept-fit");
    send("engine-event", { jobId, type: "started", clientId: opts.clientId });
    runEngine(jobId, a, baseEnv(), (e) => send("engine-event", { jobId, ...e })).then((r) => { if (r?.type === "error") send("engine-event", { jobId, ...r }); });
    return jobId;
  });
  ipcMain.handle("cancel", (_e, jobId: string) => cancelJob(jobId));

  // Copy models that someone else downloaded (a "models" folder) into this app's models folder.
  ipcMain.handle("import-models", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "Choose the folder that contains the models" });
    if (r.canceled || !r.filePaths[0]) return { cancelled: true };
    return await runEngine(randomUUID(), ["models", "import", r.filePaths[0]], baseEnv(), () => {}) as EngineEvent | null;
  });
  ipcMain.handle("models", async (_e, action: string, name?: string) => {
    const a = ["models", action, ...(name ? [name] : [])];
    const env: Record<string, string> = { ...baseEnv() };
    if ((name === "diarization" && action === "download") || action === "check") env.HF_TOKEN = readToken();
    const jobId = randomUUID();
    if (action !== "status") modelsJob = jobId;
    try {
      const r = await runEngine(jobId, a, env, (e) => send("engine-event", { jobId, source: "models", ...e }));
      return r as EngineEvent | null;
    } finally { if (modelsJob === jobId) modelsJob = null; }
  });
  ipcMain.handle("cancel-models", () => { if (modelsJob) { cancelJob(modelsJob); return true; } return false; });

  // Saves a PNG the renderer drew (the share card). `dataUrl` must be a PNG data URL.
  ipcMain.handle("save-image", async (_e, dataUrl: unknown, defaultName: unknown) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) return { ok: false, error: "Not a PNG image." };
    const r = await dialog.showSaveDialog({ defaultPath: `${String(defaultName || "share-card").replace(/[\\/:*?"<>|]/g, "-")}.png`, filters: [{ name: "PNG image", extensions: ["png"] }] });
    if (r.canceled || !r.filePath) return { cancelled: true };
    try { fs.writeFileSync(r.filePath, Buffer.from(dataUrl.slice(22), "base64")); return { ok: true, path: r.filePath }; }
    catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  ipcMain.handle("reveal-path", (_e, p: unknown) => { if (knownMedia(p)) shell.showItemInFolder(p); });
  // Read-only: the size in bytes of a recording the user added (null if it is gone or is not a regular file).
  ipcMain.handle("file-size", (_e, p: unknown) => {
    if (typeof p !== "string") return null;
    try { const st = fs.statSync(p); return st.isFile() ? st.size : null; } catch { return null; }
  });
  ipcMain.handle("disk-free", () => {
    try { fs.mkdirSync(modelsDir(), { recursive: true }); const st = fs.statfsSync(modelsDir()); return st.bavail * st.bsize; } catch { return null; }
  });
  ipcMain.handle("reveal", (_e, what: "models" | "log" | "data") => {
    if (what === "models") { fs.mkdirSync(modelsDir(), { recursive: true }); return shell.openPath(modelsDir()); }
    if (what === "data") return shell.openPath(app.getPath("userData"));
    if (!fs.existsSync(logFile())) fs.writeFileSync(logFile(), "");
    shell.showItemInFolder(logFile());
  });
  // Activity log controls: is it on, how big is it, switch it, empty it. Nothing here reads the log's text.
  ipcMain.handle("log-state", () => { let bytes = 0; try { bytes = fs.statSync(logFile()).size; } catch { /* no log yet */ } return { on: logOn(), bytes, hideNames: logHides() }; });
  ipcMain.handle("log-set", (_e, on: unknown) => {
    try { if (on) fs.rmSync(logOffFile(), { force: true }); else fs.writeFileSync(logOffFile(), ""); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  ipcMain.handle("log-hide-names", (_e, hide: unknown) => {
    try { if (hide) fs.writeFileSync(logHideFile(), ""); else fs.rmSync(logHideFile(), { force: true }); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  ipcMain.handle("log-clear", () => { try { fs.writeFileSync(logFile(), ""); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; } });
  ipcMain.handle("paths", () => ({
    models: modelsDir(), log: logFile(), token: tokenFile(), data: app.getPath("userData"),
    system: { platform: process.platform, arch: process.arch, chip: os.cpus()[0]?.model ?? "", cores: os.cpus().length, memGB: Math.round(os.totalmem() / 2 ** 30) },
  }));

  ipcMain.handle("open-external", async (_e, url: string) => {
    if (typeof url !== "string" || !url.startsWith("https://huggingface.co/")) return false;
    await shell.openExternal(url);
    return true;
  });

  // On Linux without a keyring, safeStorage falls back to "basic_text", which is effectively plain text.
  const tokenSecure = () => safeStorage.isEncryptionAvailable()
    && !(process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text");
  ipcMain.handle("tokenSecure", () => tokenSecure());
  ipcMain.handle("token", (_e, value?: string) => {
    const hint = () => { const t = readToken(); return t ? "hf_…" + t.slice(-4) : ""; };
    if (value === undefined) return hint();
    if (value === "") { fs.rmSync(tokenFile(), { force: true }); return ""; }
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(tokenFile(), safeStorage.encryptString(value));
    return hint();
  });

  ipcMain.handle("export", async (_e, payload: { segments: unknown[]; speakers: Record<string, string> }, format: string, defaultName: string) => {
    const ext = ({ chapters: "txt", quotes: "txt", highlights: "docx", changes: "txt", redacted: "txt", minutes: "docx", "combined-csv": "csv" } as Record<string, string>)[format] ?? format; // the engine format id differs from the file extension for chapters
    const r = await dialog.showSaveDialog({ defaultPath: `${defaultName}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (r.canceled || !r.filePath) return { cancelled: true };
    const args = ["--format", format];
    if (format === "redacted") { // the key maps P01 back to real names, so it goes to a second place, away from the anonymised text
      const k = await dialog.showSaveDialog({
        title: "Where should the key go? Keep it apart from the data",
        defaultPath: path.join(app.getPath("documents"), `${path.basename(r.filePath, path.extname(r.filePath))}.anonymisation-key.txt`),
        filters: [{ name: "TXT", extensions: ["txt"] }],
      });
      if (k.canceled || !k.filePath) return { cancelled: true };
      args.push("--key-output", k.filePath);
    }
    const res = await withTempJson(payload, (tmp) => runEngine(randomUUID(), ["export", tmp, r.filePath!, ...args], {}, () => {}));
    return res?.type === "done" ? { ok: true, path: r.filePath } : { ok: false, error: String(res?.message ?? "The export failed.").slice(0, 300) };
  });

  // Prints the open transcript to a PDF through the print stylesheet (styles/print.css), which hides everything but the transcript.
  ipcMain.handle("print-pdf", async (e, name: unknown, large: unknown) => {
    const base = String(typeof name === "string" && name.trim() ? name : "Transcript").replace(/[\\/:*?"<>|]/g, "-");
    const r = await dialog.showSaveDialog({ defaultPath: `${base}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (r.canceled || !r.filePath) return { cancelled: true };
    const root = `document.documentElement.classList.toggle("print-large", ${large === true})`;
    try {
      await e.sender.executeJavaScript(root);
      const pdf = await e.sender.printToPDF({ pageSize: "A4", printBackground: false });
      fs.writeFileSync(r.filePath, pdf);
      return { ok: true, path: r.filePath };
    } catch (err) { return { ok: false, error: String((err as Error).message) }; }
    finally { await e.sender.executeJavaScript(`document.documentElement.classList.remove("print-large")`).catch(() => {}); }
  });

  const projectsStore = createProjectsStore(app.getPath("userData"), logLine);
  ipcMain.handle("projects-load", () => { const r = projectsStore.load(); known.remember(r.projects); return r; });
  ipcMain.handle("projects-save", (_e, data: unknown) => {
    try { projectsStore.save(data); known.remember(data); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  // Synchronous flush for beforeunload: the 400 ms debounced save would not get to run when the window closes.
  ipcMain.on("projects-save-sync", (e, data: unknown) => {
    try { projectsStore.save(data); known.remember(data); e.returnValue = true; } catch { e.returnValue = false; }
  });
  // Writes <audio name>.transcript.json beside the audio file (optional setting in the app).
  ipcMain.handle("save-sidecar", (_e, audioPath: string, data: unknown) => {
    if (!mediaFile(audioPath)) return { ok: false, error: "Unsupported or missing recording" };
    try {
      const out = path.join(path.dirname(audioPath), path.basename(audioPath, path.extname(audioPath)) + ".transcript.json");
      fs.writeFileSync(out, JSON.stringify(data, null, 2));
      return { ok: true, path: out };
    } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });

  // Deletes what the app stored for one project outside its own project list: the backup file beside the recording, and the recording itself
  // only when the app made it (inside userData/recordings). A file the user added is never touched. Returns file names only, never a path or text.
  ipcMain.handle("delete-project-files", (_e, audioPath: unknown) => {
    type R = "removed" | "none" | "failed";
    if (!knownMedia(audioPath)) return { ok: false as const, error: "Unsupported recording" };
    const dir = path.dirname(audioPath);
    const sidecar = path.join(dir, path.basename(audioPath, path.extname(audioPath)) + ".transcript.json");
    const gone = (f: string): R => { try { if (!fs.existsSync(f)) return "none"; fs.unlinkSync(f); return "removed"; } catch { return "failed"; } };
    const rel = path.relative(path.join(app.getPath("userData"), "recordings"), audioPath);
    const appMade = !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
    return { ok: true as const, backup: gone(sidecar), backupName: path.basename(sidecar), appMade, audio: appMade ? gone(audioPath) : ("kept" as const), audioName: path.basename(audioPath) };
  });

  ipcMain.handle("save-clip", async (_e, input: string, start: number, end: number) => {
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

  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
