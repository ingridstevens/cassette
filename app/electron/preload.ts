import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { NetActivity } from "./netWatch";
import type { UpdateState } from "./updateLogic";
import type { CleanupLevels, IpcEvents, IpcInvoke, IpcSend, IpcSendSync } from "./ipcChannels";

// Every call goes through these three, so the channel name, the arguments and the result are checked against ipcChannels.ts (the same types main.ts registers with).
const invoke = <C extends keyof IpcInvoke>(channel: C, ...args: IpcInvoke[C]["args"]): Promise<IpcInvoke[C]["ret"]> => ipcRenderer.invoke(channel, ...args);
const send = <C extends keyof IpcSend>(channel: C, ...args: IpcSend[C]): void => { ipcRenderer.send(channel, ...args); };
const sendSync = <C extends keyof IpcSendSync>(channel: C, ...args: IpcSendSync[C]["args"]): IpcSendSync[C]["ret"] => ipcRenderer.sendSync(channel, ...args);
const listen = <C extends keyof IpcEvents>(channel: C, cb: (payload: IpcEvents[C]) => void) => {
  const h = (_: unknown, payload: IpcEvents[C]) => cb(payload);
  ipcRenderer.on(channel, h);
  return () => { ipcRenderer.removeListener(channel, h); };
};

const api = {
  pickFiles: (): Promise<string[]> => invoke("pick-file"),
  loadProjects: (): Promise<{ projects: unknown[]; recoveredFrom?: string; recoveredAt?: number; corruptCopy?: string }> => invoke("projects-load"),
  saveProjects: (data: unknown): Promise<{ ok: boolean; error?: string }> => invoke("projects-save", data),
  /** Blocks until the file is written: used when the window closes, where an async save would be lost. */
  saveProjectsSync: (data: unknown): boolean => sendSync("projects-save-sync", data),
  /** Keep the lines a run has written so far (atomic file in the data folder). false when nothing was saved. */
  savePartial: (id: string, d: { lines: unknown[]; audio: string; model: string; language: string }): Promise<boolean> => invoke("partial-save", id, d),
  /** Same, but waits for the file: used when the window closes. */
  savePartialSync: (id: string, d: { lines: unknown[]; audio: string; model: string; language: string }): boolean => sendSync("partial-save-sync", id, d),
  dropPartial: (id: string): Promise<void> => invoke("partial-drop", id),
  /** What interrupted runs left for these projects (and delete everything else). */
  loadPartials: (ids: string[]): Promise<Record<string, { lines: { start: number; end: number; speaker: string; text: string; lang?: string }[]; savedAt: number; model: string; language: string; audioChanged: boolean }>> => invoke("partial-load", ids),
  saveSidecar: (audioPath: string, data: unknown): Promise<{ ok: boolean; path?: string; error?: string }> => invoke("save-sidecar", audioPath, data),
  /** The waveform (8000 values, 0 to 1) and length in seconds of a recording, or null when the file is gone. */
  /** Loudness figures for the first minute and a half of a recording, before and after an audio cleanup (works on temporary copies; the file is never changed). */
  cleanupEstimate: (path: string, mode: string): Promise<{ ok: true; before: CleanupLevels; after: CleanupLevels; seconds: number } | { ok: false; error: string }> => invoke("cleanup-estimate", path, mode),
  peaks: (path: string): Promise<{ peaks: number[]; duration: number } | null> => invoke("peaks", path),
  /** Where the player streams a recording from (served by the main process, known recordings only). */
  mediaUrl: (path: string): string => `media://file/${encodeURIComponent(path)}`,
  transcribe: (opts: Record<string, unknown>): Promise<string> => invoke("transcribe", opts),
  liveStart: (o: Record<string, unknown>): Promise<{ ok: boolean; jobId?: string; error?: string }> => invoke("live-start", o),
  liveAudio: (jobId: string, pcm: Uint8Array): void => { send("live-audio", jobId, pcm); },
  /** Turns recordings left behind by a crash into WAV files and returns their paths. */
  liveRecover: (): Promise<string[]> => invoke("live-recover"),
  liveStop: (jobId: string): Promise<{ ok: boolean; path?: string; seconds?: number; name?: string; error?: string }> => invoke("live-stop", jobId),
  cancel: (jobId: string) => invoke("cancel", jobId),
  powerState: (): Promise<{ onBattery: boolean }> => invoke("power-state"),
  importModels: () => invoke("import-models"),
  models: (action: "status" | "download" | "delete" | "check" | "verify" | "repair", name?: string) => invoke("models", action, name),
  cancelModels: (): Promise<boolean> => invoke("cancel-models"),
  tokenSecure: (): Promise<boolean> => invoke("tokenSecure"),
  token: (value?: string): Promise<string> => invoke("token", value),
  exportTranscript: (payload: unknown, format: string, name: string): Promise<{ ok?: boolean; cancelled?: boolean; path?: string; error?: string }> => invoke("export", { ...(payload as object), lang: document.documentElement.lang || "en" }, format, name),
  exportEpisode: (payload: unknown, input: string, name: string): Promise<IpcInvoke["export-episode"]["ret"]> => invoke("export-episode", { ...(payload as object), lang: document.documentElement.lang || "en" }, input, name),
  retryEpisode: (payload: unknown, input: string, name: string): Promise<IpcInvoke["export-episode"]["ret"]> => invoke("retry-episode", { ...(payload as object), lang: document.documentElement.lang || "en" }, input, name),
  showEpisodeFolder: (): Promise<void> => invoke("show-episode-folder"),
  exportText: (payload: unknown): Promise<{ ok?: boolean; text?: string; error?: string }> => invoke("export-text", { ...(payload as object), lang: document.documentElement.lang || "en" }),
  printPdf: (name: string, large: boolean): Promise<{ ok?: boolean; cancelled?: boolean; path?: string; error?: string }> => invoke("print-pdf", name, large),
  translateLine: (p: { input: string; start: number; end: number; model: string; language: string; backend?: string }): Promise<{ ok: boolean; text?: string; error?: string }> => invoke("translate-line", p),
  runLlm: (kind: "highlights" | "summarize" | "ask", payload: unknown, o: { jobId: string; clientId: string; model: string; count?: number }): Promise<{ type: string; message?: string; cancelled?: boolean; highlights?: unknown[]; summary?: unknown; answer?: unknown } | null> => invoke("llm-run", kind, payload, o),
  exportClips: (input: string, clips: { start: number; end: number; speaker?: string }[], format: string, name: string): Promise<{ ok?: boolean; cancelled?: boolean; count?: number; path?: string; error?: string }> => invoke("export-clips", input, clips, format, name),
  /** What network use the app itself has started since it opened (its own window's requests, model downloads it asked for, pages it opened in the browser). */
  netActivity: (): Promise<NetActivity> => invoke("net-activity"),
  /** The optional update notice: whether it is on, when it last looked, and a newer version if there is one. Off unless the person turns it on. */
  updateState: (): Promise<UpdateState> => invoke("update-state"),
  setUpdateCheck: (on: boolean): Promise<UpdateState> => invoke("update-set", on),
  logState: (): Promise<{ on: boolean; bytes: number; hideNames: boolean }> => invoke("log-state"),
  setLog: (on: boolean): Promise<{ ok: boolean; error?: string }> => invoke("log-set", on),
  hideLogNames: (hide: boolean): Promise<{ ok: boolean; error?: string }> => invoke("log-hide-names", hide),
  clearLog: (): Promise<{ ok: boolean; error?: string }> => invoke("log-clear"),
  deleteProjectFiles: (audioPath: string): Promise<{ ok: true; backup: "removed" | "none" | "failed"; backupName: string; appMade: boolean; audio: "removed" | "none" | "failed" | "kept"; audioName: string } | { ok: false; error: string }> => invoke("delete-project-files", audioPath),
  /** Saves one project (transcript, speakers, checked quotes and its recording) as a single backup file the person chooses. */
  backupProject: (project: unknown): Promise<{ ok: true; path: string; bytes: number } | { ok: false; cancelled?: boolean; code?: string }> => invoke("backup-project", project),
  /** Asks for a backup file and restores it into the app's recordings folder; the window adds the project it returns. */
  restoreProject: (): Promise<{ ok: true; project: Record<string, unknown>; mediaPath: string; bytes: number } | { ok: false; cancelled?: boolean; code?: string }> => invoke("restore-project"),
  saveClip: (input: string, start: number, end: number): Promise<string | null> => invoke("save-clip", input, start, end),
  reveal: (what: "models" | "log" | "data" | "recordings" | "peaks" | "tmp"): Promise<void> => invoke("reveal", what),
  bundlePreview: (req: { model: string; downloaded: string[]; diarization: boolean; checks: { id: string; level: string }[]; includeLog: boolean }): Promise<{ name: string; text: string; bytes: number }[] | null> => invoke("bundle-preview", req),
  bundleSave: (req: { model: string; downloaded: string[]; diarization: boolean; checks: { id: string; level: string }[]; includeLog: boolean }): Promise<{ ok?: boolean; cancelled?: boolean; path?: string; error?: string }> => invoke("bundle-save", req),
  /** Size in bytes of each place the app keeps data (null when it does not exist yet). Reads sizes only, never contents. */
  storageSizes: (): Promise<Record<"data" | "projects" | "recordings" | "peaks" | "partials" | "tmp" | "models" | "log", number | null>> => invoke("storage-sizes"),
  /** Saves a one-page evidence summary (Markdown) where the person chooses: versions, places, sizes, network hosts. No audio, no transcript text. */
  saveEvidence: (): Promise<{ ok?: boolean; cancelled?: boolean; path?: string; error?: string }> => invoke("evidence-save"),
  paths: (): Promise<{ models: string; log: string; token: string; data: string; projects: string; recordings: string; peaks: string; tmp: string; system: { platform: string; arch: string; chip: string; cores: number; memGB: number } }> => invoke("paths"),
  saveImage: (dataUrl: string, defaultName: string): Promise<{ ok?: boolean; cancelled?: boolean; path?: string; error?: string }> => invoke("save-image", dataUrl, defaultName),
  revealPath: (p: string): Promise<void> => invoke("reveal-path", p),
  fileSize: (p: string): Promise<number | null> => invoke("file-size", p),
  /** The identity of a known recording (size and sampled checksum), or null when it is gone. */
  fingerprintFile: (p: string): Promise<{ size: number; sample: string } | null> => invoke("fingerprint-file", p),
  /** Asks the person to choose the moved recording; it becomes a known recording and comes back with its identity. Nothing is changed by this call. */
  locateRecording: (): Promise<{ ok: true; path: string; name: string; source: { size: number; sample: string } } | { ok: false; cancelled?: boolean }> => invoke("locate-recording"),
  diskFree: (): Promise<number | null> => invoke("disk-free"),
  openExternal: (url: string): Promise<boolean> => invoke("open-external", url),
  logError: (message: string): void => { send("renderer-error", message); },
  /** Copies the bundled sample interview into the app's recordings folder and returns its path. */
  sample: (): Promise<{ ok: true; path: string } | { ok: false; error: string }> => invoke("sample"),
  registerPaths: (paths: string[]): Promise<void> => invoke("register-paths", paths),
  pathForFile: (f: File): string => webUtils.getPathForFile(f),
  /** Recordings opened from the Dock, Finder or Explorer. Tells the main process this window is listening, so files that arrived earlier are delivered now. */
  onOpenFiles: (cb: (paths: string[]) => void) => {
    const off = listen("open-files", cb);
    send("open-files-ready");
    return off;
  },
  onEvent: (cb: (e: any) => void) => listen("engine-event", cb),
};
contextBridge.exposeInMainWorld("api", api);
export type Api = typeof api;
