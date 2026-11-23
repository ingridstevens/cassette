/** Jobs the window starts on the engine: transcribe, cancel, translate one line, and the local language model. */
import { randomUUID } from "node:crypto";
import { EngineEvent, cancelJob, runEngine } from "../engine-client";
import { privateTmp, withTempJson } from "../tempJson";
import { AUDIO_CLEANUP, isNum, speakerCount, transcribeProblem } from "../validate";
import { handle, type IpcContext } from "./typed";

export function registerEngineJobs({ send, baseEnv, mediaFile, watch }: IpcContext) {
  // English translation of one stretch of a recording (the "Translate to English" action on a line).
  handle("translate-line", async (_e, p: { input: unknown; start: unknown; end: unknown; model: unknown; language: unknown; backend?: unknown }) => {
    if (!mediaFile(p?.input) || typeof p.start !== "number" || typeof p.end !== "number" || !(p.end > p.start)) return { ok: false, error: "Unsupported or missing recording" };
    const a = ["translate", p.input, "--start", String(p.start), "--end", String(p.end), "--model", String(p.model || "small"), "--language", String(p.language || "auto"), ...(p.backend === "faster" ? ["--backend", "faster"] : [])];
    const r = await runEngine(randomUUID(), a, baseEnv(), () => {}) as EngineEvent | null;
    return r?.type === "done" ? { ok: true, text: String(r.text ?? "") } : { ok: false, error: String(r?.message ?? "The translation failed.").slice(0, 300) };
  });
  // The local language model: "highlights" (suggest quotable passages), "summarize", or "ask" (answer a question, `payload.question`, about the transcript). The renderer picks the job id so it can cancel with `cancel`.
  handle("llm-run", async (_e, kind: unknown, payload: unknown, o: { jobId?: unknown; clientId?: unknown; model?: unknown; count?: unknown }) => {
    if (kind !== "highlights" && kind !== "summarize" && kind !== "ask") return { type: "error", message: "Unknown job" };
    const jobId = typeof o?.jobId === "string" && o.jobId.length <= 80 ? o.jobId : randomUUID();
    return await withTempJson(payload, (tmp) => {
      const a = [kind, tmp, ...(typeof o?.model === "string" && /^[a-z0-9][a-z0-9.-]{0,40}$/.test(o.model) ? ["--model", o.model] : []), ...(kind === "highlights" && Number.isInteger(o?.count) && (o.count as number) > 0 ? ["--count", String(o.count)] : [])];
      return runEngine(jobId, a, baseEnv(), (e) => send("engine-event", { jobId, source: "llm", clientId: o?.clientId, ...e }));
    });
  });

  handle("transcribe", async (_e, opts: Record<string, unknown>) => {
    if (!mediaFile(opts?.input)) throw new Error("Unsupported or missing recording");
    const bad = transcribeProblem(opts); if (bad) throw new Error(bad);
    const jobId = randomUUID();
    const a = ["transcribe", String(opts.input), "--model", String(opts.model), "--language", String(opts.language)];
    const range = opts.numSpeakers === "range";
    if (range) { a.push("--min-speakers", String(speakerCount(opts.minSpeakers) ?? 2), "--max-speakers", String(speakerCount(opts.maxSpeakers) ?? 4)); }
    if (opts.language === "auto") a.push("--mixed-languages", opts.multilingual === true ? "on" : opts.multilingual === false ? "off" : "auto");
    if (typeof opts.detectModel === "string" && /^[a-z0-9-]{1,20}$/.test(opts.detectModel)) a.push("--detect-model", opts.detectModel);
    if (opts.translate) a.push(typeof opts.translateTo === "string" && /^[a-zA-Z-]{2,8}$/.test(opts.translateTo) && opts.translateTo !== "en" ? "--translate-to" : "--translate", ...(typeof opts.translateTo === "string" && /^[a-zA-Z-]{2,8}$/.test(opts.translateTo) && opts.translateTo !== "en" ? [opts.translateTo] : []));
    if (opts.whisperEngine === "faster") a.push("--backend", "faster");
    if (opts.verbatim) a.push("--verbatim");
    const nSpeakers = speakerCount(opts.numSpeakers);
    if (!range && nSpeakers) a.push("--num-speakers", String(nSpeakers));
    if (isNum(opts.start)) a.push("--start", String(opts.start));
    if (isNum(opts.end)) a.push("--end", String(opts.end));
    if (opts.device && opts.device !== "auto") a.push("--device", String(opts.device));
    if (opts.vad) a.push("--vad");
    if (opts.prompt) a.push(`--prompt=${String(opts.prompt).slice(0, 2000)}`); // "=" form: a value starting with "-" would be read as an option
    if (opts.noDiarize) a.push("--no-diarize");
    if (opts.acceptFit) a.push("--accept-fit");
    // Audio cleanup works on a temporary copy of the sound. It lives in the app's private temp folder (swept at start), not the shared one.
    const cleanup = typeof opts.audioCleanup === "string" && opts.audioCleanup !== "off" && AUDIO_CLEANUP.has(opts.audioCleanup);
    if (cleanup) a.push("--audio-cleanup", String(opts.audioCleanup));
    const env = cleanup ? { ...baseEnv(), TMPDIR: privateTmp(), TEMP: privateTmp(), TMP: privateTmp() } : baseEnv();
    send("engine-event", { jobId, type: "started", clientId: opts.clientId });
    watch.transcriptionStarted();
    runEngine(jobId, a, env, (e) => send("engine-event", { jobId, ...e })).then((r) => { if (r?.type === "error") send("engine-event", { jobId, ...r }); }).finally(() => watch.transcriptionEnded());
    return jobId;
  });
  handle("cancel", (_e, jobId: string) => cancelJob(jobId));
}
