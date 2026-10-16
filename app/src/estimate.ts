/**
 * How long a transcription will take, for the "before you start" sheet.
 * Numbers are "seconds of audio handled per second of work". Without a timed run on this computer they are rough guesses
 * (measured once on one Mac with the small model: 3.9 on the CPU engine, about 16 on the Apple GPU engine) scaled by model size,
 * and the sheet says so. After every real full run the measured speed replaces the guess for that model and engine.
 */
export type Engine = "mlx" | "faster";
export interface Calib { whisper: Record<string, number>; diar: Record<string, number> }

/** Cost of each Whisper size relative to "small" (roughly by parameter count; turbo's decoder is much smaller). */
export const REL: Record<string, number> = { tiny: 0.16, base: 0.3, small: 1, medium: 3.2, "large-v3-turbo": 2, "large-v3": 6.4, "parakeet-v3": 0.9 };
const SMALL_RATE: Record<Engine, number> = { faster: 3.9, mlx: 16 };
const DIAR_RATE: Record<"gpu" | "cpu", number> = { gpu: 8, cpu: 3 };
const KEY = "speed-calibration";

export function loadCalib(): Calib {
  try { const c = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return { whisper: c.whisper ?? {}, diar: c.diar ?? {} }; } catch { return { whisper: {}, diar: {} }; }
}

/** Remember how fast a full run was (newest run counts half). Runs with translation or per-speaker languages are slower for other reasons and are not used. */
export function recordSpeed(model: string, engine: Engine, duration: number, secondsWords: number | undefined, secondsSpeakers: number | null | undefined, gpuSpeakers: boolean) {
  if (!(duration > 20)) return;
  const c = loadCalib();
  const mix = (old: number | undefined, now: number) => (old ? old * 0.5 + now * 0.5 : now);
  if (secondsWords && secondsWords > 0) c.whisper[`${model}:${engine}`] = mix(c.whisper[`${model}:${engine}`], duration / secondsWords);
  if (secondsSpeakers && secondsSpeakers > 0) { const k = gpuSpeakers ? "gpu" : "cpu"; c.diar[k] = mix(c.diar[k], duration / secondsSpeakers); }
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage unavailable: estimates just stay rough */ }
}

export interface Estimate { low: number; mid: number; high: number; rough: boolean }

export function estimate(a: { duration: number; model: string; engine: Engine; speakers: boolean; gpuSpeakers: boolean; calib?: Calib }): Estimate {
  const calib = a.calib ?? { whisper: {}, diar: {} };
  const exactW = calib.whisper[`${a.model}:${a.engine}`];
  let wRate = exactW;
  if (!wRate) {
    // scale from another measured size on the same engine, else from the built-in guess
    const other = Object.entries(calib.whisper).find(([k]) => k.endsWith(":" + a.engine));
    wRate = other ? other[1] * (REL[other[0].split(":")[0]] ?? 1) / (REL[a.model] ?? 1) : SMALL_RATE[a.engine] / (REL[a.model] ?? 1);
  }
  const dKey = a.gpuSpeakers ? "gpu" : "cpu";
  const dRate = calib.diar[dKey] ?? DIAR_RATE[dKey];
  const mid = Math.max(1, a.duration / wRate + (a.speakers ? a.duration / dRate : 0));
  const rough = !exactW || (a.speakers && !calib.diar[dKey]);
  const [lo, hi] = rough ? [0.6, 1.8] : [0.85, 1.2];
  return { low: mid * lo, mid, high: mid * hi, rough };
}

/** Which engine will do the words: the Apple GPU one only when it is there, downloaded for this size, allowed, and skip-silence is off. */
export function engineFor(model: string, o: { whisperEngine?: string; device?: string; vad?: boolean }, status: { mlxAvailable?: boolean; mlx?: Record<string, boolean> } | null): Engine {
  if (model === "parakeet-v3") return "mlx"; // always on the Apple GPU
  return status?.mlxAvailable && status.mlx?.[model] && o.whisperEngine !== "faster" && o.device !== "cpu" && !o.vad ? "mlx" : "faster";
}
