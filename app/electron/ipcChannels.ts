/**
 * Every message between the window (preload.ts) and the main process, in one place. Types only: nothing here runs.
 * main.ts and the handler modules in electron/ipc/ register against these types, and preload.ts calls through them,
 * so the compiler checks both sides of every channel (name, argument order, return value).
 * The types describe what the window SENDS and gets back; the handlers still check every value at run time (validate.ts, knownPaths.ts).
 */
import type { NetActivity } from "./netWatch";
import type { UpdateState } from "./updateLogic";
import type { PartialInfo } from "./partialStore";
import type { BackupErrorCode } from "./projectArchive";
import type { ProjectsLoad } from "./projectsStore";
import type { SourceId } from "./sourceId";

/** Rough loudness figures of a stretch of sound, in dB relative to full scale: the level of the louder parts (speech) and of the quieter parts (background). */
export type CleanupLevels = { speech_db: number; noise_floor_db: number; gap_db: number };

type Result = { ok?: boolean; cancelled?: boolean; path?: string; error?: string };
type BundleRequest = { model: string; downloaded: string[]; diarization: boolean; checks: { id: string; level: string }[]; includeLog: boolean };
type Clip = { start: number; end: number; speaker?: string };
/** What the window sends to keep an interrupted run (the lines are checked by partialStore.ts, not trusted). */
type PartialDraft = { lines: unknown[]; audio: string; model: string; language: string };
/** The outcome of "backup-project" and "restore-project": a failure carries a code the window turns into words, never a path or text from the file. */
type Fail = { ok: false; cancelled?: boolean; code?: BackupErrorCode };
type Ch<A extends unknown[], R> = { args: A; ret: R };

/** window.invoke(channel, ...args) answered by ipcMain.handle. */
export interface IpcInvoke {
  "pick-file": Ch<[], string[]>;
  "projects-load": Ch<[], ProjectsLoad>;
  "projects-save": Ch<[data: unknown], { ok: boolean; error?: string }>;
  "partial-save": Ch<[id: string, d: PartialDraft], boolean>;
  "partial-drop": Ch<[id: string], void>;
  "partial-load": Ch<[ids: string[]], Record<string, PartialInfo>>;
  "save-sidecar": Ch<[audioPath: string, data: unknown], { ok: boolean; path?: string; error?: string }>;
  "peaks": Ch<[path: string], { peaks: number[]; duration: number } | null>;
  "cleanup-estimate": Ch<[path: string, mode: string], { ok: true; before: CleanupLevels; after: CleanupLevels; seconds: number } | { ok: false; error: string }>;
  "transcribe": Ch<[opts: Record<string, unknown>], string>;
  "live-start": Ch<[o: Record<string, unknown>], { ok: boolean; jobId?: string; error?: string }>;
  "live-recover": Ch<[], string[]>;
  "live-stop": Ch<[jobId: string], { ok: boolean; path?: string; seconds?: number; name?: string; error?: string }>;
  "cancel": Ch<[jobId: string], any>;
  "power-state": Ch<[], { onBattery: boolean }>;
  "import-models": Ch<[], any>;
  "models": Ch<[action: "status" | "download" | "delete" | "check" | "verify" | "repair", name?: string], any>;
  "cancel-models": Ch<[], boolean>;
  "tokenSecure": Ch<[], boolean>;
  "token": Ch<[value?: string], string>;
  "export": Ch<[payload: unknown, format: string, name: string], Result>;
  "export-episode": Ch<[payload: unknown, input: string, name: string], Result & { chapters?: boolean; clips?: number; clipsSkipped?: boolean }>;
  "show-episode-folder": Ch<[], void>;
  "export-text": Ch<[payload: unknown], { ok?: boolean; text?: string; error?: string }>;
  "print-pdf": Ch<[name: string, large: boolean], Result>;
  "translate-line": Ch<[p: { input: string; start: number; end: number; model: string; language: string; backend?: string }], { ok: boolean; text?: string; error?: string }>;
  "llm-run": Ch<[kind: "highlights" | "summarize" | "ask", payload: unknown, o: { jobId: string; clientId: string; model: string; count?: number }], { type: string; message?: string; cancelled?: boolean; highlights?: unknown[]; summary?: unknown; answer?: unknown } | null>;
  "export-clips": Ch<[input: string, clips: Clip[], format: string, name: string], Result & { count?: number }>;
  "net-activity": Ch<[], NetActivity>;
  "update-state": Ch<[], UpdateState>;
  "update-set": Ch<[on: boolean], UpdateState>;
  "log-state": Ch<[], { on: boolean; bytes: number; hideNames: boolean }>;
  "log-set": Ch<[on: boolean], { ok: boolean; error?: string }>;
  "log-hide-names": Ch<[hide: boolean], { ok: boolean; error?: string }>;
  "log-clear": Ch<[], { ok: boolean; error?: string }>;
  "delete-project-files": Ch<[audioPath: string], { ok: true; backup: "removed" | "none" | "failed"; backupName: string; appMade: boolean; audio: "removed" | "none" | "failed" | "kept"; audioName: string } | { ok: false; error: string }>;
  "backup-project": Ch<[project: unknown], { ok: true; path: string; bytes: number } | Fail>;
  "restore-project": Ch<[], { ok: true; project: Record<string, unknown>; mediaPath: string; bytes: number } | Fail>;
  "save-clip": Ch<[input: string, start: number, end: number], string | null>;
  "reveal": Ch<[what: "models" | "log" | "data" | "recordings" | "peaks" | "tmp"], void>;
  "bundle-preview": Ch<[req: BundleRequest], { name: string; text: string; bytes: number }[] | null>;
  "bundle-save": Ch<[req: BundleRequest], Result>;
  "storage-sizes": Ch<[], Record<"data" | "projects" | "recordings" | "peaks" | "partials" | "tmp" | "models" | "log", number | null>>;
  "evidence-save": Ch<[], Result>;
  "paths": Ch<[], { models: string; log: string; token: string; data: string; projects: string; recordings: string; peaks: string; tmp: string; system: { platform: string; arch: string; chip: string; cores: number; memGB: number } }>;
  "save-image": Ch<[dataUrl: string, defaultName: string], Result>;
  "reveal-path": Ch<[p: string], void>;
  "file-size": Ch<[p: string], number | null>;
  "fingerprint-file": Ch<[p: string], SourceId | null>;
  "locate-recording": Ch<[], { ok: true; path: string; name: string; source: SourceId } | { ok: false; cancelled?: boolean }>;
  "disk-free": Ch<[], number | null>;
  "open-external": Ch<[url: string], boolean>;
  "sample": Ch<[], { ok: true; path: string } | { ok: false; error: string }>;
  "register-paths": Ch<[paths: string[]], void>;
}

/** window.send(channel, ...args) answered by ipcMain.on, no reply. */
export interface IpcSend {
  "live-audio": [jobId: string, pcm: Uint8Array];
  "renderer-error": [message: string];
  "open-files-ready": [];
}

/** window.sendSync(channel, ...args) answered by ipcMain.on, which sets event.returnValue. */
export interface IpcSendSync {
  "projects-save-sync": Ch<[data: unknown], boolean>;
  "partial-save-sync": Ch<[id: string, d: PartialDraft], boolean>;
}

/** Main to window, through webContents.send. */
export interface IpcEvents {
  "engine-event": any;
  "open-files": string[];
}
