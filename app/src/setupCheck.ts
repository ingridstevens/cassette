import { ModelStatus, Options, bytes } from "./types";
import { tooBigForMemory } from "./estimate";
import { modelName } from "./components/modelInfo";

export type Level = "ok" | "warn" | "bad";
export interface Check { id: string; level: Level; text: string }
type TFn = (s: string, v?: Record<string, string | number>) => string;

export interface Facts {
  opts: Options; status: ModelStatus | null; memGB?: number; freeBytes: number | null; microphones: number | null;
}

const GB = 1024 ** 3;

/** "Check my setup": what is ready, and what to do about what is not. Pure (no network, no files read), so it is quick and safe to run anytime. */
export function setupChecks(f: Facts, t: TFn): Check[] {
  const out: Check[] = [];
  const { opts, status } = f;
  if (!status) {
    out.push({ id: "engine", level: "bad", text: t("The speech engine did not answer. Close the app and open it again. If it still does not answer, copy the diagnostics and send them to whoever set this up.") });
    return out;
  }
  out.push({ id: "engine", level: "ok", text: t("The speech engine is running.") });

  const have = !!status.whisper[opts.model];
  out.push(have
    ? { id: "model", level: "ok", text: t("The transcription model {model} is downloaded.", { model: modelName(opts.model) }) }
    : { id: "model", level: "bad", text: t("The transcription model {model} is not downloaded. Download it in Settings, Transcription, or import a models folder.", { model: modelName(opts.model) }) });

  if (!opts.noDiarize) {
    out.push(status.diarization
      ? { id: "speakers", level: "ok", text: t("Speaker detection is ready.") }
      : { id: "speakers", level: "warn", text: t("Speaker detection is not set up. Transcripts will not say who is speaking until you set it up in Settings, Speakers.") });
  }

  if (f.memGB) {
    out.push(tooBigForMemory(opts.model, !opts.noDiarize, f.memGB)
      ? { id: "memory", level: "warn", text: t("{model} may not fit in this computer's {mem} GB of memory. A smaller size is safer.", { model: modelName(opts.model), mem: f.memGB }) }
      : { id: "memory", level: "ok", text: t("This computer has {mem} GB of memory, enough for {model}.", { mem: f.memGB, model: modelName(opts.model) }) });
  }

  if (f.freeBytes != null) {
    out.push(f.freeBytes < 1 * GB
      ? { id: "disk", level: "bad", text: t("Only {size} is free on this disk. Free some space before transcribing or downloading models.", { size: bytes(f.freeBytes) }) }
      : f.freeBytes < 5 * GB
        ? { id: "disk", level: "warn", text: t("{size} is free on this disk. That is enough to work, but not for large models.", { size: bytes(f.freeBytes) }) }
        : { id: "disk", level: "ok", text: t("{size} is free on this disk.", { size: bytes(f.freeBytes) }) });
  }

  if (f.microphones != null) {
    out.push(f.microphones > 0
      ? { id: "mic", level: "ok", text: t("A microphone is available for recording.") }
      : { id: "mic", level: "warn", text: t("No microphone was found. You can still transcribe files; to record, connect one and allow access.") });
  }
  return out;
}

/** The checks as plain lines for a bug report. No transcript text, no file names, no token. */
export const checksText = (checks: Check[]) => checks.map((c) => `${c.level === "ok" ? "[ok]  " : c.level === "warn" ? "[warn]" : "[bad] "} ${c.id}: ${c.text}`).join("\n");
