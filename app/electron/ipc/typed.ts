/** Thin typed wrappers over ipcMain: the same registration as before, but the channel name, the handler's arguments and its return value are checked against ipcChannels.ts. */
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import type { IpcEvents, IpcInvoke, IpcSend, IpcSendSync } from "../ipcChannels";
import type { KnownPaths } from "../knownPaths";

/** A handler may return nothing useful for a `void` channel (the window ignores it), and otherwise the declared type, plain or in a promise. */
type Reply<R> = [R] extends [void] ? unknown : R | Promise<R>;

export function handle<C extends keyof IpcInvoke>(channel: C, fn: (e: IpcMainInvokeEvent, ...args: IpcInvoke[C]["args"]) => Reply<IpcInvoke[C]["ret"]>): void {
  ipcMain.handle(channel, fn as (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown);
}
export function on<C extends keyof IpcSend>(channel: C, fn: (e: IpcMainEvent, ...args: IpcSend[C]) => void): void {
  ipcMain.on(channel, fn as (e: IpcMainEvent, ...args: unknown[]) => void);
}
/** For `sendSync` from the window: the handler must set `e.returnValue`. */
export function onSync<C extends keyof IpcSendSync>(channel: C, fn: (e: IpcMainEvent, ...args: IpcSendSync[C]["args"]) => void): void {
  ipcMain.on(channel, fn as (e: IpcMainEvent, ...args: unknown[]) => void);
}

/** Sends to the window (and logs engine messages when the activity log is on): see `send` in main.ts. */
export type Send = <C extends keyof IpcEvents>(channel: C, payload: IpcEvents[C]) => void;

/** What the handler modules share with main.ts. Built once in main.ts; nothing here is new state. */
export interface IpcContext {
  send: Send;
  known: KnownPaths;
  /** Recordings handed to the app from outside (Dock, "Open with", command line); main.ts fills it. */
  opened: Set<string>;
  baseEnv: () => Record<string, string>;
  modelsDir: () => string;
  tokenFile: () => string;
  /** A recording path from the renderer must be a string, an audio/video extension and an existing regular file. */
  mediaFile: (p: unknown) => p is string;
  /** A recording the app knows about (see knownPaths.ts): the window may only read, reveal or delete those. */
  knownMedia: (p: unknown) => p is string;
}
