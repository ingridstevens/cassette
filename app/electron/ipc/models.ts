/** Model downloads and checks, the Hugging Face token, and importing models someone else downloaded. */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { app, dialog, safeStorage } from "electron";
import { EngineEvent, cancelJob, runEngine } from "../engine-client";
import { modelsOk } from "../validate";
import { handle, type IpcContext } from "./typed";

export function registerModels({ send, baseEnv, tokenFile }: IpcContext) {
  /** The running model download/delete job, so the renderer can cancel it. */
  let modelsJob: string | null = null;
  function readToken(): string {
    try { return safeStorage.decryptString(fs.readFileSync(tokenFile())); } catch { return ""; }
  }


  // Copy models that someone else downloaded (a "models" folder) into this app's models folder.
  handle("import-models", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "Choose the folder that contains the models" });
    if (r.canceled || !r.filePaths[0]) return { cancelled: true };
    return await runEngine(randomUUID(), ["models", "import", r.filePaths[0]], baseEnv(), () => {}) as EngineEvent | null;
  });
  handle("models", async (_e, action: string, name?: string) => {
    if (!modelsOk(action, name)) throw new Error("Unsupported model action");
    const a = ["models", action, ...(name ? [name] : [])];
    const env: Record<string, string> = { ...baseEnv() };
    if ((name === "diarization" && (action === "download" || action === "repair")) || action === "check") env.HF_TOKEN = readToken();
    const jobId = randomUUID();
    if (action !== "status") modelsJob = jobId;
    try {
      const r = await runEngine(jobId, a, env, (e) => send("engine-event", { jobId, source: "models", ...e }));
      return r as EngineEvent | null;
    } finally { if (modelsJob === jobId) modelsJob = null; }
  });
  handle("cancel-models", () => { if (modelsJob) { cancelJob(modelsJob); return true; } return false; });

  // On Linux without a keyring, safeStorage falls back to "basic_text", which is effectively plain text.
  const tokenSecure = () => safeStorage.isEncryptionAvailable()
    && !(process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text");
  handle("tokenSecure", () => tokenSecure());
  handle("token", (_e, value?: string) => {
    const hint = () => { const t = readToken(); return t ? "hf_…" + t.slice(-4) : ""; };
    if (value === undefined) return hint();
    if (value === "") { fs.rmSync(tokenFile(), { force: true }); return ""; }
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(tokenFile(), safeStorage.encryptString(value));
    return hint();
  });
}
