import { contextBridge, ipcRenderer, webUtils } from "electron";

const api = {
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke("pick-file"),
  loadProjects: (): Promise<{ projects: unknown[]; recoveredFrom?: string; recoveredAt?: number; corruptCopy?: string }> => ipcRenderer.invoke("projects-load"),
  saveProjects: (data: unknown): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("projects-save", data),
  /** Blocks until the file is written: used when the window closes, where an async save would be lost. */
  saveProjectsSync: (data: unknown): boolean => ipcRenderer.sendSync("projects-save-sync", data),
  saveSidecar: (audioPath: string, data: unknown): Promise<{ ok: boolean; path?: string; error?: string }> => ipcRenderer.invoke("save-sidecar", audioPath, data),
  readAudio: (path: string): Promise<Uint8Array | null> => ipcRenderer.invoke("read-audio", path),
  transcribe: (opts: Record<string, unknown>): Promise<string> => ipcRenderer.invoke("transcribe", opts),
  liveStart: (o: Record<string, unknown>): Promise<{ ok: boolean; jobId?: string; error?: string }> => ipcRenderer.invoke("live-start", o),
  liveAudio: (jobId: string, pcm: Uint8Array): void => { ipcRenderer.send("live-audio", jobId, pcm); },
  /** Turns recordings left behind by a crash into WAV files and returns their paths. */
  liveRecover: (): Promise<string[]> => ipcRenderer.invoke("live-recover"),
  liveStop: (jobId: string): Promise<{ ok: boolean; path?: string; seconds?: number; name?: string; error?: string }> => ipcRenderer.invoke("live-stop", jobId),
  cancel: (jobId: string) => ipcRenderer.invoke("cancel", jobId),
  powerState: (): Promise<{ onBattery: boolean }> => ipcRenderer.invoke("power-state"),
  importModels: () => ipcRenderer.invoke("import-models"),
  models: (action: "status" | "download" | "delete" | "check", name?: string) => ipcRenderer.invoke("models", action, name),
  cancelModels: (): Promise<boolean> => ipcRenderer.invoke("cancel-models"),
  tokenSecure: (): Promise<boolean> => ipcRenderer.invoke("tokenSecure"),
  token: (value?: string): Promise<string> => ipcRenderer.invoke("token", value),
  exportTranscript: (payload: unknown, format: string, name: string): Promise<{ ok?: boolean; cancelled?: boolean; path?: string; error?: string }> => ipcRenderer.invoke("export", { ...(payload as object), lang: document.documentElement.lang || "en" }, format, name),
  translateLine: (p: { input: string; start: number; end: number; model: string; language: string; backend?: string }): Promise<{ ok: boolean; text?: string; error?: string }> => ipcRenderer.invoke("translate-line", p),
  runLlm: (kind: "highlights" | "summarize" | "ask", payload: unknown, o: { jobId: string; clientId: string; model: string; count?: number }): Promise<{ type: string; message?: string; cancelled?: boolean; highlights?: unknown[]; summary?: unknown; answer?: unknown } | null> => ipcRenderer.invoke("llm-run", kind, payload, o),
  exportClips: (input: string, clips: { start: number; end: number; speaker?: string }[], format: string, name: string): Promise<{ ok?: boolean; cancelled?: boolean; count?: number; path?: string; error?: string }> => ipcRenderer.invoke("export-clips", input, clips, format, name),
  logState: (): Promise<{ on: boolean; bytes: number; hideNames: boolean }> => ipcRenderer.invoke("log-state"),
  setLog: (on: boolean): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("log-set", on),
  hideLogNames: (hide: boolean): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("log-hide-names", hide),
  clearLog: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("log-clear"),
  deleteProjectFiles: (audioPath: string): Promise<{ ok: true; backup: "removed" | "none" | "failed"; backupName: string; appMade: boolean; audio: "removed" | "none" | "failed" | "kept"; audioName: string } | { ok: false; error: string }> => ipcRenderer.invoke("delete-project-files", audioPath),
  saveClip: (input: string, start: number, end: number): Promise<string | null> => ipcRenderer.invoke("save-clip", input, start, end),
  reveal: (what: "models" | "log" | "data"): Promise<void> => ipcRenderer.invoke("reveal", what),
  paths: (): Promise<{ models: string; log: string; token: string; data: string; system: { platform: string; arch: string; chip: string; cores: number; memGB: number } }> => ipcRenderer.invoke("paths"),
  saveImage: (dataUrl: string, defaultName: string): Promise<{ ok?: boolean; cancelled?: boolean; path?: string; error?: string }> => ipcRenderer.invoke("save-image", dataUrl, defaultName),
  revealPath: (p: string): Promise<void> => ipcRenderer.invoke("reveal-path", p),
  fileSize: (p: string): Promise<number | null> => ipcRenderer.invoke("file-size", p),
  diskFree: (): Promise<number | null> => ipcRenderer.invoke("disk-free"),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("open-external", url),
  logError: (message: string): void => { ipcRenderer.send("renderer-error", message); },
  pathForFile: (f: File): string => webUtils.getPathForFile(f),
  onEvent: (cb: (e: any) => void) => {
    const h = (_: unknown, e: any) => cb(e);
    ipcRenderer.on("engine-event", h);
    return () => { ipcRenderer.removeListener("engine-event", h); };
  },
};
contextBridge.exposeInMainWorld("api", api);
export type Api = typeof api;
