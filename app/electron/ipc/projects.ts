/** The saved project list, the lines of interrupted runs, the optional backup file beside a recording, and deleting what the app stored for one project. */
import fs from "node:fs";
import path from "node:path";
import { app, dialog } from "electron";
import { logLine } from "../activityLog";
import { dataLocations } from "../dataLocations";
import { BackupError, restoreBackup, writeBackup } from "../projectArchive";
import { createProjectsStore } from "../projectsStore";
import { safeName } from "../validate";
import { createPartialStore, validPartialId, type PartialInfo } from "../partialStore";
import { handle, onSync, type IpcContext } from "./typed";

export function registerProjects({ known, opened, mediaFile, knownMedia }: IpcContext) {
  const projectsStore = createProjectsStore(app.getPath("userData"), logLine);
  // Lines written so far by a run that did not finish (see partialStore.ts). The window only passes project ids and text; the folder is fixed.
  const partials = createPartialStore(dataLocations(app.getPath("userData")).partials);
  handle("partial-save", (_e, id: unknown, d: Record<string, unknown>) => { try { return validPartialId(id) && mediaFile(d?.audio) && partials.save(id, d as never); } catch { return false; } });
  onSync("partial-save-sync", (e, id: unknown, d: Record<string, unknown>) => { try { e.returnValue = validPartialId(id) && mediaFile(d?.audio) && partials.save(id, d as never); } catch { e.returnValue = false; } });
  handle("partial-drop", (_e, id: unknown) => { try { if (validPartialId(id)) partials.remove(id); } catch { /* nothing to remove */ } });
  /** Called once with the ids of the projects that have no finished transcript: returns what was saved for them and deletes every other file. */
  handle("partial-load", (_e, ids: unknown) => {
    const list = Array.isArray(ids) ? ids.filter(validPartialId) : [];
    try { partials.prune(list); } catch { /* best effort */ }
    const out: Record<string, PartialInfo> = {};
    for (const id of list) { try { const r = partials.load(id); if (r) out[id] = r; } catch { /* skip */ } }
    return out;
  });
  handle("projects-load", () => { const r = projectsStore.load(); known.remember(r.projects); known.add([...opened]); return r; });
  handle("projects-save", (_e, data: unknown) => {
    try { projectsStore.save(data); known.remember(data); return { ok: true }; } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });
  // Synchronous flush for beforeunload: the 400 ms debounced save would not get to run when the window closes.
  onSync("projects-save-sync", (e, data: unknown) => {
    try { projectsStore.save(data); known.remember(data); e.returnValue = true; } catch { e.returnValue = false; }
  });
  // Writes <audio name>.transcript.json beside the audio file (optional setting in the app).
  handle("save-sidecar", (_e, audioPath: string, data: unknown) => {
    if (!mediaFile(audioPath)) return { ok: false, error: "Unsupported or missing recording" };
    try {
      const out = path.join(path.dirname(audioPath), path.basename(audioPath, path.extname(audioPath)) + ".transcript.json");
      fs.writeFileSync(out, JSON.stringify(data, null, 2));
      return { ok: true, path: out };
    } catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });

  // Deletes what the app stored for one project outside its own project list: the backup file beside the recording, and the recording itself
  // only when the app made it (inside userData/recordings). A file the user added is never touched. Returns file names only, never a path or text.
  handle("delete-project-files", (_e, audioPath: unknown) => {
    type R = "removed" | "none" | "failed";
    if (!knownMedia(audioPath)) return { ok: false as const, error: "Unsupported recording" };
    const dir = path.dirname(audioPath);
    const sidecar = path.join(dir, path.basename(audioPath, path.extname(audioPath)) + ".transcript.json");
    const gone = (f: string): R => { try { if (!fs.existsSync(f)) return "none"; fs.unlinkSync(f); return "removed"; } catch { return "failed"; } };
    const rel = path.relative(path.join(app.getPath("userData"), "recordings"), audioPath);
    const appMade = !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
    return { ok: true as const, backup: gone(sidecar), backupName: path.basename(sidecar), appMade, audio: appMade ? gone(audioPath) : ("kept" as const), audioName: path.basename(audioPath) };
  });

  // Back up one project to a single file (see projectArchive.ts). The window sends the project as it is on screen; the recording is found by its path, which must be a known recording.
  const failure = (e: unknown) => ({ ok: false as const, code: e instanceof BackupError ? e.code : ("failed" as const) });
  handle("backup-project", async (_e, project: unknown) => {
    const p = project as { name?: unknown; path?: unknown; appended?: unknown } | null;
    if (!p || typeof p !== "object" || Array.isArray(p)) return { ok: false as const, code: "failed" as const };
    if (!knownMedia(p.path)) return { ok: false as const, code: "missing-source" as const };
    // the recordings added after the first: every one must be a recording the app knows, like the first
    const parts: { id: string; path: string }[] = [];
    for (const a of Array.isArray(p.appended) ? p.appended : []) {
      const x = a as { id?: unknown; path?: unknown } | null;
      if (!x || typeof x.id !== "string" || !knownMedia(x.path)) return { ok: false as const, code: "missing-source" as const };
      parts.push({ id: x.id, path: x.path });
    }
    const r = await dialog.showSaveDialog({ defaultPath: `${safeName(p.name, "Project")}.cassette-backup`, filters: [{ name: "Cassette project backup", extensions: ["cassette-backup"] }] });
    if (r.canceled || !r.filePath) return { ok: false as const, cancelled: true };
    const dest = r.filePath.toLowerCase().endsWith(".cassette-backup") ? r.filePath : `${r.filePath}.cassette-backup`;
    try {
      const w = await writeBackup({ dest, project: project as Record<string, unknown>, mediaPath: p.path, parts, app: app.getVersion() });
      return { ok: true as const, path: dest, bytes: w.bytes };
    } catch (e) { logLine("error", `Backup failed: ${e instanceof BackupError ? e.code : "unexpected"}`); return failure(e); }
  });
  // Restore a backup as a new project: the recording goes into userData/recordings under a name nobody uses, after the whole file has been checked.
  handle("restore-project", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Cassette project backup", extensions: ["cassette-backup"] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false as const, cancelled: true };
    try {
      const got = await restoreBackup({ archive: r.filePaths[0], mediaDir: dataLocations(app.getPath("userData")).recordings });
      known.add(Object.values(got.mediaPaths));
      return { ok: true as const, project: got.project, mediaPath: got.mediaPath, bytes: got.bytes };
    } catch (e) { logLine("error", `Restore failed: ${e instanceof BackupError ? e.code : "unexpected"}`); return failure(e); }
  });
}
