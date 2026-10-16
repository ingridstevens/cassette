import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { app } from "electron";

export type EngineEvent = { type: "progress" | "partial" | "fit" | "done" | "error" | "log"; [k: string]: unknown };

/** Dev: run the Python project via uv. Packaged: run the PyInstaller binary from resources. */
function engineCommand(): { cmd: string; args: string[] } {
  if (app.isPackaged) {
    const exe = process.platform === "win32" ? "engine.exe" : "engine";
    return { cmd: path.join(process.resourcesPath, "engine", exe), args: [] };
  }
  const project = path.resolve(__dirname, "..", "..", "engine");
  return { cmd: "uv", args: ["run", "--project", project, "python", "-m", "engine"] };
}

const jobs = new Map<string, ChildProcess>();

export function runEngine(
  jobId: string, engineArgs: string[], env: Record<string, string>, onEvent: (e: EngineEvent) => void,
): Promise<EngineEvent | null> {
  const { cmd, args } = engineCommand();
  const child = spawn(cmd, [...args, ...engineArgs], { env: { ...process.env, ...env, PYTHONUNBUFFERED: "1" } });
  jobs.set(jobId, child);
  child.stdin.on("error", () => { /* the engine ended before the last audio was sent */ });
  let buf = "", last: EngineEvent | null = null, stderr = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("{")) continue;
      try { const e = JSON.parse(line) as EngineEvent; if (e.type !== "progress" && e.type !== "partial") last = e; onEvent(e); } catch { /* ignore non-JSON noise */ }
    }
  });
  child.stderr.on("data", (c) => {
    const text = c.toString();
    stderr = (stderr + text).slice(-4000);
    for (const line of text.split(/[\r\n]+/)) {
      const t = line.trim();
      if (t && !/\d+%\|/.test(t) && !/^Thread 0x[0-9a-f]+:/.test(t)) onEvent({ type: "log", level: "stderr", message: t.slice(0, 400) });
    }
  });
  return new Promise((resolve) => {
    child.on("close", (code, signal) => {
      jobs.delete(jobId);
      if (signal) return resolve({ type: "error", message: "Cancelled", cancelled: true });
      if (code !== 0 && last?.type !== "error") last = { type: "error", message: stderr || `Engine exited with code ${code}` };
      resolve(last);
    });
    child.on("error", (err) => resolve({ type: "error", message: `Cannot start engine: ${err.message}` }));
  });
}

/** Send raw bytes to a running job's standard input (the live microphone feed). */
export function writeToJob(jobId: string, data: Uint8Array): boolean { const s = jobs.get(jobId)?.stdin; return !!s && !s.destroyed && s.write(data); }
/** Tell a running job its input has ended. It finishes what it has and exits. */
export function endJobInput(jobId: string) { jobs.get(jobId)?.stdin?.end(); }
export function cancelJob(jobId: string) { jobs.get(jobId)?.kill(); }
