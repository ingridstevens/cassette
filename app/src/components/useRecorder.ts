import { useCallback, useEffect, useRef, useState } from "react";
import { FitAsk } from "../types";
import workletUrl from "../worklets/pcm16.worklet.ts?worker&url";

export type RecState = "idle" | "starting" | "recording" | "saving";
export interface Recorded { path: string; seconds: number; name: string }

/** Microphone → 16 kHz mono 16-bit audio → the engine's live transcription, and the same audio to disk. */
export function useRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [ready, setReady] = useState(false);          // the engine has loaded its model
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);          // how much audio the engine has heard
  const [level, setLevel] = useState(0);              // 0..1, for the meter
  const [heard, setHeard] = useState(false);         // any sound at all since the recording started
  const [confirmed, setConfirmed] = useState("");     // words that will not change
  const [tentative, setTentative] = useState("");     // the latest guess, may still change
  const [fit, setFit] = useState<FitAsk | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const job = useRef(""), stopMic = useRef<() => void>(() => {});

  useEffect(() => window.api.onEvent((e) => {
    if (e.source !== "live" || e.jobId !== job.current) return;
    if (e.type === "ready") setReady(true);
    else if (e.type === "live") {
      setConfirmed((c) => c + (e.confirmed as { word: string }[]).map((w) => w.word).join(""));
      setTentative(String(e.tentative ?? ""));
      setSeconds(Number(e.seconds) || 0);
    } else if (e.type === "fit") setFit(e as unknown as FitAsk);
    else if (e.type === "error" && !e.cancelled) setError(String(e.message ?? "").slice(0, 300));
  }), []);

  const listDevices = useCallback(async () => {
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput")); } catch { /* no microphone list */ }
  }, []);
  useEffect(() => { void listDevices(); }, [listDevices]);
  useEffect(() => () => stopMic.current(), []);

  const start = useCallback(async (opts: Record<string, unknown>, deviceId?: string) => {
    setError(""); setConfirmed(""); setTentative(""); setSeconds(0); setFit(null); setReady(false); setHeard(false); setState("starting");
    const r = await window.api.liveStart(opts);
    if (!r.ok || !r.jobId) { setState("idle"); setError(r.error === "denied" ? "denied" : r.error ?? "The recording could not start."); return false; }
    job.current = r.jobId;
    if ((window.api as { mockMic?: boolean }).mockMic) { setState("recording"); return true; } // the browser preview has no microphone to open
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
      const ctx = new AudioContext({ sampleRate: 16000 });
      const src = ctx.createMediaStreamSource(stream);
      await ctx.audioWorklet.addModule(workletUrl); // a bundled file, so the app's script-src 'self' allows it
      const node = new AudioWorkletNode(ctx, "pcm16");
      node.port.onmessage = ({ data }: MessageEvent<{ pcm: ArrayBuffer; peak: number }>) => {
        setLevel(data.peak);
        if (data.peak > 0.003) setHeard(true);
        window.api.liveAudio(job.current, new Uint8Array(data.pcm));
      };
      src.connect(node); // the node makes no sound, so it needs no connection to the speakers
      stopMic.current = () => { node.port.onmessage = null; try { src.disconnect(); node.disconnect(); } catch { /* already gone */ } stream.getTracks().forEach((t) => t.stop()); void ctx.close(); stopMic.current = () => {}; setLevel(0); };
      void listDevices();
      setState("recording");
      return true;
    } catch (err) {
      await window.api.liveStop(job.current);
      setState("idle");
      setError((err as Error)?.name === "NotAllowedError" ? "denied" : String((err as Error)?.message ?? err).slice(0, 200));
      return false;
    }
  }, [listDevices]);

  /** Stops, saves the WAV and returns where it is. */
  const stop = useCallback(async (): Promise<Recorded | null> => {
    setState("saving");
    stopMic.current();
    const r = await window.api.liveStop(job.current);
    setState("idle");
    if (!r.ok || !r.path) { setError(r.error ?? "The recording could not be saved."); return null; }
    return { path: r.path, seconds: r.seconds ?? 0, name: r.name ?? "Recording" };
  }, []);

  return { state, ready, error, seconds, level, heard, confirmed, tentative, fit, devices, start, stop };
}
