import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { app, ipcMain, systemPreferences } from "electron";
import { EngineEvent, endJobInput, runEngine, writeToJob } from "./engine-client";

const RATE = 16000;
/** A 16-bit mono WAV header for `bytes` of audio at 16 kHz. */
function wavHeader(bytes: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + bytes, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(bytes, 40);
  return h;
}
const two = (n: number) => String(n).padStart(2, "0");
const stamp = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}.${two(d.getMinutes())}`;

/** Turns a raw .pcm recording into a .wav next to it, removes the .pcm and returns the .wav path. */
async function pcmToWav(pcmPath: string): Promise<string> {
  const wav = pcmPath.replace(/\.pcm$/, ".wav");
  const bytes = fs.statSync(pcmPath).size;
  const out = fs.createWriteStream(wav);
  out.write(wavHeader(bytes));
  await new Promise<void>((res, rej) => { const src = fs.createReadStream(pcmPath); src.on("error", rej); out.on("error", rej); out.on("finish", () => res()); src.pipe(out); });
  fs.rmSync(pcmPath, { force: true });
  return wav;
}

interface Session { jobId: string; pcm: fs.WriteStream; pcmPath: string; bytes: number; peak: number; name: string; done: Promise<unknown> }
let current: Session | null = null;

/** Live recording: the window sends 16 kHz mono 16-bit microphone audio; this feeds it to the engine's `live` command
 *  and also writes it to disk, so a crash or a failing engine never loses the recording. */
export function registerLive(send: (channel: string, payload: unknown) => void, env: () => Record<string, string>) {
  ipcMain.handle("live-start", async (_e, o: { model?: unknown; language?: unknown; whisperEngine?: unknown; device?: unknown }) => {
    if (current) return { ok: false, error: "A recording is already running." };
    if (process.platform === "darwin" && !(await systemPreferences.askForMediaAccess("microphone"))) return { ok: false, error: "denied" };
    const dir = path.join(app.getPath("userData"), "recordings");
    fs.mkdirSync(dir, { recursive: true });
    const name = `Recording ${stamp()}`;
    let n = 1, base = name;
    while (fs.existsSync(path.join(dir, base + ".wav")) || fs.existsSync(path.join(dir, base + ".pcm"))) base = `${name} (${++n})`;
    const jobId = randomUUID(), pcmPath = path.join(dir, base + ".pcm");
    const model = typeof o?.model === "string" && /^[a-z0-9.-]{1,30}$/.test(o.model) ? o.model : "small";
    const lang = typeof o?.language === "string" && /^[a-z]{2,3}$|^auto$/.test(o.language) ? o.language : "auto";
    const a = ["live", "--model", model, "--language", lang, ...(o?.whisperEngine === "faster" ? ["--backend", "faster"] : []), ...(o?.device === "cpu" ? ["--device", "cpu"] : [])];
    const done = runEngine(jobId, a, env(), (e: EngineEvent) => send("engine-event", { jobId, source: "live", ...e })).then((r) => { if (r?.type === "error") send("engine-event", { jobId, source: "live", ...r }); });
    current = { jobId, pcm: fs.createWriteStream(pcmPath), pcmPath, bytes: 0, peak: 0, name: base, done };
    return { ok: true, jobId };
  });

  ipcMain.on("live-audio", (_e, jobId: unknown, data: unknown) => {
    if (!current || jobId !== current.jobId || !(data instanceof Uint8Array)) return;
    current.pcm.write(data);
    current.bytes += data.byteLength;
    for (let i = 0; i + 1 < data.byteLength; i += 2) { const v = Math.abs(((data[i] | (data[i + 1] << 8)) << 16) >> 16); if (v > current.peak) current.peak = v; }
    writeToJob(current.jobId, data);
  });

  /** Ends the recording: the engine finishes its last update, the audio becomes a WAV file, and its path comes back. */
  ipcMain.handle("live-stop", async (_e, jobId: unknown) => {
    const s = current;
    if (!s || jobId !== s.jobId) return { ok: false, error: "No recording is running." };
    current = null;
    endJobInput(s.jobId);
    await new Promise<void>((r) => s.pcm.end(() => r()));
    let wav: string;
    try { wav = await pcmToWav(s.pcmPath); } catch (err) { return { ok: false, error: String(err).slice(0, 200) }; }
    await Promise.race([s.done, new Promise((r) => setTimeout(r, 15000))]); // let the last words reach the window
    if (s.peak < 100) { fs.rmSync(wav, { force: true }); return { ok: false, error: "silent" }; } // about -50 dB: the microphone gave nothing, so there is nothing to transcribe
    return { ok: true, path: wav, seconds: s.bytes / (RATE * 2), name: s.name };
  });
  /** Recordings a crash left behind as .pcm: turn each into a .wav (skipping the one running now and anything under 1 s) and return the paths. */
  ipcMain.handle("live-recover", async () => {
    const dir = path.join(app.getPath("userData"), "recordings");
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".pcm"))) {
      const p = path.join(dir, f);
      if (current?.pcmPath === p || fs.statSync(p).size < RATE * 2) continue;
      try { out.push(await pcmToWav(p)); } catch { /* leave it for next time */ }
    }
    return out;
  });
}
