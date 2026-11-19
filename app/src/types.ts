import type { Api } from "../electron/preload";
import { t } from "./i18n";

declare global { interface Window { api: Api } const __APP_VERSION__: string }

export interface Word { start: number; end: number; word: string; speaker: string; prob?: number; /** The user confirmed this word is right (review mode), so it is no longer marked as unsure. */ checked?: boolean }
export interface Segment { start: number; end: number; speaker: string; text: string; words: Word[]; edited?: boolean; /** Translation of a line in another language (English unless `translationLang` says otherwise). */ translation?: string; translationLang?: string; marked?: boolean; overlap?: boolean; /** Language of this line when it differs from the recording (set by hand). */ lang?: string; chapter?: string; orig?: { text: string; words: Word[] } }
/** A passage worth quoting, as a stretch of the recording (so it survives editing, splitting and joining lines). `suggested` ones come from the language model and wait for the user to keep or dismiss them. */
export interface Highlight { id: string; start: number; end: number; text: string; speaker: string; ai?: boolean; suggested?: boolean; reason?: string }
/** What the language model wrote about the recording. The user can edit `summary`. */
/** A decision or action item. `line` is the index of its source line, null when the model gave no usable time. Summaries saved before #97 have plain strings and no `line` at all. */
export interface SummaryItem { text: string; line?: number | null }
export interface Summary { summary: string; topics: { start: number; title: string }[]; decisions: (string | SummaryItem)[]; actions: (SummaryItem & { owner: string | null })[]; model?: string; at?: number }
export interface Result { language: string; duration: number; speakers: string[]; segments: Segment[]; highlights?: Highlight[]; summary?: Summary }
export interface Options {
  model: string; language: string; numSpeakers: string; vad: boolean; prompt: string; noDiarize: boolean; device: string; autosave: boolean; /** Ask about projects older than this many days (undefined = never ask). The app never deletes by itself. */ retentionDays?: number; /** Mixed languages: undefined = automatic, true = always per speaker turn, false = off. */ multilingual?: boolean; /** Add an English translation under lines in other languages (undefined = on when the app is in English). */ translate?: boolean; /** Language code to translate lines into (undefined = English). Languages other than English need the translation model. */ translateTo?: string; /** Which speech model only finds the language: a size id, "same" (use the transcription model) or undefined (Tiny). */ detectModel?: string; /** Format the Export menu offers first in a project that has not been exported yet (a format id such as "docx"; undefined = none). */ defaultExport?: string; /** Formats the Export menu lists up front, as format ids (undefined = the default set; the rest stay under "More formats…"). Read it with normaliseShown. */ exportShown?: string[]; /** Ask the speech model to write hesitations (um, äh) down. */ verbatim?: boolean; /** Speech engine: "auto" (default) uses the Apple GPU when it can, "faster" always uses the CPU engine. */ whisperEngine?: "auto" | "faster"; minSpeakers?: string; maxSpeakers?: string; /** The look: "clean" (the default) or "sunset" (Fairytale sunset). Older saved settings used lookLevel 0–3 (and boring), which lookOf still reads. */ look?: "sunset" | "clean"; /** High contrast: stronger colours and heavier borders, in either look. */ contrast?: "standard" | "high"; lookLevel?: number; boring?: boolean; /** Light or dark: "system" (the default) follows the computer. */ colorScheme?: "system" | "light" | "dark"; /** Language of the app itself: "system" (match the computer, the default) or a language id. */ appLanguage?: "system" | "en" | "de" | "fr" | "es" | "ar" | "fa"; /** True once the user has dismissed the legend that explains dotted (unsure) words. */ unsureLegendSeen?: boolean; /** Zoom of the whole app (1 = normal). */ textSize?: number; /** Easy mode: fewer buttons (project list, transcript, play, edit, rename speaker, Print, Word). undefined = not chosen yet, which counts as off. */ easy?: boolean; /** Soft look: blurred glass on floating panels. "auto" (default) is on only with more than 6 GB of memory. */ soft?: "auto" | "on" | "off";
}
/** A language model the app offers for highlights and summaries. `label` is a model name; `like` is English text the app translates. */
export interface LlmModel { id: string; label: string; like: string; languages: string[]; license: string }
export interface ModelStatus {
  whisper: Record<string, boolean>; diarization: boolean; dir?: string;
  sizes?: { whisper: Record<string, number>; diarization: number };
  /** Apple Silicon only: true when the Parakeet speech engine can run here (it is then also listed in `whisper`). */
  parakeetAvailable?: boolean;
  /** Moonshine speech models (one language each). They are downloaded from Moonshine's own server, not Hugging Face. */
  moonshine?: { available: boolean; source: string; license: string; catalog: { id: string; language: string; name: string; bytes: number }[] };
  /** Apple Silicon only: the Apple GPU (MLX) versions of the models. */
  mlxAvailable?: boolean; mlx?: Record<string, boolean>; mlxSizes?: Record<string, number>;
  /** Which languages each Whisper size is reliable for: the size order and the smallest reasonable size per language code. */
  fit?: { order: string[]; floor: Record<string, string>; /** Models that know a fixed list of languages (Parakeet): the codes. */ engines?: Record<string, string[]> };
  /** The local language model (highlights and summaries). `available` is false when this build of the engine cannot run it. */
  llm?: { available: boolean; backend?: "mlx" | "gguf"; default?: string; catalog?: LlmModel[]; /** The translation model(s): shown under Translation, never offered for highlights. */ translation?: LlmModel[]; models?: Record<string, boolean>; bytes?: Record<string, number> };
}
/**
 * Turns a byte count into text using a given unit base. The bytes are always exact; only the label differs by system:
 * macOS and most Linux desktops (GNOME Files) count 1 GB = 1000³ bytes, Windows Explorer counts in 1024s but still writes "GB".
 */
export function formatBytes(n: number, base: 1000 | 1024): string {
  if (!(n > 0)) return "0";
  if (n >= base ** 3) return `${(n / base ** 3).toFixed(1)} GB`;
  if (n >= base ** 2) return `${Math.round(n / base ** 2)} MB`;
  return `${Math.max(1, Math.round(n / base))} KB`;
}
/** File sizes as this operating system would show them, so our numbers match Finder, Explorer or Files. */
export const bytes = (n: number) => formatBytes(n, SIZE_BASE);

/** Speaker colours per look and mode. Eight each, all clearly different from each other and none black or white (so no speaker looks like body text or the button). */
const PALETTES = {
  sunset: {
    light: ["#c8456f", "#d08a3e", "#7f64c9", "#2f8fd0", "#1f9d7a", "#c9a227", "#b84fb0", "#7a7f9e"],
    dark: ["#e5729a", "#e8a566", "#a58bff", "#5fb6f2", "#3fd0a8", "#e9c46a", "#e480d6", "#9ea3c0"],
    highLight: ["#a3174f", "#9a4a00", "#4b2bb8", "#0b5c9a", "#0b6347", "#7a5b00", "#8a1f80", "#444a66"],
    highDark: ["#ff8fb3", "#ffc27a", "#c9b8ff", "#8fd0ff", "#7ff0c8", "#ffe08a", "#ffa8ee", "#cfd3ea"],
  },
  clean: {
    light: ["#0a6577", "#c2410c", "#15803d", "#6d28d9", "#a21caf", "#a16207", "#be123c", "#52525b"],
    dark: ["#4cc2d4", "#f0a45e", "#a995ee", "#34d399", "#f472b6", "#c084fc", "#facc15", "#a1a1aa"],
    highLight: ["#0a4f63", "#9a3412", "#0b6b2c", "#5b21b6", "#7e1291", "#7a4a00", "#9f0f3a", "#3f3f46"],
    highDark: ["#7fd6e8", "#ffc27a", "#a8b4ff", "#6ee7b7", "#67e8f9", "#e0b4ff", "#fde047", "#d4d4d8"],
  },
} as const;
/** Speaker colours. Mutated in place by applyLook so every component that imports it picks up the current look. */
export const PALETTE: string[] = [...PALETTES.sunset.light];
export const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m)) + `:${String(sec).padStart(2, "0")}`;
};

/** Friendly default for engine ids like SPEAKER_00 -> "Speaker 1". */
export const defaultName = (id: string, speakers: string[]) => (/^SPEAKER_\d+$/.test(id) ? t("Speaker {n}", { n: Math.max(0, speakers.indexOf(id)) + 1 }) : id);
export const displayName = (id: string, speakers: string[], names: Record<string, string>) => names[id]?.trim() || defaultName(id, speakers);

export type ProjectStatus = "idle" | "queued" | "running" | "done" | "error";
/** What the last run did, shown in the Info tab. Filled from the engine's `done` event. */
export interface RunMeta {
  model?: string; device?: string; speakerDevice?: string; secondsSpeakers?: number; secondsTranscribe?: number; languageProb?: number; /** Seconds of speech per language, when each speaker turn was detected on its own. */ languages?: Record<string, number>; mixed?: boolean; translated?: number; finishedAt?: number;
}
export interface Project {
  id: string; path: string; name: string; addedAt: number; /** Last time the project was opened or edited (for retention; older saves have neither). */ openedAt?: number; editedAt?: number;
  result: Result | null; names: Record<string, string>;
  status: ProjectStatus; error?: string;
  /** Per-project overrides of the global options (language, model, number of speakers, skip silence, transcript only, vocabulary). */
  opts?: Partial<Options>;
  meta?: RunMeta;
  /** A run that redoes only part of an existing transcript (a line or a selection): the transcript stays on screen. Not saved. */
  partial?: boolean;
  /** Set when the engine stopped to suggest a better model for the language it heard. */
  fitAsk?: FitAsk;
  /** The transcript covers only the first minutes, run to check the settings before the whole recording. */
  trial?: boolean;
  /** The transcript this one replaced (one step back, so "Replace" can be undone). */
  previous?: { result: Result; names: Record<string, string>; meta?: RunMeta };
  /** The last successful export (format and the options it used), offered again as the first item of the Export menu. */
  lastExport?: LastExport;
}
export interface LastExport { format: string; options: Record<string, unknown> }
/** A line written down while the run is still going. Speakers are already known; the finished transcript replaces all of these. */
export interface DraftLine { start: number; end: number; speaker: string; text: string; lang?: string }
/** The model chosen for a recording is weak for the language heard at its start; the engine stopped before doing any work and the app asks what to do. Not saved. */
export interface FitAsk { language: string; probability: number; model: string; level: "weak" | "poor"; suggested: string; have: Record<string, boolean> }
export interface JobProgress { stage: string; fraction: number | null; message: string }
export const MEDIA_EXT = /\.(mp3|wav|m4a|flac|ogg|opus|aac|mp4|mov|mkv|webm)$/i;
export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;
export const stripExt = (n: string) => n.replace(/\.[^.]+$/, "");

/** OS-specific wording, so labels match what the user's system calls things. */
const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
export const IS_MAC = ua.includes("Macintosh");
export const IS_WIN = ua.includes("Windows");
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl+";
/** 1000 on macOS and Linux (decimal), 1024 on Windows (binary, still labelled KB/MB/GB). RAM is always shown in binary by every system, so it is not affected. */
export const SIZE_BASE: 1000 | 1024 = IS_WIN ? 1024 : 1000;
export const FILE_MANAGER = IS_MAC ? "Finder" : IS_WIN ? "File Explorer" : "file manager";

/**
 * Replace a line's text after the user fixed it. Word timings are kept when the number of words is unchanged
 * (a corrected word keeps its slot); otherwise the words are spread evenly over the line's time span.
 * The first original is remembered so the line can be reverted.
 */
export function retext(seg: Segment, raw: string): Segment {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text === seg.text) return seg;
  const tokens = text.split(" ");
  const orig = seg.orig ?? { text: seg.text, words: seg.words };
  let words: Word[];
  if (tokens.length === seg.words.length) {
    words = seg.words.map((w, i) => (w.word.trim() === tokens[i] ? w : { ...w, word: (w.word.match(/^\s*/) as RegExpMatchArray)[0] + tokens[i] + (w.word.match(/\s*$/) as RegExpMatchArray)[0], prob: 1 }));
  } else {
    const step = Math.max(seg.end - seg.start, 0.01) / tokens.length;
    words = tokens.map((t, i) => ({ start: seg.start + i * step, end: seg.start + (i + 1) * step, word: (i === 0 ? "" : " ") + t, speaker: seg.speaker, prob: 1 }));
  }
  const same = text === orig.text;
  return { ...seg, text, words, orig: same ? undefined : orig, edited: same ? undefined : true };
}

/** Put a line back to what the model heard. */
export function revertLine(seg: Segment): Segment {
  if (!seg.orig) return seg;
  const { orig, edited: _edited, ...rest } = seg;
  return { ...rest, text: orig.text, words: orig.words.map((w) => ({ ...w, speaker: seg.speaker })) };
}

/** Options the export dialog collects. They travel to the engine inside the transcript JSON as `options`. */
export interface ExportOpts { maxChars: number; maxLines: number; /** Shortest and longest a subtitle stays on screen, in seconds, and the gap kept between two subtitles. */ minDuration: number; maxDuration: number; minGap: number; speakerNames: boolean; offsetSeconds: number; fps: number; /** Drop-frame timecode (only meaningful at 29.97 and 59.94 fps). */ dropFrame?: boolean; startTimecode: string; /** Text exports: keep hesitations (verbatim, the default) or remove them. */ style: "verbatim" | "clean"; pauseMarks: boolean; timestamps: boolean; /** Spreadsheet (.csv) exports: add a BOM and defuse cells that start with = + - @, so Excel reads them right. */ excel: boolean; /** Text, Markdown, spreadsheet and Word exports: one last line with the app and engine versions, language and model (off by default). */ stamp: boolean }
export const DEFAULT_EXPORT_OPTS: ExportOpts = { maxChars: 42, maxLines: 2, minDuration: 1, maxDuration: 7, minGap: 0.083, speakerNames: true, offsetSeconds: 0, fps: 25, startTimecode: "01:00:00:00", style: "verbatim", pauseMarks: false, timestamps: true, stamp: false, excel: /Win/i.test(typeof navigator === "undefined" ? "" : navigator.platform) };
/** Default chapter title for a line: its first five words. */
export const chapterDefault = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 5).join(" ");

/** The two looks. They share every layout, shape and font: only colours differ. */
export const LOOKS = [
  { id: "sunset", name: "Fairytale sunset", caption: "Soft peach, rose and lilac. Warm and calm." },
  { id: "clean", name: "Clean", caption: "Flat and quiet: one blue-green accent." },
] as const;
export type LookId = (typeof LOOKS)[number]["id"];
type LookOpts = { look?: LookId; contrast?: "standard" | "high"; lookLevel?: number; boring?: boolean; /** Soft look (blurred glass on floating panels): "auto" (the default) turns it on only for computers with more than 6 GB of memory. */ soft?: "auto" | "on" | "off"; colorScheme?: "system" | "light" | "dark"; textSize?: number };
/** The chosen look. Settings saved before the two looks (lookLevel 0–3, or boring) map to sunset for 0–1 and Clean for 2–3. */
export const lookOf = (o: LookOpts): LookId => o.look === "clean" || o.look === "sunset" ? o.look : (o.lookLevel ?? (o.boring ? 2 : 3)) >= 2 ? "clean" : "sunset";
/** Dark when chosen, or when "system" and the computer is in dark mode. */
export const isDark = (o: LookOpts) => o.colorScheme === "dark" || (o.colorScheme !== "light" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
/** Sets the look (data-look), light or dark (data-mode) and contrast (data-contrast) on <html>, and picks speaker colours that read well on it. */
export const applyLook = (o: LookOpts) => {
  const look = lookOf(o), dark = isDark(o), high = o.contrast === "high", el = document.documentElement;
  el.dataset.look = look;
  el.dataset.mode = dark ? "dark" : "light";
  el.dataset.contrast = high ? "high" : "standard";
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory; // gigabytes, rounded; read on this computer, nothing is sent
  el.dataset.soft = !high && (o.soft === "on" || (o.soft !== "off" && (mem ?? 0) > 6)) ? "on" : "off";
  el.dataset.lite = mem !== undefined && mem <= 4 ? "on" : "off"; // 4 GB or less: no fade effects, nothing to repaint
  document.body.style.zoom = o.textSize && o.textSize !== 1 ? String(o.textSize) : "";
  el.style.setProperty("--zoom", String(o.textSize || 1)); // body zoom also scales position:fixed boxes, so they divide the viewport by it
  const p = PALETTES[look];
  PALETTE.splice(0, PALETTE.length, ...(high ? (dark ? p.highDark : p.highLight) : (dark ? p.dark : p.light)));
};

const joinText = (words: Word[]) => words.map((w) => w.word).join("").trim();

/** Split a line before word `k` (1 ≤ k < words). Both parts keep the speaker; the first keeps chapter and mark. Returns null if k is out of range. */
export function splitSegment(seg: Segment, k: number): [Segment, Segment] | null {
  if (!Number.isInteger(k) || k < 1 || k >= seg.words.length) return null;
  const a = seg.words.slice(0, k), b = seg.words.slice(k);
  const { orig: _o, ...rest } = seg;
  const second: Segment = { ...rest, chapter: undefined, marked: undefined, start: b[0].start, end: seg.end, words: b, text: joinText(b) };
  delete second.chapter; delete second.marked;
  return [{ ...rest, end: a[a.length - 1].end, words: a, text: joinText(a) }, second];
}

/** Join line `i` into the line before it (the previous line's speaker, chapter and mark win). Returns null for the first line. */
export function joinWithPrevious(segs: Segment[], i: number): Segment[] | null {
  if (i < 1 || i >= segs.length) return null;
  const prev = segs[i - 1], cur = segs[i];
  const words = [...prev.words, ...cur.words.map((w) => ({ ...w, speaker: prev.speaker }))];
  const { orig: _o, ...rest } = prev;
  const joined: Segment = { ...rest, end: cur.end, words, text: joinText(words), ...(prev.edited || cur.edited ? { edited: true } : {}) };
  return [...segs.slice(0, i - 1), joined, ...segs.slice(i + 1)];
}

/** Words the model was unsure of and the user has not checked yet. */
export const isUnsure = (w: Word) => (w.prob ?? 1) < 0.5 && !w.checked;
export interface UnsureRef { seg: number; word: number }
export function unsureWords(segs: Segment[]): UnsureRef[] {
  return segs.flatMap((s, seg) => s.words.flatMap((w, word) => (isUnsure(w) ? [{ seg, word }] : [])));
}

/** Review mode: the user confirmed the word. It stays as heard, and stops being marked. */
export function acceptWord(seg: Segment, j: number): Segment {
  return { ...seg, words: seg.words.map((w, k) => (k === j ? { ...w, checked: true } : w)) };
}

/**
 * Review mode: replace one word (an empty replacement removes it). Only that word changes: the other words keep their timing and
 * their "unsure" state, so fixing or removing one word never clears the others. A replacement of several words shares the old word's time slot.
 * "Put back what the model heard" works as for any edit.
 */
export function fixWord(seg: Segment, j: number, text: string): Segment {
  const w = seg.words[j];
  if (!w) return seg;
  const fixed = text.replace(/\s+/g, " ").trim();
  if (fixed === w.word.trim()) return acceptWord(seg, j);
  if (!fixed && seg.words.length === 1) return seg; // removing the only word would leave an empty line
  const lead = (w.word.match(/^\s*/) as RegExpMatchArray)[0], trail = (w.word.match(/\s*$/) as RegExpMatchArray)[0];
  const tokens = fixed ? fixed.split(" ") : [];
  const step = (w.end - w.start) / Math.max(tokens.length, 1);
  const made: Word[] = tokens.map((tk, i) => ({ ...w, start: w.start + i * step, end: w.start + (i + 1) * step, word: (i === 0 ? lead : " ") + tk + (i === tokens.length - 1 ? trail : ""), prob: 1, checked: undefined }));
  const words = [...seg.words.slice(0, j), ...made, ...seg.words.slice(j + 1)];
  const next = words.map((x) => x.word).join("").replace(/\s+/g, " ").trim();
  const orig = seg.orig ?? { text: seg.text, words: seg.words };
  const same = next === orig.text;
  return { ...seg, text: next, words, orig: same ? undefined : orig, edited: same ? undefined : true };
}

const wordsText = (words: Word[]) => words.map((w) => w.word).join("").trim();

/** A highlight over words `a`..`b` (inclusive) of a line. Null when the range is empty or outside the line. */
export function highlightOf(seg: Segment, a: number, b: number, extra: Partial<Highlight> = {}): Highlight | null {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const ws = seg.words.slice(Math.max(0, lo), hi + 1);
  if (!ws.length || !wordsText(ws)) return null;
  return { id: crypto.randomUUID(), start: ws[0].start, end: ws[ws.length - 1].end, text: wordsText(ws), speaker: seg.speaker, ...extra };
}

/** The words (first and last index) that a text selection of `from`..`to` characters of the line's text covers, whole words only. */
export function wordsInSelection(seg: Segment, from: number, to: number): [number, number] | null {
  const full = seg.words.map((w) => w.word).join(""), lead = full.length - full.trimStart().length;
  let pos = 0, first = -1, last = -1;
  seg.words.forEach((w, j) => {
    const lo = pos + (w.word.length - w.word.trimStart().length) - lead, hi = pos + w.word.trimEnd().length - lead;
    pos += w.word.length;
    if (hi > from && lo < to) { if (first < 0) first = j; last = j; }
  });
  return first < 0 ? null : [first, last];
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => Math.min(a.end, b.end) - Math.max(a.start, b.start) > 0.05;
/** Whether a word lies inside a highlight. */
export const wordIn = (w: Word, h: Highlight) => w.start >= h.start - 0.05 && w.end <= h.end + 0.05;

/** Adds a highlight unless the same stretch is already highlighted; a suggestion that the user highlights by hand becomes a kept one. Sorted by time. */
export function addHighlight(list: Highlight[], h: Highlight): Highlight[] {
  const same = list.find((x) => Math.abs(x.start - h.start) < 0.05 && Math.abs(x.end - h.end) < 0.05);
  if (same) return list.map((x) => (x === same ? { ...x, suggested: undefined } : x));
  return [...list, h].sort((a, b) => a.start - b.start);
}

/** New suggestions from the language model replace the old unanswered ones and skip stretches that are already highlighted. */
export function withSuggestions(list: Highlight[], found: Omit<Highlight, "id">[]): Highlight[] {
  const kept = list.filter((h) => !h.suggested);
  const fresh = found.filter((f) => !kept.some((k) => overlaps(k, f))).map((f) => ({ ...f, id: crypto.randomUUID(), ai: true, suggested: true }));
  return [...kept, ...fresh].sort((a, b) => a.start - b.start);
}
