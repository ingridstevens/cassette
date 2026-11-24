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
let repaired = false;
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

// ?fresh starts with no saved projects or settings, so the first run can be walked from the empty screen
if (location.search.includes("fresh")) { try { localStorage.removeItem("mock-projects"); localStorage.removeItem("opts"); } catch { /* storage unavailable */ } }

function wav(seconds = 24, rate = 8000): Uint8Array {
  const n = seconds * rate, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / rate; const env = Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1)) ** 2; v.setInt16(44 + i * 2, Math.sin(t * 2 * Math.PI * 220) * env * 20000, true); }
  return new Uint8Array(buf);
}

// A second, English sample (a team meeting), so the first-run path can be walked in English as well as German.
const linesEn: [string, string][] = [
  ["SPEAKER_00", "Thanks everyone for joining, let's start with last week's actions."], ["SPEAKER_01", "I shipped the fix on Friday, the report is in the shared folder."],
  ["SPEAKER_02", "Great. I will send the budget numbers by Wednesday."], ["SPEAKER_00", "Perfect. Any blockers before we move on?"],
  ["SPEAKER_01", "Only the access request, which is still waiting for approval."], ["SPEAKER_02", "I will chase that today."],
];
const lines: [string, string][] = [
  ["SPEAKER_00", "Hallo zusammen und willkommen zum Interview."], ["SPEAKER_01", "Danke für die Einladung, ich freue mich sehr."],
  ["SPEAKER_02", "Ich habe vorab ein paar Fragen vorbereitet."], ["SPEAKER_00", "Dann fangen wir direkt mit der ersten an."],
  ["SPEAKER_01", "Gerne. Das Projekt begann vor drei Jahren."], ["SPEAKER_02", "Und wie ging es danach weiter?"],
];
function fake(path = "") {
  const english = /meeting|english/i.test(path);
  let t = 0.5;
  const segments = (english ? linesEn : lines).map(([speaker, text], n) => {
    const ws = text.split(" "), start = t;
    const words = ws.map((word, i) => ({ start: start + i * 0.45, end: start + i * 0.45 + 0.4, word: (i === 0 ? "" : " ") + word, speaker, prob: (i === 3 && speaker === "SPEAKER_02") || i % 6 === 4 ? 0.3 : 0.95 }));
    t = start + ws.length * 0.45 + 0.5;
    return { start, end: t - 0.5, speaker, text, words, ...(n === 4 ? { overlap: true } : {}) }; // one overlap flag, to try the overlap jump key
  });
  return { language: english ? "en" : "de", duration: 24, speakers: ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"], segments };
}

(window as any).api = {
  cleanupEstimate: async (p: string, mode: string) => { await wait(500); return p.includes("broken") ? { ok: false as const, error: "The estimate could not be made." } : { ok: true as const, seconds: 90, before: { speech_db: -31.2, noise_floor_db: -52.4, gap_db: 21.2 }, after: mode === "level" ? { speech_db: -19.8, noise_floor_db: -41.0, gap_db: 21.2 } : { speech_db: -27.5, noise_floor_db: -61.3, gap_db: 33.8 } }; },
  peaks: async (p: string) => { if (p.includes("broken")) return null; await wait(600); const w = wav(), n = 8000; return { peaks: Array.from({ length: n }, (_, i) => Math.abs(Math.sin(i / 40) * Math.sin(i / 700 + 1))), duration: (w.length - 44) / 16000 }; },
  mediaUrl: (_p: string) => URL.createObjectURL(new Blob([wav() as BlobPart], { type: "audio/wav" })),
  // ?missing adds a recording whose file is gone (to read the missing-file messages)
  // window.__nextPick = ["/Users/demo/phone-b.wav"] makes the next file chooser return that (to try "Add a recording")
  pickFiles: async () => { const next = (window as unknown as { __nextPick?: string[] }).__nextPick; if (next) { (window as unknown as { __nextPick?: string[] }).__nextPick = undefined; return next; } return ["/Users/demo/Interview 2026.wav", "/Users/demo/Podcast episode 12.m4a", "/Users/demo/Team meeting.wav", ...(location.search.includes("missing") ? ["/Users/demo/broken-recording.wav"] : [])]; },
  loadProjects: async () => { try { return { projects: JSON.parse(localStorage.getItem("mock-projects") || "[]") }; } catch { return { projects: [] }; } },
  saveProjects: async (d: unknown) => { try { localStorage.setItem("mock-projects", JSON.stringify(d)); } catch { /* quota */ } return { ok: true }; },
  savePartial: async () => true, savePartialSync: () => true, dropPartial: async () => {}, loadPartials: async () => ({}),
  saveProjectsSync: (d: unknown) => { try { localStorage.setItem("mock-projects", JSON.stringify(d)); return true; } catch { return false; } },
  saveSidecar: async (p: string) => ({ ok: true, path: p + ".transcript.json" }),
  sample: async () => ({ ok: true as const, path: "/Users/demo/Sample interview.m4a" }),
  registerPaths: async (_paths: string[]) => {},
  pathForFile: (f: File) => "/Users/demo/" + f.name,
  transcribe: async function (o: { clientId?: string; acceptFit?: boolean; model?: string }) {
    const jobId = "job" + Math.random().toString(36).slice(2, 7); emit({ jobId, type: "started", clientId: o.clientId });
    (async () => {
      const path = (o as { input?: string }).input ?? "";
      // a file called "corrupt" cannot be decoded
      if (path.includes("corrupt")) { await wait(500); emit({ jobId, type: "error", message: "Could not decode this file: unsupported or damaged audio." }); return; }
      // ?enginefail: the engine stops after decoding (to read the error card and the activity log)
      if (location.search.includes("enginefail")) {
        await wait(500); emit({ jobId, type: "progress", stage: "decode", fraction: 1, message: "" }); await wait(500);
        emit({ jobId, type: "error", message: "The speech engine stopped unexpectedly (exit code 3221225477). Close the app and open it again.", detail: "Traceback (mock): access violation in ctranslate2" }); return;
      }
      if (location.search.includes("fit") && !(o as { acceptFit?: boolean }).acceptFit && ["tiny", "base", "small"].includes((o as { model?: string }).model ?? "")) {
        await wait(600); emit({ jobId, type: "fit", language: "fa", probability: 0.93, model: (o as { model: string }).model, level: "weak", suggested: "medium", have: { ...st.whisper } }); return;
      }
      for (const [stage, ms] of [["decode", 500], ["diarize", 900], ["transcribe", location.search.includes("slow") ? 12000 : 1200], ["merge", 300]] as const) {
        for (let i = 1; i <= 4; i++) {
          emit({ jobId, type: "progress", stage, fraction: i / 4, message: "" });
          if (stage === "transcribe") emit({ jobId, type: "partial", segments: fake(path).segments.slice((i - 1) * 2, i * 2).map(({ words: _w, ...s }) => s) });
          await wait(ms / 4);
        }
      }
      emit({ jobId, type: "done", ...fake(path) });
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
  liveRecover: async () => [],
  liveStop: async () => { clearInterval((window as unknown as { __liveTick?: number }).__liveTick); return { ok: true, path: "/Users/demo/Recording 2026-10-16 14.05.wav", seconds: 14, name: "Recording 2026-10-16 14.05" }; },
  cancel: async () => {},
  netActivity: async () => ({ since: Date.now() - 3600_000, transcriptions: 2, transcribing: false, entries: [{ t: Date.now() - 1800_000, kind: "link" as const, host: "huggingface.co", whileTranscribing: false }, { t: Date.now() - 900_000, kind: "model" as const, host: "", action: "download", model: "small", whileTranscribing: false }] }),
  updateState: async () => ({ on: localStorage.getItem("mock-update-on") === "1", lastChecked: localStorage.getItem("mock-update-on") === "1" ? Date.now() - 86_400_000 : null, newer: localStorage.getItem("mock-update-on") === "1" ? "99.0.0" : null, failed: false, current: "0.0.0" }),
  setUpdateCheck: async (on: boolean) => { try { localStorage.setItem("mock-update-on", on ? "1" : "0"); } catch { /* storage unavailable */ } return { on, lastChecked: on ? Date.now() : null, newer: on ? "99.0.0" : null, failed: false, current: "0.0.0" }; },
  logState: async () => ({ on: localStorage.getItem("mock-log-off") !== "1", bytes: localStorage.getItem("mock-log-cleared") === "1" ? 0 : 18432, hideNames: localStorage.getItem("mock-log-hide") === "1" }),
  hideLogNames: async (hide: boolean) => { try { localStorage.setItem("mock-log-hide", hide ? "1" : "0"); } catch { /* storage unavailable */ } return { ok: true }; },
  setLog: async (on: boolean) => { try { localStorage.setItem("mock-log-off", on ? "0" : "1"); } catch { /* storage unavailable */ } return { ok: true }; },
  clearLog: async () => { try { localStorage.setItem("mock-log-cleared", "1"); } catch { /* storage unavailable */ } return { ok: true }; },
  deleteProjectFiles: async (p: string) => { const n = p.split(/[\\/]/).pop() ?? p; return { ok: true as const, backup: "removed" as const, backupName: n.replace(/\.[^.]+$/, "") + ".transcript.json", appMade: false, audio: "kept" as const, audioName: n }; },
  powerState: async () => ({ onBattery: location.search.includes("battery") }),
  // ?importpartial: a folder with one complete model, one cut short and the rest missing; otherwise a complete one
  importModels: async () => {
    await wait(400);
    const rows = ["tiny", "base", "small", "medium", "large-v3-turbo", "large-v3", "parakeet-v3", "diarization"];
    const partial = location.search.includes("importpartial");
    return { type: "done", imported: ["Systran/faster-whisper-small"], report: rows.map((id) => ({ id, state: id === "small" ? "imported" : partial && id === "medium" ? "incomplete" : partial && id === "diarization" ? "incomplete" : id === "diarization" || id === "base" ? "imported" : "missing" })) };
  },
  models: async (action: string, name?: string) => {
    if (action === "check") { await wait(300); return { type: "done", valid: true, kind: "read", username: "demo-user", repos: { "pyannote/speaker-diarization-3.1": true, "pyannote/segmentation-3.0": !location.search.includes("denied"), "pyannote/wespeaker-voxceleb-resnet34-LM": true } }; }
    if (action === "status") return { moonshine: { available: true, source: "download.moonshine.ai", license: "MIT", catalog: [{ id: "moonshine-en", language: "en", name: "English", bytes: 269141623 }, { id: "moonshine-de", language: "de", name: "German", bytes: 121800823 }, { id: "moonshine-ar", language: "ar", name: "Arabic", bytes: 32349411 }] }, fit: { engines: { "parakeet-v3": ["de", "en", "fr", "es", "ru", "uk", "pl", "it"] }, order: ["tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"], floor: { en: "tiny", de: "small", fr: "small", es: "small", fa: "medium", ar: "medium", hi: "medium", sw: "large-v3", am: "large-v3", ha: "large-v3" } }, llm: { available: !location.search.includes("nollm"), backend: "mlx", default: "qwen3-4b", catalog: llmCatalog.filter((m) => llmSt[m.id] || !m.retired).map(({ bytes: _b, retired: _r, ...m }) => m), translation: [{ id: "hy-mt2-1.8b", label: "Hy-MT2 1.8B", like: "Translates between 38 languages, including Arabic and Persian", languages: ["en", "de", "ar"], license: "Apache-2.0" }], models: { ...llmSt, "hy-mt2-1.8b": !!(llmSt as Record<string, boolean>)["hy-mt2-1.8b"] }, bytes: { ...Object.fromEntries(llmCatalog.map((m) => [m.id, m.bytes])), "hy-mt2-1.8b": 1.0175e9 } }, mlxAvailable: true, mlx: mlxSt, mlxSizes: { tiny: 74e6, base: 144e6, small: 481e6, medium: 1525e6, "large-v3-turbo": 1614e6, "large-v3": 3084e6 }, ...st, dir: "/Users/demo/Library/Application Support/Cassette/models", sizes };
    // ?damaged: one model fails the check until it is repaired
    if (action === "verify") {
      await wait(500);
      const have = Object.entries(st.whisper).filter(([, v]) => v).map(([k]) => k);
      return { type: "done", results: [...have.map((id) => ({ id, state: location.search.includes("damaged") && id === "small" && !repaired ? "damaged" : "ok", how: "recorded" })), ...(st.diarization ? [{ id: "diarization", state: "ok", how: "pinned" }] : [])].filter((r) => !name || r.id === name) };
    }
    if (action === "repair") { await wait(800); repaired = true; return { type: "done" }; }
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
  tokenSecure: async () => !location.search.includes("nokeyring"),
  token: async (v?: string) => { if (v !== undefined) token = v; return hint(); },
  exportTranscript: async (_p: unknown, f: string, n: string) => { await wait(200); console.log("export", f); return n.includes("fail") ? { ok: false, error: "Disk full" } : { ok: true, path: `/Users/demo/${n}.${f}` }; },
  exportText: async () => { await wait(100); return { ok: true, text: "**Anna** _0:00:00_\nHello.\n" }; },
  printPdf: async (n: string) => { await wait(200); console.log("print pdf"); return { ok: true, path: `/Users/demo/${n}.pdf` }; },
  translateLine: async () => { await wait(500); return { ok: true, text: "(English translation appears here)" }; },
  runLlm: async (kind: string, p: { language?: string; segments: { start: number; end: number; speaker: string; text: string; words: { start: number; end: number; word: string }[] }[] }, o: { clientId: string }) => {
    for (let i = 1; i <= 5; i++) { await wait(300); emit({ source: "llm", clientId: o.clientId, type: "progress", stage: kind, fraction: i / 5, message: "" }); }
    emit({ source: "llm", clientId: o.clientId, jobId: "llm1", type: "done" });
    if (location.search.includes("llmfail")) return { type: "error", message: "The language model is not downloaded yet." };
    if (kind === "ask") return { type: "done", answer: { text: "Der Gast sagt, dass das Projekt vor drei Jahren begann.\n- Er beantwortet danach die vorbereiteten Fragen.\n- Die erste Frage betrifft den weiteren Verlauf.", sources: [1, 4].filter((i) => i < p.segments.length), used: p.segments.length, total: p.segments.length } };
    if (kind === "summarize" && p.language === "en") return { type: "done", summary: { summary: "The team reviewed last week's actions. The fix shipped on Friday, the budget numbers are due on Wednesday and one access request is still waiting.", topics: [{ start: 0.5, title: "Last week's actions" }, { start: 14, title: "Blockers" }], decisions: [{ text: "Send the budget numbers by Wednesday", line: 1 }, { text: "Hire two designers in spring", line: null }], actions: [{ text: "Chase the access request today", owner: "Speaker 3", line: 2 }, { text: "Send the budget numbers by Wednesday", owner: "Speaker 3", line: 1 }] } };
    if (kind === "summarize") return { type: "done", summary: { summary: "Das Interview beginnt mit einer Begrüßung. Der Gast erzählt, dass das Projekt vor drei Jahren begann, und beantwortet vorbereitete Fragen zum weiteren Verlauf.", topics: [{ start: 0.5, title: "Begrüßung" }, { start: 9, title: "Beginn des Projekts" }], decisions: ["Das Interview wird mit der ersten vorbereiteten Frage fortgesetzt."], actions: [{ text: "Fragen zum Verlauf nach dem Projektstart beantworten", owner: "Gast" }] } };
    const pick = (i: number, a: number, b: number, score: number, reason: string) => { const s = p.segments[i], ws = s.words.slice(a, b + 1); return { start: ws[0].start, end: ws[ws.length - 1].end, text: ws.map((w) => w.word).join("").trim(), speaker: s.speaker, score, reason }; };
    return { type: "done", highlights: [pick(1, 0, 6, 8, "Eine warme, offene Antwort."), pick(4, 1, 6, 7, "Zeigt, wie alles anfing.")] };
  },
  exportClips: async (_i: string, clips: unknown[]) => { await wait(300); return { ok: true, count: clips.length, path: "/Users/demo/Interview highlights" }; },
  exportEpisode: async () => { await wait(300); if (location.search.includes("episodefail")) return { ok: false, path: "/Users/demo/Interview episode", failed: [{ file: "Interview markers.edl", kind: "locked" as const, message: "Permission denied" }], error: "Permission denied" }; return { ok: true, path: "/Users/demo/Interview episode", chapters: true, clips: 2, clipsSkipped: false }; },
  retryEpisode: async () => { await wait(300); return { ok: true, path: "/Users/demo/Interview episode", chapters: true, clips: 2, clipsSkipped: false }; },
  showEpisodeFolder: async () => {},
  saveClip: async () => "/Users/demo/clip.wav",
  reveal: async () => {},
  storageSizes: async () => ({ data: 2_400_000_000, projects: 48_000, recordings: 310_000_000, peaks: 120_000, partials: null, tmp: 0, models: 2_100_000_000, log: 9_000 }),
  saveEvidence: async () => ({ cancelled: true }),
  paths: async () => ({ models: "/Users/demo/Library/Application Support/Cassette/models", log: "/x/activity.log", token: "/x/t", data: "/x", projects: "/x/projects.json", recordings: "/x/recordings", peaks: "/x/peaks", tmp: "/x/tmp", system: { platform: "darwin", arch: "arm64", chip: "Apple M5 Pro", cores: 18, memGB: location.search.includes("lowmem") ? 4 : 48 } }),
  bundlePreview: async () => [{ name: "README.txt", text: "Cassette diagnostics\n", bytes: 21 }, { name: "system.txt", text: "App version: dev\n", bytes: 17 }],
  bundleSave: async () => ({ ok: true, path: "/Users/demo/cassette-diagnostics.zip" }),
  saveImage: async () => ({ ok: true, path: "/Users/demo/share-card.png" }),
  revealPath: async () => {},
  // dev only: ?backupfail=damaged makes both fail with that reason
  backupProject: async (p: { name?: string }) => { const f = new URLSearchParams(location.search).get("backupfail"); return f ? { ok: false as const, code: f } : { ok: true as const, path: `/Users/demo/${p.name ?? "Project"}.cassette-backup`, bytes: 31_400_000 }; },
  restoreProject: async () => { const f = new URLSearchParams(location.search).get("backupfail"); return f ? { ok: false as const, code: f } : { ok: true as const, project: { id: "restored-demo", name: "Restored interview", names: {}, result: null }, mediaPath: "/Users/demo/Restored interview.wav", bytes: 31_400_000 }; },
  // dev only: every recording has the same identity; ?relinkwrong makes the chosen file a different one, ?relinkfail makes it unreadable
  fingerprintFile: async (p: string) => (p.includes("broken") ? null : { size: 3_412_907, sample: /phone|corrupt/.test(p) ? "mock-" + p : "mock" }),
  locateRecording: async () => { const q = location.search; return q.includes("relinkfail") ? { ok: false as const } : { ok: true as const, path: "/Users/demo/moved/Interview 2026.wav", name: "Interview 2026.wav", source: { size: 3_412_907, sample: q.includes("relinkwrong") ? "other" : "mock" } }; },
  fileSize: async (p: string) => (p.includes("broken") ? null : 3_412_907),
  diskFree: async () => (location.search.includes("lowdisk") ? 2.1e9 : 48e9),
  openExternal: async () => true,
  onOpenFiles: (_cb: (paths: string[]) => void) => () => {},
  onEvent: (cb: Cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
};
