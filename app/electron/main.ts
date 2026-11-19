import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, app, protocol, session } from "electron";
import { killAllJobs } from "./engine-client";
import { logFile, logLine, logOn, logText } from "./activityLog";
import { registerLive } from "./live";
import { createKnownPaths } from "./knownPaths";
import { isAppNavigation } from "./navGuard";
import { on, type IpcContext, type Send } from "./ipc/typed";
import { registerDiagnostics } from "./ipc/diagnostics";
import { registerEngineJobs } from "./ipc/engineJobs";
import { registerExports } from "./ipc/exports";
import { registerMediaFiles } from "./ipc/mediaFiles";
import { registerModels } from "./ipc/models";
import { registerProjects } from "./ipc/projects";

// This file is the app's lifecycle and window setup. The messages from the window are answered in electron/ipc/ (one module per area),
// typed by ipcChannels.ts, which preload.ts shares.

// Show "Cassette" as the app name (menus, About, Dock) instead of "Electron" when run from source.
// setName also moves the data folder, so keep it exactly where it was: nobody loses their projects or downloaded models.
{ const userData = app.getPath("userData"); app.setName("Cassette"); app.setPath("userData", userData); }

// The player streams recordings from media://file/<encoded path> (served below, known recordings only). Must be registered before the app is ready.
protocol.registerSchemesAsPrivileged([{ scheme: "media", privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);

const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".mp4", ".mov", ".mkv", ".webm"]);

// One running copy only: two would both rewrite projects.json and erase each other's edits. The lock is tied to the userData path, so it comes after setPath.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    openFiles(argv);
  });
  // macOS: "Open with Cassette" and dropping a file on the Dock icon arrive here, possibly before the app is ready. Must be registered at the top level.
  app.on("open-file", (e, p) => { e.preventDefault(); openFiles([p]); });
}

/** Recordings handed to the app from outside (Dock, "Open with", double-click, command line). Kept until the window's page asks for them. */
const pendingOpen: string[] = [];
let rendererReady = false;
const opened = new Set<string>();
const known = createKnownPaths();
/** Keeps only existing audio/video files, tells knownPaths they are the user's own, and sends them to the window (or holds them until it is ready). */
function openFiles(candidates: string[]) {
  const isFile = (a: string) => { try { return fs.statSync(a).isFile(); } catch { return false; } };
  const files = candidates.filter((a) => AUDIO_EXT.has(path.extname(a).toLowerCase()) && isFile(a)).map((a) => path.resolve(a));
  if (!files.length) return;
  known.add(files);
  for (const f of files) opened.add(f);
  if (win && !win.isDestroyed() && rendererReady) win.webContents.send("open-files", files); else pendingOpen.push(...files);
}


const modelsDir = () => path.join(app.getPath("userData"), "models");
const tokenFile = () => path.join(app.getPath("userData"), "hf-token.bin");
const baseEnv = () => ({ ENGINE_MODELS_DIR: modelsDir() });

let win: BrowserWindow | null = null;

function createWindow() {
  rendererReady = false;
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 720, minHeight: 600, title: "Cassette", ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 18, y: 18 } } : {}),
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


const send: Send = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload); // the window can be closed while an engine job still runs (macOS keeps the app alive)
  const e = payload as { type?: string; level?: string; message?: string; stage?: string };
  if (channel === "engine-event" && (e.type === "log" || e.type === "error") && logOn()) {
    try { fs.appendFileSync(logFile(), `${new Date().toISOString()} [${e.level ?? e.type}] ${logText(String(e.message))}\n`); } catch { /* best effort */ }
  }
};

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
  openFiles(process.argv.slice(app.isPackaged ? 1 : 2)); // a file the app was launched with (Windows, Linux)
  on("open-files-ready", () => { rendererReady = true; if (pendingOpen.length && win && !win.isDestroyed()) win.webContents.send("open-files", pendingOpen.splice(0)); });
  registerLive(send, baseEnv, known);
  /** A recording path from the renderer must be a string, an audio/video extension and an existing regular file. */
  const mediaFile = (p: unknown): p is string => {
    if (typeof p !== "string" || !AUDIO_EXT.has(path.extname(p).toLowerCase())) return false;
    try { return fs.statSync(p).isFile(); } catch { return false; }
  };
  /** A recording the app knows about (see knownPaths.ts): the window may only read, reveal or delete those. */
  const knownMedia = (p: unknown): p is string => mediaFile(p) && known.has(p);
  const ctx: IpcContext = { send, known, opened, baseEnv, modelsDir, tokenFile, mediaFile, knownMedia };
  registerDiagnostics(ctx);
  registerMediaFiles(ctx); // includes protocol.handle("media"), which must be in place before the window is created
  registerEngineJobs(ctx);
  registerModels(ctx);
  registerExports(ctx);
  registerProjects(ctx);

  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("before-quit", killAllJobs);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
