import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { redactNames } from "./logRedact";

export const logFile = () => path.join(app.getPath("userData"), "activity.log");
/** The log is on unless the marker file exists. A file, not a setting in the window, so the main process (which writes the log) never has to ask. */
export const logOffFile = () => path.join(app.getPath("userData"), "activity-log-off");
export const logOn = () => !fs.existsSync(logOffFile());
/** Marker: when present, file and folder names it recognises are replaced before a line is written (new lines only). */
export const logHideFile = () => path.join(app.getPath("userData"), "activity-log-hide-names");
export const logHides = () => fs.existsSync(logHideFile());
export const logText = (message: string) => (logHides() ? redactNames(message) : message);
export const logLine = (level: string, message: string) => {
  if (!logOn()) return;
  try { fs.appendFileSync(logFile(), `${new Date().toISOString()} [${level}] ${logText(message)}\n`); } catch { /* best effort */ }
};
