/** Diagnostics and small system queries: the activity log switches, the support bundle, where things are stored, "Show in folder" for app folders, the one external link the app may open. */
import fs from "node:fs";
import os from "node:os";
import { app, dialog, powerMonitor, shell } from "electron";
import { logFile, logHideFile, logHides, logLine, logOffFile, logOn } from "../activityLog";
import { dataLocations } from "../dataLocations";
import { REVEAL_TARGETS } from "../validate";
import { buildBundle, bundleRequest } from "../supportBundle";
import { zipStore } from "../zipStore";
import { handle, on, type IpcContext } from "./typed";

export function registerDiagnostics({ modelsDir, tokenFile, watch }: IpcContext) {
  on("renderer-error", (_e, message: unknown) => logLine("renderer", String(message).slice(0, 4000)));
  // Whether the computer is running on battery (the start sheet warns before a long job).
  handle("power-state", () => { try { return { onBattery: powerMonitor.isOnBatteryPower() }; } catch { return { onBattery: false }; } });
  handle("disk-free", () => {
    try { fs.mkdirSync(modelsDir(), { recursive: true }); const st = fs.statfsSync(modelsDir()); return st.bavail * st.bsize; } catch { return null; }
  });
  handle("reveal", (_e, what: unknown) => {
    if (typeof what !== "string" || !REVEAL_TARGETS.has(what)) return;
    if (what === "models") { fs.mkdirSync(modelsDir(), { recursive: true }); return shell.openPath(modelsDir()); }
    if (what === "data") return shell.openPath(app.getPath("userData"));
    if (what === "recordings" || what === "peaks" || what === "tmp") { const d = dataLocations(app.getPath("userData"))[what]; fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); }
    if (!fs.existsSync(logFile())) fs.writeFileSync(logFile(), "");
    shell.showItemInFolder(logFile());
  });
  // Activity log controls: is it on, how big is it, switch it, empty it. Nothing here reads the log's text.
  handle("net-activity", () => watch.snapshot());
  handle("log-state", () => { let bytes = 0; try { bytes = fs.statSync(logFile()).size; } catch { /* no log yet */ } return { on: logOn(), bytes, hideNames: logHides() }; });
  handle("log-set", (_e, on: unknown) => {
    try { if (on) fs.rmSync(logOffFile(), { force: true }); else fs.writeFileSync(logOffFile(), ""); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  handle("log-hide-names", (_e, hide: unknown) => {
    try { if (hide) fs.writeFileSync(logHideFile(), ""); else fs.rmSync(logHideFile(), { force: true }); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  handle("log-clear", () => { try { fs.writeFileSync(logFile(), ""); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; } });
  // Diagnostics bundle: built here from an allowlist (supportBundle.ts), never from the window's own text. "preview" returns what would be saved; "save" writes it
  // as a zip to the place the person picks. Nothing is uploaded.
  const bundleFiles = (req: unknown) => {
    const r = bundleRequest(req);
    if (!r) return null;
    let free: number | null = null;
    try { const st = fs.statfsSync(app.getPath("userData")); free = st.bavail * st.bsize; } catch { /* unknown */ }
    let log: string | null = null;
    if (r.includeLog) { try { log = fs.readFileSync(logFile(), "utf-8"); } catch { log = ""; } }
    let user = ""; try { user = os.userInfo().username; } catch { /* unknown */ }
    return buildBundle({
      appVersion: app.getVersion(), electron: process.versions.electron,
      os: { platform: process.platform, arch: process.arch, release: os.release(), chip: os.cpus()[0]?.model ?? "", cores: os.cpus().length, memGB: Math.round(os.totalmem() / 2 ** 30) },
      freeBytes: free, model: r.model, downloaded: r.downloaded, diarization: r.diarization, checks: r.checks, log, scrub: { home: os.homedir(), user },
    });
  };
  handle("bundle-preview", (_e, req: unknown) => bundleFiles(req)?.map((f) => ({ name: f.name, text: f.text, bytes: Buffer.byteLength(f.text) })) ?? null);
  handle("bundle-save", async (_e, req: unknown) => {
    const files = bundleFiles(req);
    if (!files) return { ok: false, error: "Unsupported request." };
    const r = await dialog.showSaveDialog({ defaultPath: "cassette-diagnostics.zip", filters: [{ name: "ZIP", extensions: ["zip"] }] });
    if (r.canceled || !r.filePath) return { cancelled: true };
    try { fs.writeFileSync(r.filePath, zipStore(files.map((f) => ({ name: f.name, data: Buffer.from(f.text, "utf-8") })))); return { ok: true, path: r.filePath }; }
    catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  handle("paths", () => ({
    models: modelsDir(), log: logFile(), token: tokenFile(), data: app.getPath("userData"),
    ...(({ projects, recordings, peaks, tmp }) => ({ projects, recordings, peaks, tmp }))(dataLocations(app.getPath("userData"))),
    system: { platform: process.platform, arch: process.arch, chip: os.cpus()[0]?.model ?? "", cores: os.cpus().length, memGB: Math.round(os.totalmem() / 2 ** 30) },
  }));

  handle("open-external", async (_e, url: string) => {
    const feedback = "https://github.com/ingridstevens/cassette/issues/new"; // the one GitHub page the app may open: the new-issue form, filled in by the user in their browser
    const releases = "https://github.com/ingridstevens/cassette/releases"; // the Releases page, opened from About: exactly this address, nothing under it
    if (typeof url !== "string" || !(url.startsWith("https://huggingface.co/") || url === feedback || url.startsWith(feedback + "?") || url === releases)) return false;
    watch.link(url);
    await shell.openExternal(url);
    return true;
  });
}
