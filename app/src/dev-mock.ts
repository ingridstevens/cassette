// DEV ONLY: fakes window.api so the renderer can be exercised in a plain browser (npx vite --port 5199).
export {};
type Cb = (e: any) => void;
const listeners = new Set<Cb>();
const emit = (e: any) => listeners.forEach((l) => l(e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = (m: number) => sleep(m);
const st = { whisper: { tiny: false, base: false, small: false, medium: false, "large-v3-turbo": false, "large-v3": false, "parakeet-v3": false } as Record<string, boolean>, diarization: false };
const sizes = { whisper: { tiny: 75e6, base: 145e6, small: 480e6, medium: 1.5e9, "large-v3-turbo": 1.6e9, "large-v3": 3e9, "parakeet-v3": 2.51e9 } as Record<string, number>, diarization: 32e6 };
let token = "";
let stopDl = false;
const mlxSt: Record<string, boolean> = { tiny: false, base: false, small: false, medium: false, "large-v3-turbo": false, "large-v3": false };
const hint = () => (token ? "hf_…" + token.slice(-4) : "");
const llmCatalog = [
  { id: "small", label: "Qwen2.5 1.5B", like: "The first small model. Weak in German: use a newer one", languages: ["en", "de", "fr", "es"], license: "Apache-2.0", bytes: 868628559, retired: true },
  { id: "qwen3-1.7b", label: "Qwen3 1.7B", like: "Small and quick. Fine for short recordings and clear speech", languages: ["en", "de", "fr", "es"], license: "Apache-2.0", bytes: 984015687 },
  { id: "qwen3-4b", label: "Qwen3 4B", like: "Good balance of quality and speed", languages: ["en", "de", "fr", "es"], license: "Apache-2.0", bytes: 2278972236 },
  { id: "gemma3-4b", label: "Gemma 3 4B", like: "Mid-sized. Very good across languages", languages: ["en", "de", "fr", "es"], license: "Gemma", bytes: 2600191231 },
  { id: "best", label: "Qwen2.5 7B", like: "Large and slower. Finds better highlights and writes better summaries", languages: ["en", "de", "fr", "es"], license: "Apache-2.0", bytes: 4284346255 },
];
const llmSt: Record<string, boolean> = Object.fromEntries(llmCatalog.map((m) => [m.id, false]));
if (location.search.includes("ready")) { llmSt.small = true; }
if (location.search.includes("ready")) { st.whisper.small = true; st.whisper.tiny = true; st.diarization = true; token = "hf_mock1234"; }

function wav(seconds = 24, rate = 8000): Uint8Array {
  const n = seconds * rate, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / rate; const env = Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1)) ** 2; v.setInt16(44 + i * 2, Math.sin(t * 2 * Math.PI * 220) * env * 20000, true); }
  return new Uint8Array(buf);
}

const lines: [string, string][] = [
  ["SPEAKER_00", "Hallo zusammen und willkommen zum Interview."], ["SPEAKER_01", "Danke für die Einladung, ich freue mich sehr."],
  ["SPEAKER_02", "Ich habe vorab ein paar Fragen vorbereitet."], ["SPEAKER_00", "Dann fangen wir direkt mit der ersten an."],
  ["SPEAKER_01", "Gerne. Das Projekt begann vor drei Jahren."], ["SPEAKER_02", "Und wie ging es danach weiter?"],
];
function fake() {
  let t = 0.5;
  const segments = lines.map(([speaker, text]) => {
    const ws = text.split(" "), start = t;
    const words = ws.map((word, i) => ({ start: start + i * 0.45, end: start + i * 0.45 + 0.4, word: (i === 0 ? "" : " ") + word, speaker, prob: (i === 3 && speaker === "SPEAKER_02") || i % 6 === 4 ? 0.3 : 0.95 }));
    t = start + ws.length * 0.45 + 0.5;
    return { start, end: t - 0.5, speaker, text, words };
  });
  return { language: "de", duration: 24, speakers: ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"], segments };
}

(window as any).api = {
  readAudio: async (p: string) => { if (p.includes("broken")) throw new Error("Error invoking remote method 'read-audio': Error: ENOENT: file not found"); await wait(600); return wav(); },
  pickFiles: async () => ["/Users/demo/Interview 2026.wav", "/Users/demo/Podcast episode 12.m4a"],
  loadProjects: async () => { try { return JSON.parse(localStorage.getItem("mock-projects") || "[]"); } catch { return []; } },
  saveProjects: async (d: unknown) => { try { localStorage.setItem("mock-projects", JSON.stringify(d)); } catch { /* quota */ } return true; },
  saveSidecar: async (p: string) => ({ ok: true, path: p + ".transcript.json" }),
  pathForFile: (f: File) => "/Users/demo/" + f.name,
  transcribe: async function (o: { clientId?: string; acceptFit?: boolean; model?: string }) {
    const jobId = "job" + Math.random().toString(36).slice(2, 7); emit({ jobId, type: "started", clientId: o.clientId });
    (async () => {
      if (location.search.includes("fit") && !(o as { acceptFit?: boolean }).acceptFit && ["tiny", "base", "small"].includes((o as { model?: string }).model ?? "")) {
        await wait(600); emit({ jobId, type: "fit", language: "fa", probability: 0.93, model: (o as { model: string }).model, level: "weak", suggested: "medium", have: { ...st.whisper } }); return;
      }
      for (const [stage, ms] of [["decode", 500], ["diarize", 900], ["transcribe", location.search.includes("slow") ? 12000 : 1200], ["merge", 300]] as const) {
        for (let i = 1; i <= 4; i++) {
          emit({ jobId, type: "progress", stage, fraction: i / 4, message: "" });
          if (stage === "transcribe") emit({ jobId, type: "partial", segments: fake().segments.slice((i - 1) * 2, i * 2).map(({ words: _w, ...s }) => s) });
          await wait(ms / 4);
        }
      }
      emit({ jobId, type: "done", ...fake() });
    })();
    return jobId;
  },
  // Live recording: no microphone in a browser tab, so words arrive on a timer and Stop saves nothing real
  liveStart: async () => {
    const jobId = "live" + Math.random().toString(36).slice(2, 7);
    const say = " Guten Tag und willkommen zu unserer Sendung heute sprechen wir über Radio und Sprachen in Berlin".split(" ").slice(1);
    let i = 0, sec = 0;
    setTimeout(() => emit({ jobId, source: "live", type: "ready" }), 800);
    const tick = setInterval(() => {
      if (i >= say.length) { clearInterval(tick); return; }
      sec += 2; const w = say.slice(i, i + 2).map((x) => " " + x); i += 2;
      emit({ jobId, source: "live", type: "live", confirmed: w.map((word) => ({ word, start: 0, end: 0 })), tentative: " " + (say[i] ?? ""), seconds: sec });
    }, 1500);
    (window as unknown as { __liveTick?: number }).__liveTick = tick as unknown as number;
    return { ok: true, jobId };
  },
  mockMic: true,
  liveAudio: () => {},
  liveStop: async () => { clearInterval((window as unknown as { __liveTick?: number }).__liveTick); return { ok: true, path: "/Users/demo/Recording 2026-10-16 14.05.wav", seconds: 14, name: "Recording 2026-10-16 14.05" }; },
  cancel: async () => {},
  powerState: async () => ({ onBattery: location.search.includes("battery") }),
  importModels: async () => { await wait(400); return { type: "done", imported: ["pyannote/speaker-diarization-3.1"] }; },
  models: async (action: string, name?: string) => {
    if (action === "check") { await wait(300); return { type: "done", valid: true, kind: "read", username: "demo-user", repos: { "pyannote/speaker-diarization-3.1": true, "pyannote/segmentation-3.0": !location.search.includes("denied"), "pyannote/wespeaker-voxceleb-resnet34-LM": true } }; }
    if (action === "status") return { fit: { engines: { "parakeet-v3": ["de", "en", "fr", "es", "ru", "uk", "pl", "it"] }, order: ["tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"], floor: { en: "tiny", de: "small", fr: "small", es: "small", fa: "medium", ar: "medium", hi: "medium", sw: "large-v3", am: "large-v3", ha: "large-v3" } }, llm: { available: !location.search.includes("nollm"), backend: "mlx", default: "qwen3-4b", catalog: llmCatalog.filter((m) => llmSt[m.id] || !m.retired).map(({ bytes: _b, retired: _r, ...m }) => m), translation: [{ id: "hy-mt2-1.8b", label: "Hy-MT2 1.8B", like: "Translates between 38 languages, including Arabic and Persian", languages: ["en", "de", "ar"], license: "Apache-2.0" }], models: { ...llmSt, "hy-mt2-1.8b": !!(llmSt as Record<string, boolean>)["hy-mt2-1.8b"] }, bytes: { ...Object.fromEntries(llmCatalog.map((m) => [m.id, m.bytes])), "hy-mt2-1.8b": 1.0175e9 } }, mlxAvailable: true, mlx: mlxSt, mlxSizes: { tiny: 74e6, base: 144e6, small: 481e6, medium: 1525e6, "large-v3-turbo": 1614e6, "large-v3": 3084e6 }, ...st, dir: "/Users/demo/Library/Application Support/Local Transcriber/models", sizes };
    if (action === "download") {
      stopDl = false;
      for (let i = 1; i <= 20; i++) {
        await wait(250);
        if (stopDl) return { type: "error", message: "Cancelled", cancelled: true };
        if (location.search.includes("offline") && i === 13) return { type: "error", message: "ConnectionError: Max retries exceeded, could not resolve huggingface.co" };
        if (location.search.includes("denied") && name === "diarization" && i === 3) return { type: "error", message: "401 Client Error: Cannot access gated repo pyannote/segmentation-3.0" };
        emit({ source: "models", type: "progress", stage: "download", fraction: i / 20, message: `${i * 5}%` });
      }
      if (name!.startsWith("llm-")) llmSt[name!.slice(4)] = true; else if (name === "diarization") st.diarization = true; else if (name!.startsWith("mlx-")) mlxSt[name!.slice(4)] = true; else st.whisper[name!] = true;
    }
    if (action === "delete") { if (name!.startsWith("llm-")) llmSt[name!.slice(4)] = false; else if (name === "diarization") st.diarization = false; else if (name!.startsWith("mlx-")) mlxSt[name!.slice(4)] = false; else st.whisper[name!] = false; }
    return { type: "done" };
  },
  cancelModels: async () => { stopDl = true; return true; },
  token: async (v?: string) => { if (v !== undefined) token = v; return hint(); },
  exportTranscript: async (_p: unknown, f: string, n: string) => { await wait(200); console.log("export", f); return n.includes("fail") ? { ok: false, error: "Disk full" } : { ok: true, path: `/Users/demo/${n}.${f}` }; },
  translateLine: async () => { await wait(500); return { ok: true, text: "(English translation appears here)" }; },
  runLlm: async (kind: string, p: { segments: { start: number; end: number; speaker: string; text: string; words: { start: number; end: number; word: string }[] }[] }, o: { clientId: string }) => {
    for (let i = 1; i <= 5; i++) { await wait(300); emit({ source: "llm", clientId: o.clientId, type: "progress", stage: kind, fraction: i / 5, message: "" }); }
    emit({ source: "llm", clientId: o.clientId, jobId: "llm1", type: "done" });
    if (location.search.includes("llmfail")) return { type: "error", message: "The language model is not downloaded yet." };
    if (kind === "summarize") return { type: "done", summary: { summary: "Das Interview beginnt mit einer Begrüßung. Der Gast erzählt, dass das Projekt vor drei Jahren begann, und beantwortet vorbereitete Fragen zum weiteren Verlauf.", topics: [{ start: 0.5, title: "Begrüßung" }, { start: 9, title: "Beginn des Projekts" }], decisions: ["Das Interview wird mit der ersten vorbereiteten Frage fortgesetzt."], actions: [{ text: "Fragen zum Verlauf nach dem Projektstart beantworten", owner: "Gast" }] } };
    const pick = (i: number, a: number, b: number, score: number, reason: string) => { const s = p.segments[i], ws = s.words.slice(a, b + 1); return { start: ws[0].start, end: ws[ws.length - 1].end, text: ws.map((w) => w.word).join("").trim(), speaker: s.speaker, score, reason }; };
    return { type: "done", highlights: [pick(1, 0, 6, 8, "Eine warme, offene Antwort."), pick(4, 1, 6, 7, "Zeigt, wie alles anfing.")] };
  },
  exportClips: async (_i: string, clips: unknown[]) => { await wait(300); return { ok: true, count: clips.length, path: "/Users/demo/Interview highlights" }; },
  saveClip: async () => "/Users/demo/clip.wav",
  reveal: async () => {},
  paths: async () => ({ models: "/Users/demo/Library/Application Support/Local Transcriber/models", log: "/x/activity.log", token: "/x/t", data: "/x", system: { platform: "darwin", arch: "arm64", chip: "Apple M5 Pro", cores: 18, memGB: 48 } }),
  saveImage: async () => ({ ok: true, path: "/Users/demo/share-card.png" }),
  revealPath: async () => {},
  fileSize: async (p: string) => (p.includes("broken") ? null : 3_412_907),
  diskFree: async () => (location.search.includes("lowdisk") ? 2.1e9 : 48e9),
  openExternal: async () => true,
  onEvent: (cb: Cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
};
