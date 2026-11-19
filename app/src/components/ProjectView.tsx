import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import FitCard from "./FitCard";
import ReviewBar from "./ReviewBar";
import StartSheet, { TRIAL_SECONDS, spanText, useStartEstimate } from "./StartSheet";
import { assignToNamed } from "../speakerMenu";
import { toggleHeard, acceptWord, addHighlight, fixWord, highlightOf, unsureWords, withSuggestions, ExportOpts, LastExport, Options, DraftLine, IS_MAC, JobProgress, MOD_KEY, PALETTE, Project, Result, baseName, displayName, fmt, isUnsure, joinWithPrevious, retext, revertLine, splitSegment } from "../types";
import "../styles/project.css";
import ExportMenu from "./ExportMenu";
import { langName } from "../languages";
import { STYLED } from "./ExportMenu";
import AskTab, { AskItem } from "./AskTab";
import HighlightsTab, { LlmJob } from "./HighlightsTab";
import Inspector, { Moved, Tab, globalOpts, liveSpeakers } from "./Inspector";
import { Models } from "./useModels";
import Transcript from "./Transcript";
import { FIND_DEFAULTS, FindOpts, matcher, nearMisses } from "../find";
import { revealTurn, scrollToTurn } from "../windowing";
import Waveform, { WaveformHandle } from "./Waveform";
import VideoPreview from "./VideoPreview";
import { mediaKind } from "../projectActions";
import { Edge, dragEdge, FINE_STEP, nudgeStep, nudgeWord } from "../highlightBounds";
import { GoToTime, ShortcutSheet } from "./JumpDialogs";

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
const STAGE_ORDER = ["decode", "diarize", "transcribe", "merge"];

interface Props {
  project: Project; progress?: JobProgress; draft?: DraftLine[]; blocker: string; waiting: number; visible: boolean;
  nowPlayingId?: string | null; stopSignal?: number; onPlayingChange?(playing: boolean): void; onOpenSettings?(section?: string): void; models: Models;
  onTranscribe(range: [number, number] | null, line?: { language: string; speaker: string }, trial?: boolean, acceptFit?: boolean): void; onCancel(): void; onPatch(p: Partial<Project>, label?: string, merge?: boolean): void; onUndo(): string | null; onRedo(): string | null;
  othersWaiting?: number; onApplyToOthers?(o: Partial<Options>): void; onRemember?(o: Partial<Options>): void;
  /** The Settings default for the first Export menu item, and where to keep the last export (not an edit, so it leaves the retention date alone). */ defaultExport?: string; /** The formats the Export menu shows up front (Settings). */ exportShown?: string[]; onExported?(last: LastExport): void; /** The user has dismissed the explanation of dotted words. */ unsureLegendSeen?: boolean;
  /** Easy mode: no AI, review, chapters, clips, marks or extra exports. Turning it off brings them all back. */ easy?: boolean;
}

function Dialog({ title, children, cancel, confirm, onCancel, onConfirm }: { title: string; children: ReactNode; cancel: string; confirm: string; onCancel(): void; onConfirm(): void }) {
  const first = useRef<HTMLButtonElement>(null);
  const last = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    first.current?.focus();
    return () => before?.focus?.();
  }, []);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
    else if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === first.current) { e.preventDefault(); last.current?.focus(); }
      else if (!e.shiftKey && document.activeElement === last.current) { e.preventDefault(); first.current?.focus(); }
    }
  };
  return (
    <div className="scrim" onKeyDown={key}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <div className="row">
          <button ref={first} type="button" className="btn" onClick={onCancel}>{cancel}</button>
          <button ref={last} type="button" className="btn danger" onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
  );
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
export default function ProjectView({ project, progress, draft, blocker, waiting, visible, nowPlayingId, stopSignal = 0, onPlayingChange, onOpenSettings, models, onTranscribe, onCancel, onPatch, onUndo, onRedo, othersWaiting = 0, onApplyToOthers, onRemember, defaultExport, exportShown, onExported, unsureLegendSeen, easy = false }: Props) {
  const [renaming, setRenaming] = useState(false);
  const t = useT();
  const { result, names, path } = project;
  const player = useRef<WaveformHandle>(null);
  const [rate, setRate] = useState(() => { try { return Number(localStorage.getItem("playbackRate")) || 1; } catch { return 1; } });
  /** Move to the next (or previous) speed in SPEEDS; `wrap` goes round from the fastest back to the slowest, for the pill. */
  const stepRate = (dir: 1 | -1, wrap = false) => {
    const i = SPEEDS.findIndex((r) => r >= rate - 1e-9);
    const cur = i < 0 ? SPEEDS.length - 1 : i;
    const next = wrap ? (cur + dir + SPEEDS.length) % SPEEDS.length : Math.min(SPEEDS.length - 1, Math.max(0, cur + dir));
    chooseRate(SPEEDS[next]);
  };
  const chooseRate = (r: number) => { setRate(r); try { localStorage.setItem("playbackRate", String(r)); } catch { /* remembered speed is a convenience only */ } };
  const findBox = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const effOpts: Options = { ...globalOpts(), ...project.opts };
  const startInfo = useStartEstimate(effOpts, duration, models.busy);
  useEffect(() => { player.current?.setRate(rate); }, [rate, duration]);
  // ---- review mode: step through the words the model was unsure of
  const [review, setReview] = useState(false);
  const [jumpDialog, setJumpDialog] = useState<"keys" | "goto" | null>(null);
  const [announce, setAnnounce] = useState("");
  // View choice, remembered: show the language of every line, to spot a line the model tagged wrongly in a recording that is mostly one language.
  const [showLang, setShowLang] = useState(() => { try { return localStorage.getItem("showLineLanguage") === "1"; } catch { return false; } });
  const toggleLang = () => { const next = !showLang; setShowLang(next); try { localStorage.setItem("showLineLanguage", next ? "1" : "0"); } catch { /* storage unavailable: the choice lasts until the app closes */ } };
  const [rpos, setRpos] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const unsure = useMemo(() => (result ? unsureWords(result.segments) : []), [result]);
  const clipTimer = useRef<number | undefined>(undefined);
  const [translating, setTranslating] = useState<number | null>(null);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [playing, setPlayingState] = useState(false);
  const setPlaying = (p: boolean) => { setPlayingState(p); onPlayingChange?.(p); };
  // only one recording plays at a time: starting another one pauses this one; the app-wide Pause button stops whatever plays
  useEffect(() => { if (nowPlayingId && nowPlayingId !== project.id) player.current?.pause(); }, [nowPlayingId, project.id]);
  useEffect(() => { if (stopSignal) player.current?.pause(); }, [stopSignal]);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [mi, setMi] = useState(0);
  const [exportSignal, setExportSignal] = useState(0);
  const [moved, setMoved] = useState<Moved | null>(null);
  const [tab, setTab] = useState<Tab>("speakers");
  const [dialog, setDialog] = useState<"again" | "stop" | null>(null);
  const [details, setDetails] = useState(false);
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(""), 2800); };
  // ---- player: the strip stays one row; "Details" folds the speaker and clip tools out below it, and remembers its state
  const [dockOpen, setDockOpen] = useState(() => { try { return localStorage.getItem("dockOpen") === "1"; } catch { return false; } });
  const toggleDock = () => setDockOpen((o) => { const n = !o; try { localStorage.setItem("dockOpen", n ? "1" : "0"); } catch { /* remembered state is a convenience only */ } return n; });
  const [clipStart, setClipStart] = useState<number | null>(null);
  const turns = result?.segments ?? [];
  const nowTurn = turns.find((s) => time >= s.start && time <= s.end);
  const nowName = nowTurn && result ? displayName(nowTurn.speaker, result.speakers, names) : "";
  const nowColor = nowTurn && result ? PALETTE[Math.max(0, result.speakers.indexOf(nowTurn.speaker)) % PALETTE.length] : "";
  const prevTurn = () => { const p = [...turns].reverse().find((s) => s.start < time - 1.5); player.current?.seek(p ? p.start : 0); };
  const nextTurn = () => { const n = turns.find((s) => s.start > time + 0.05); if (n) player.current?.seek(n.start); };
  const replayTurn = () => { const c = [...turns].reverse().find((s) => s.start <= time); player.current?.seek(c ? c.start : 0); };
  const copyTime = async () => {
    const text = `[${fmt(time)}]${nowName ? " " + nowName : ""}`;
    try { await navigator.clipboard.writeText(text); flash(t("Copied {text}", { text })); } catch { flash(text); }
  };
  const markStart = () => { setClipStart(time); flash(t("Clip start marked at {time}", { time: fmt(time) })); };
  const markEnd = () => { if (clipStart === null || time <= clipStart) { flash(t("Mark the clip start first")); return; } player.current?.markClip(clipStart, time); flash(t("Clip marked from {from} to {to}. Press S to save it.", { from: fmt(clipStart), to: fmt(time) })); setClipStart(null); };

  // ---- highlights and summary (the language model runs on this computer, in the engine)
  const [llmJob, setLlmJob] = useState<LlmJob | null>(null);
  const [llmError, setLlmError] = useState("");
  const llmId = useRef("");
  const resultRef = useRef(result);
  resultRef.current = result;
  /** Changes the result as it is *now*: a language-model job can finish minutes after it started, and must not undo edits made meanwhile. */
  const patchResult = (f: (r: Result) => Result) => { const r = resultRef.current; if (r) onPatch({ result: f(r) }); };
  // Trimming a highlight: drag handles on the waveform, or buttons. The saved clip, playback and exports read the highlight, so they follow. Each move can be undone.
  const [trimId, setTrimId] = useState<string | null>(null);
  const trimHl = trimId ? (result?.highlights ?? []).find((x) => x.id === trimId) ?? null : null;
  const moveEdge = (id: string, edge: Edge, f: (h: import("../types").Highlight, segs: import("../types").Segment[], dur: number) => import("../types").Highlight | null, merge: boolean) => {
    const r = resultRef.current, h = r?.highlights?.find((x) => x.id === id);
    if (!r || !h) return;
    const next = f(h, r.segments, duration || r.duration || 0);
    if (!next) { flash(edge === "start" ? t("The start can't move any further") : t("The end can't move any further")); return; }
    patchResultLabeled((x) => ({ ...x, highlights: (x.highlights ?? []).map((y) => (y.id === id ? next : y)) }), t("trim a highlight"), merge);
    flash(edge === "start" ? t("Start moved to {time}", { time: fmt(next.start) }) : t("End moved to {time}", { time: fmt(next.end) }));
  };
  const patchResultLabeled = (f: (r: Result) => Result, label: string, merge: boolean) => { const r = resultRef.current; if (r) onPatch({ result: f(r) }, label, merge); };
  const adjustHl = (id: string, edge: Edge, by: "word" | "fine", dir: -1 | 1) =>
    moveEdge(id, edge, (h, segs, dur) => (by === "word" ? nudgeWord(segs, h, edge, dir, dur) : nudgeStep(segs, h, edge, dir * FINE_STEP, dur)), false);
  const dragHl = (id: string, a: number, b: number) => {
    const h = resultRef.current?.highlights?.find((x) => x.id === id);
    if (!h) return;
    const edge: Edge = Math.abs(a - h.start) >= Math.abs(b - h.end) ? "start" : "end";
    if (Math.abs(a - h.start) < 0.001 && Math.abs(b - h.end) < 0.001) return;
    moveEdge(id, edge, (x, segs, dur) => dragEdge(segs, x, edge, edge === "start" ? a : b, dur), false);
  };
  useEffect(() => window.api.onEvent((e) => {
    if (e.source !== "llm" || e.clientId !== project.id || e.type !== "progress") return;
    setLlmJob((j) => (j ? { ...j, fraction: typeof e.fraction === "number" ? e.fraction : null, message: String(e.message ?? "") } : j));
  }), [project.id]);
  const runLlm = async (kind: LlmJob["kind"], model: string) => {
    if (!result || llmJob) return;
    const jobId = `llm-${project.id}-${Date.now()}`;
    llmId.current = jobId;
    setLlmError(""); setLlmJob({ kind, fraction: null, message: "" });
    const body = { language: result.language, speakers: Object.fromEntries(result.speakers.map((s) => [s, displayName(s, result.speakers, names)])),
      segments: result.segments.map(({ start, end, speaker, text, words }) => ({ start, end, speaker, text, words: words.map(({ start, end, word }) => ({ start, end, word })) })) };
    const r = await window.api.runLlm(kind, body, { jobId, clientId: project.id, model }).catch((e: unknown) => ({ type: "error", message: String(e) } as { type: string; message?: string; cancelled?: boolean; highlights?: unknown[]; summary?: unknown }));
    setLlmJob(null);
    if (r?.cancelled) return;
    if (r?.type !== "done") { setLlmError(t("The language model could not finish: {reason}", { reason: String(r?.message ?? "").slice(0, 240) })); return; }
    if (kind === "highlights") {
      const found = (r.highlights ?? []) as Omit<import("../types").Highlight, "id">[];
      patchResult((x) => ({ ...x, highlights: withSuggestions(x.highlights ?? [], found) }));
      if (!found.length) flash(t("Nothing stood out. Try the better model, or highlight by hand."));
    } else patchResult((x) => ({ ...x, summary: { ...(r.summary as import("../types").Summary), model, at: Date.now() } }));
  };
  // ---- questions about this transcript (same language model, same one-job-at-a-time slot)
  const [askThread, setAskThread] = useState<AskItem[]>([]);
  const askSeq = useRef(0);
  const askStopped = useRef(false);
  const runAsk = async (question: string, model: string) => {
    if (!result || llmJob) return;
    const id = ++askSeq.current;
    const jobId = `llm-${project.id}-${Date.now()}`;
    llmId.current = jobId; askStopped.current = false;
    const history = askThread.filter((x) => x.answer).map((x) => ({ q: x.q, a: x.answer!.text }));
    setAskThread((th) => [...th, { id, q: question }]); setLlmError(""); setLlmJob({ kind: "ask", fraction: null, message: "" });
    const body = { language: result.language, speakers: Object.fromEntries(result.speakers.map((s) => [s, displayName(s, result.speakers, names)])), question, history,
      segments: result.segments.map(({ start, end, speaker, text }) => ({ start, end, speaker, text, words: [] })) };
    const r = await window.api.runLlm("ask", body, { jobId, clientId: project.id, model }).catch((e: unknown) => ({ type: "error", message: String(e) } as { type: string; message?: string; cancelled?: boolean; answer?: unknown }));
    setLlmJob(null);
    if (r?.cancelled || askStopped.current) { setAskThread((th) => th.filter((x) => x.id !== id)); return; }
    const answer = r?.type === "done" ? (r.answer as AskItem["answer"]) : undefined;
    setAskThread((th) => th.map((x) => (x.id !== id ? x : answer?.text ? { ...x, answer } : { ...x, error: t("The language model could not finish: {reason}", { reason: String(r?.message || "").slice(0, 240) }) })));
  };
  const showLine = (i: number) => {
    const seg = result?.segments[i];
    if (!seg) return;
    void revealTurn(i);
    player.current?.seek(seg.start);
  };
  const highlights = result?.highlights ?? [];
  const keptHighlights = highlights.filter((h) => !h.suggested);
  /** The highlight whose Play was pressed last: its card shows progress while the audio plays. */
  const [hlClip, setHlClip] = useState<{ start: number; end: number } | null>(null);
  const playRange = (start: number, end: number) => {
    window.clearTimeout(clipTimer.current);
    setHlClip({ start, end });
    player.current?.seek(Math.max(0, start - 0.2));
    clipTimer.current = window.setTimeout(() => player.current?.pause(), Math.max(400, ((end + 0.2 - start) / rate) * 1000));
  };
  const saveClips = async (format: string) => {
    const r = await window.api.exportClips(path, keptHighlights.map((h) => ({ start: h.start, end: h.end, speaker: displayName(h.speaker, result!.speakers, names) })), format, project.name).catch((e: unknown) => ({ ok: false, error: String(e) } as { ok?: boolean; cancelled?: boolean; count?: number; error?: string }));
    if (r.cancelled) return;
    flash(r.ok ? (r.count === 1 ? t("Saved 1 audio clip ✓") : t("Saved {count} audio clips ✓", { count: r.count ?? 0 })) : t("Saving the clips failed: {reason}", { reason: r.error ?? "" }));
  };

  const running = project.status === "running" || project.status === "queued";
  /** Redoing one line or a selection: keep the transcript on screen and show a slim banner instead of the full progress page. */
  const partial = running && !!project.partial && !!result;
  const busy = running && !partial;
  const failed = project.status === "error";
  const showResult = !!result && !busy;
  const [findOpts, setFindOpts] = useState<FindOpts>(FIND_DEFAULTS);
  const fm = useMemo(() => matcher(query, findOpts), [query, findOpts]);
  const q = fm.q;
  const matches = useMemo(() => (result && q ? result.segments.flatMap((s, i) => (fm.test(s.text) ? [i] : [])) : []), [result, q, fm]);
  /** With no hits, words that nearly fit what was typed, so a search for "deutsche" can offer "Deutsch". */
  const nearby = useMemo(() => (result && q && !matches.length ? nearMisses(result.segments.map((s) => s.text), query.trim()) : []), [result, q, matches, query]);
  useEffect(() => setMi(0), [q, findOpts]);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceWith, setReplaceWith] = useState("");
  const panelFind = useRef<HTMLInputElement>(null);
  const panelWith = useRef<HTMLInputElement>(null);
  useEffect(() => { if (replaceOpen) (query.trim() ? panelWith : panelFind).current?.focus(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaceOpen]);
  /** How many times the text occurs, over all matching lines (a line can hold it more than once). */
  const occurrences = useMemo(() => (result && q ? matches.reduce((n, i) => n + fm.count(result.segments[i].text), 0) : 0), [result, q, matches, fm]);
  /** Replace all asks for one more click and shows every line it would change. */
  const [confirmAll, setConfirmAll] = useState(false);
  useEffect(() => setConfirmAll(false), [q, findOpts, replaceWith, replaceOpen]);
  /** Swap every occurrence of the search text in the given lines (case is ignored, the replacement is taken literally). Edited lines can be put back like any other edit. */
  const replaceIn = (lines: number[]) => {
    if (!result || !q || !lines.length) return;
    const todo = new Set(lines);
    let n = 0;
    const segments = result.segments.map((s, k) => {
      if (!todo.has(k)) return s;
      const r = fm.replace(s.text, replaceWith);
      n += r.n;
      return retext(s, r.text);
    });
    onPatch({ result: { ...result, segments } }, lines.length > 1 ? t("replace all") : t("replace in a line"));
    setConfirmAll(false);
    flash(n === 1 ? t("Replaced 1 time") : t("Replaced {count} times", { count: n }));
  };
  const step = (d: number) => matches.length && setMi((mi + d + matches.length) % matches.length);
  useEffect(() => { if (!busy) setDialog(null); }, [busy]);

  // what the stage list shows: remember how long each finished stage took and what the speaker step found
  const stages = useRef<Record<string, { start: number; end?: number }>>({});
  const found = useRef<number | null>(null);
  const eta = useRef<{ t0: number; shown: string }>({ t0: 0, shown: "" });
  const stage = progress?.stage;
  useEffect(() => {
    if (project.status === "idle" || project.status === "done" || failed) { stages.current = {}; found.current = null; return; }
    if (!stage) return;
    const now = Date.now(), cur = stages.current;
    for (const [k, v] of Object.entries(cur)) if (k !== stage && v.end == null) v.end = now;
    cur[stage] ??= { start: now };
    if (stage === "transcribe") eta.current = { t0: cur[stage].start, shown: "" };
  }, [stage, project.status, failed]);
  if (stage === "diarize") { const n = /Found (\d+)/.exec(progress?.message ?? ""); if (n) found.current = Number(n[1]); }

  /** Not typing in a field, no menu or dialog open: the shortcut keys that are plain letters only act then. */
  const quietTarget = (target: EventTarget | null) => !typing(target) && !document.querySelector("[role=dialog], [role=alertdialog]") && !(target instanceof HTMLElement && target.closest("[role=menu]"));
  /** The line the user is on: the focused one, else the one playing now. */
  const currentLine = () => {
    const el = (document.activeElement as HTMLElement | null)?.closest?.("[data-turn]");
    if (el) return Number(el.getAttribute("data-turn"));
    let k = 0; result?.segments.forEach((s, i) => { if (s.start <= time + 0.05) k = i; });
    return k;
  };
  /** Move to a line without playing it: the screen reader hears who speaks and what, and the line scrolls into view. */
  const goToLine = (i: number) => {
    if (!result) return;
    const seg = result.segments[i];
    player.current?.seek(seg.start, false);
    void scrollToTurn(i);
    setAnnounce(t("Line {n} of {total}. {speaker}, {time}. {text}", { n: i + 1, total: result.segments.length, speaker: displayName(seg.speaker, result.speakers, project.names), time: fmt(seg.start), text: seg.text }));
  };
  const jumpSpeaker = (dir: 1 | -1) => {
    if (!result) return;
    const segs = result.segments, cur = currentLine();
    for (let i = cur + dir; i >= 0 && i < segs.length; i += dir) if (segs[i].speaker !== segs[cur].speaker) { goToLine(i); return; }
    setAnnounce(dir === 1 ? t("No later line from a different speaker.") : t("No earlier line from a different speaker."));
  };
  /** Jump to the next or previous line that has a flag: an overlap, a mark or a chapter. */
  /** Mark or unmark line `i` as heard against the audio (one undo step), and say so for screen readers. */
  const toggleHeardAt = (i: number) => {
    if (!result || !result.segments[i]) return;
    const on = !result.segments[i].heard;
    onPatch({ result: { ...result, segments: toggleHeard(result.segments, i) } }, on ? t("mark a line as heard") : t("unmark a line as heard"));
    setAnnounce(on ? t("Line at {time} marked as heard", { time: fmt(result.segments[i].start) }) : t("Line at {time} no longer marked as heard", { time: fmt(result.segments[i].start) }));
  };
  const jumpFlag = (kind: "overlap" | "marked" | "chapter", dir: 1 | -1) => {
    if (!result) return;
    const segs = result.segments, cur = currentLine();
    const has = (s: (typeof segs)[number]) => kind === "overlap" ? !!s.overlap : kind === "marked" ? !!s.marked : !!s.chapter?.trim();
    for (let i = cur + dir; i >= 0 && i < segs.length; i += dir) if (has(segs[i])) { goToLine(i); return; }
    const none = {
      overlap: [t("No later overlap."), t("No earlier overlap."), t("There are no overlaps in this transcript.")],
      marked: [t("No later marked line."), t("No earlier marked line."), t("No line is marked yet.")],
      chapter: [t("No later chapter."), t("No earlier chapter."), t("There are no chapters yet.")],
    }[kind];
    setAnnounce(segs.some(has) ? (dir === 1 ? none[0] : none[1]) : none[2]);
  };
  const goToTime = (seconds: number) => {
    setJumpDialog(null);
    if (!result) return;
    let k = 0; result.segments.forEach((s, i) => { if (s.start <= seconds + 0.05) k = i; });
    window.setTimeout(() => goToLine(k), 0); // after the dialog has closed and focus is back
  };

  useEffect(() => {
    if (!visible) return;
    const key = (e: KeyboardEvent) => {
      if (dialog || jumpDialog) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && showResult && !busy && quietTarget(e.target) && (e.key.toLowerCase() === "z" || (!IS_MAC && !e.shiftKey && e.key.toLowerCase() === "y"))) {
        // undo and redo of transcript edits; while typing in a field the browser's own undo is left alone
        e.preventDefault();
        const redo = e.key.toLowerCase() === "y" || e.shiftKey;
        const what = redo ? onRedo() : onUndo();
        if (what === null) { setAnnounce(redo ? t("Nothing to redo") : t("Nothing to undo")); return; }
        setMoved(null);
        setAnnounce(what ? (redo ? t("Redone: {what}", { what }) : t("Undone: {what}", { what })) : redo ? t("Redone") : t("Undone"));
      }
      else if (mod && e.key.toLowerCase() === "e" && showResult) { e.preventDefault(); setExportSignal((n) => n + 1); }
      else if (mod && e.key.toLowerCase() === "f" && showResult) { e.preventDefault(); findBox.current?.focus(); findBox.current?.select(); }
      else if (!mod && !e.altKey && showResult && !busy && (e.key === "?" || (e.key === "/" && e.shiftKey) || /^[ng]$/i.test(e.key) && !(e.shiftKey && e.key.toLowerCase() === "g")) && quietTarget(e.target)) {
        e.preventDefault();
        if (e.key === "?" || e.key === "/") setJumpDialog("keys");
        else if (e.key.toLowerCase() === "g") setJumpDialog("goto");
        else jumpSpeaker(e.key === "N" || e.shiftKey ? -1 : 1);
      }
      else if (!mod && !e.altKey && showResult && !busy && !e.shiftKey && (easy ? /^[,.]$/ : /^[[\],.s]$/i).test(e.key) && quietTarget(e.target)) {
        // clips by keyboard: [ starts a clip at the playhead, ] ends it, S saves it; , and . move the playhead half a second
        e.preventDefault();
        if (e.key === "[") markStart();
        else if (e.key === "]") markEnd();
        else if (e.key === ",") { player.current?.skip(-0.5); }
        else if (e.key === ".") { player.current?.skip(0.5); }
        else if (sel) void window.api.saveClip(path, sel[0], sel[1]).then((ok) => { if (ok) flash(t("Clip saved ✓")); });
        else flash(t("Mark a clip first: [ for the start, ] for the end"));
      }
      else if (!mod && !e.altKey && showResult && !busy && !easy && /^[omcrh]$/i.test(e.key) && quietTarget(e.target)) {
        e.preventDefault();
        if (e.key.toLowerCase() === "h") { if (!e.shiftKey) toggleHeardAt(currentLine()); return; }
        if (e.key.toLowerCase() === "r") { if (!review && unsure.length > 0) startReview(); }
        else jumpFlag(e.key.toLowerCase() === "o" ? "overlap" : e.key.toLowerCase() === "m" ? "marked" : "chapter", e.shiftKey ? -1 : 1);
      }
      else if (!mod && !e.altKey && !busy && (e.key === "<" || e.key === ">") && !typing(e.target) && !document.querySelector("[role=dialog], [role=alertdialog]") && !(e.target instanceof HTMLElement && e.target.closest("[role=menu]"))) {
        e.preventDefault();
        stepRate(e.key === ">" ? 1 : -1);
      }
      else if (!mod && !e.altKey && !e.shiftKey && !busy && /^[jkl]$/i.test(e.key) && !typing(e.target) && !document.querySelector("[role=dialog], [role=alertdialog]") && !(e.target instanceof HTMLElement && e.target.closest("[role=menu]"))) {
        e.preventDefault();
        const k = e.key.toLowerCase();
        if (k === "k") player.current?.toggle(); else player.current?.skip(k === "j" ? -10 : 10);
      }
      else if (e.key === " " && !busy && !typing(e.target) && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLElement && e.target.closest("[role=menu]"))) { e.preventDefault(); player.current?.toggle(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [visible, showResult, busy, dialog, jumpDialog, time, result, sel, clipStart, path, review, unsure, rate, easy]); // eslint-disable-line react-hooks/exhaustive-deps

  const payload = (format = "", options?: ExportOpts) => ({
    segments: result!.segments.map(({ words, orig, edited, ...s }) => (["srt", "vtt", "edl", "episode"].includes(format) || (options?.pauseMarks && STYLED.has(format)) ? { ...s, edited, words: words.map(({ start, end, word }) => ({ start, end, word })) } : format === "changes" ? { ...s, orig: orig && { text: orig.text } } : s)),
    ...(options ? { options } : {}), app: __APP_VERSION__, meta: project.meta, highlights: keptHighlights.map(({ id: _id, suggested: _s, ...h }) => h), summary: result!.summary, language: result!.language, speakers: Object.fromEntries(result!.speakers.map((s) => [s, displayName(s, result!.speakers, names)])),
  });
  const setSpeaker = (idx: number | null, from: string, to: string) => {
    if (!result) return;
    const segments = result.segments.map((s, k) => (idx === null ? s.speaker === from : k === idx) ? { ...s, speaker: to, words: s.words.map((w) => ({ ...w, speaker: to })) } : s);
    onPatch({ result: { ...result, segments } }, t("change speaker"));
  };
  function reassign(i: number, to: string) {
    if (!result) return;
    const from = result.segments[i].speaker;
    if (from === to) return;
    setSpeaker(i, from, to);
    setMoved({ from, to, idx: i });
    setAnnounce(t("Line at {time} now said by {name}", { time: fmt(result.segments[i].start), name: displayName(to, result.speakers, names) }));
  }
  /** A new speaker (or, when the name is taken, the existing one) gets the line. Speakers, names and the line change in one edit, so one Undo takes it all back. */
  function newSpeaker(i: number, typed: string) {
    if (!result) return;
    const out = assignToNamed(result, names, i, typed, (id) => displayName(id, result.speakers, names));
    if (!out) return;
    const time = fmt(result.segments[i].start), who = displayName(out.id, out.result.speakers, out.names);
    if (out.id === result.segments[i].speaker) { setAnnounce(t("Line at {time} is already said by {name}", { time, name: who })); return; }
    onPatch({ result: out.result, names: out.names }, out.created ? t("add a speaker and give them a line") : t("change speaker"));
    setMoved(null);
    setAnnounce(out.created ? t("Added speaker {name}. They now say the line at {time}", { time, name: who }) : t("Line at {time} now said by {name}", { time, name: who }));
  }
  function moveAll() {
    if (!result || !moved) return;
    const segments = result.segments.map((s) => (s.speaker === moved.from ? { ...s, speaker: moved.to, words: s.words.map((w) => ({ ...w, speaker: moved.to })) } : s));
    onPatch({ result: { ...result, segments, speakers: result.speakers.filter((x) => x !== moved.from) } }, t("move lines to a speaker"));
    flash(t("Moved the remaining lines to {name}", { name: displayName(moved.to, result.speakers, names) }));
    setMoved(null);
  }
  function undo() {
    if (!moved) return;
    setSpeaker(moved.idx, moved.to, moved.from);
    setMoved(null);
  }
  const canTranscribe = !running && !blocker;
  const reviewAt = review ? unsure[rpos] ?? null : null;
  const playAround = (ref: { seg: number; word: number } | null | undefined) => {
    window.clearTimeout(clipTimer.current);
    const w = ref && result?.segments[ref.seg]?.words[ref.word];
    if (!w) return;
    const from = Math.max(0, w.start - 1.2);
    player.current?.seek(from);
    clipTimer.current = window.setTimeout(() => player.current?.pause(), Math.max(400, ((w.end + 0.3 - from) / rate) * 1000));
  };
  const patchSeg = (i: number, f: (s: import("../types").Segment) => import("../types").Segment) => result && onPatch({ result: { ...result, segments: result.segments.map((s, k) => (k === i ? f(s) : s)) } }, t("review words"));
  const startReview = () => { setReviewTotal(unsure.length); setRpos(0); setReview(true); };
  const endReview = () => { window.clearTimeout(clipTimer.current); player.current?.pause(); setReview(false); };
  useEffect(() => { // bring the word into view and play the bit around it whenever the word under review changes
    if (!review || !reviewAt) return;
    const show = window.setTimeout(() => void scrollToTurn(reviewAt.seg), 80); // after the card has taken its space
    playAround(reviewAt);
    return () => { window.clearTimeout(clipTimer.current); window.clearTimeout(show); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, reviewAt?.seg, reviewAt?.word]);
  useEffect(() => { if (busy) setReview(false); }, [busy]);
  useEffect(() => { if (!visible) { window.clearTimeout(clipTimer.current); player.current?.pause(); } }, [visible]); // leaving the screen keeps the review where it was; only the sound stops
  const again = () => { if (result) setDialog("again"); else onTranscribe(null); };
  const replace = () => { setDialog(null); setMoved(null); setQuery(""); onTranscribe(null); };
  const restore = () => {
    const prev = project.previous;
    if (!prev) return;
    setMoved(null); setQuery("");
    onPatch({ result: prev.result, names: prev.names, meta: prev.meta, previous: undefined, trial: undefined }, t("restore the earlier transcript"));
    if (globalOpts().autosave) void window.api.saveSidecar(project.path, { source: baseName(project.path), language: prev.result.language, duration: prev.result.duration, speakers: Object.fromEntries(prev.result.speakers.map((sp) => [sp, displayName(sp, prev.result.speakers, prev.names)])), segments: prev.result.segments.map(({ words: _w, orig: _o, edited: _e, ...s }) => s) });
  };

  const live = liveSpeakers(project).length;
  const lang = result ? (Object.keys(project.meta?.languages ?? {}).length > 1 ? t("Mixed languages") : langName(result.language)) : "";
  const count = (n: number) => (n === 1 ? t("{count} speaker", { count: n }) : t("{count} speakers", { count: n }));
  const sub = running ? (project.status === "queued" ? t("Waiting in line") : partial ? t("Redoing part of the transcript…") : "")
    : result ? [lang, fmt(result.duration), count(live), globalOpts().autosave ? t("Saved in this app and next to the audio") : t("Saved in this app")].join(" · ")
    : t("Not transcribed yet");
  const hitLabel = !q ? "" : matches.length ? t("{current} of {total}", { current: mi + 1, total: matches.length }) : t("No matches");

  // ---- the three non-transcript states
  // An engine that was stopped or ran out of memory is not the file's fault: say so, and say what to try.
  const engineStopped = /Engine exited|exit code|MemoryError|out of memory|bad_alloc|access violation|SIG(KILL|SEGV|ABRT)|killed/i.test(project.error ?? "");
  const errorCard = (
    <div className="card pv-err" role="alert">
      <h2><span className="pv-tag">{t("Transcription")}</span>{t("Couldn't transcribe “{name}”", { name: project.name })}</h2>
      <p>{engineStopped
        ? t("The speech engine stopped before it finished. This often means the computer ran out of memory: close other programs, or choose a smaller size under Options, then try again. The recording itself is untouched.")
        : t("The file may be damaged, or in a format the app can't read. The recording itself is untouched, and the other projects in the list keep going.")}</p>
      {details && <pre className="pv-details">{project.error || t("No further details were reported.")}</pre>}
      <div className="pv-actions">
        <button type="button" className="btn sun" disabled={!canTranscribe} onClick={() => onTranscribe(null)}>{t("Try again")}</button>
        <button type="button" className="btn" aria-expanded={details} onClick={() => setDetails(!details)}>{details ? t("Hide details") : t("Show details")}</button>
      </div>
      {blocker && <p className="pv-blocker">{blocker}</p>}
    </div>
  );

  const fitCard = project.fitAsk && (
    <FitCard ask={project.fitAsk} models={models} onDismiss={() => onPatch({ fitAsk: undefined })} onContinue={() => onTranscribe(null, undefined, undefined, true)}
      onUse={(model) => { onPatch({ opts: { ...project.opts, model } }); onTranscribe(null); }} />
  );
  let body: ReactNode;
  if (busy) {
    const cur = project.status === "queued" ? -1 : Math.max(0, STAGE_ORDER.indexOf(stage ?? "decode"));
    const skipSpeakers = !!({ ...globalOpts(), ...project.opts }).noDiarize;
    const list = STAGE_ORDER.map((k, i) => ({ k, i })).filter(({ k }) => !(skipSpeakers && (k === "diarize" || k === "merge")));
    const took = (k: string) => { const st = stages.current[k]; return st?.end ? Math.max(1, Math.round((st.end - st.start) / 1000)) : null; };
    const pct = Math.round((progress?.stage === "transcribe" ? progress.fraction ?? 0 : cur > 2 ? 1 : 0) * 100);
    const title = (k: string, i: number) => k === "decode" ? t("Prepared the audio") : k === "diarize" ? (found.current ? (found.current === 1 ? t("Found {count} speaker", { count: found.current }) : t("Found {count} speakers", { count: found.current })) : i < cur ? t("Found the speakers") : t("Finding the speakers"))
      : k === "transcribe" ? t("Writing the words down") : t("Matching words to speakers");
    const left = (() => {
      const f = progress?.fraction;
      if (stage !== "transcribe" || f == null || f <= 0.05 || !eta.current.t0) return "";
      const min = Math.ceil(((Date.now() - eta.current.t0) / 1000) * ((1 - f) / f) / 60);
      return min <= 1 ? t("less than a minute left") : t("about {min} min left", { min });
    })();
    const subtitle = (k: string, i: number) => {
      if (i < cur) { const n = took(k); return n ? (n === 1 ? t("{count} second", { count: n }) : t("{count} seconds", { count: n })) : t("Done"); }
      if (i > cur) return t("Waiting");
      if (k === "transcribe") return (!result && duration && progress?.fraction != null ? t("Minute {current} of {total}", { current: Math.min(Math.floor((progress.fraction * duration) / 60) + 1, Math.ceil(duration / 60)), total: Math.ceil(duration / 60) }) : `${pct}%`) + (left ? ` · ${left[0].toUpperCase() + left.slice(1)}` : "");
      return progress?.message || t("Working on it");
    };
    body = project.status === "queued" ? (
      <div className="pv-center"><div className="pv-stack">
        <div><h2 className="pv-big">{waiting > 0 ? t("Waiting in line ({count} ahead)", { count: waiting }) : t("Waiting in line")}</h2><p className="pv-lead">{t("Another recording is being transcribed first. This one starts by itself. You can open other projects meanwhile.")}</p></div>
        <div className="pv-actions"><button type="button" className="btn" onClick={onCancel}>{t("Cancel")}</button></div>
      </div></div>
    ) : (
      <div className="pv-center"><div className="pv-stack">
        <div><h2 className="pv-big">{t("Transcribing…")}</h2><p className="pv-lead">{t("You can open other projects while this runs.")}</p>{startInfo.est && <p className="pv-lead">{t("Estimated time: {time}", { time: spanText(t, startInfo.est) })}</p>}</div>
        <div className="card pv-stages">
          {list.map(({ k, i }, n) => (
            <div key={k} className="pv-stage" aria-current={i === cur ? "step" : undefined}>
              <span className={"pv-ic " + (i < cur ? "ok" : i === cur ? "now" : "todo")} aria-hidden>{i < cur ? "✓" : n + 1}</span>
              <span className="pv-stage-text"><b>{title(k, i)}</b><small>{subtitle(k, i)}</small>
                {k === "transcribe" && i === cur && (
                  <div className="pv-pbar" role="progressbar" aria-label={t("Transcription progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
                )}
              </span>
            </div>
          ))}
        </div>
        {!!draft?.length && !partial && <DraftList lines={draft} names={names} speakers={[...new Set(draft.map((l) => l.speaker))]} />}
        <div className="pv-actions"><button type="button" className="btn" onClick={() => setDialog("stop")}>{t("Stop this one")}</button></div>
      </div></div>
    );
  } else if (!result) {
    body = failed ? <div className="pv-center"><div className="pv-stack">{errorCard}</div></div> : fitCard ? <div className="pv-center"><div className="pv-stack">{fitCard}</div></div> : (
      <div className="pv-center"><div className="pv-stack">
        <StartSheet project={project} duration={duration} eff={effOpts} info={startInfo} models={models} set={(p) => onPatch({ opts: { ...project.opts, ...p } })}
          canStart={canTranscribe} blocker={blocker} othersWaiting={othersWaiting}
          onStart={() => onTranscribe(null)} onTrial={() => onTranscribe([0, TRIAL_SECONDS], undefined, true)}
          onApplyToOthers={(o) => onApplyToOthers?.(o)} onRemember={(p) => onRemember?.(p)} onOpenSettings={onOpenSettings} />
      </div></div>
    );
  } else {
    body = (
      <div className="pv-scroll">
        {failed && errorCard}
        {fitCard}
        {project.previous && !busy && (
          <div className="pv-moved pv-restore" role="status">
            <span>{t("This transcript replaced an earlier one.")}</span>
            <span className="pv-restore-act"><button type="button" className="btn small" onClick={restore}>{t("Restore the earlier transcript")}</button>
              <button type="button" className="btn quiet small" onClick={() => onPatch({ previous: undefined })}>{t("Dismiss")}</button></span>
          </div>
        )}
        {project.trial && !partial && (
          <div className="pv-partial pv-trial" role="status">
            <span><b>{t("This is only the first 3 minutes, a sample to check the settings.")}</b> {t("If the speakers and languages look right, transcribe the whole recording. If not, change the settings under Options first.")}</span>
            <button type="button" className="btn sun small" disabled={!canTranscribe} onClick={replace}>{startInfo.est ? t("Transcribe the whole recording ({time})", { time: spanText(t, startInfo.est) }) : t("Transcribe the whole recording")}</button>
          </div>
        )}
        {partial && (
          <div className="pv-partial" role="status">
            <span><b>{project.status === "queued" ? t("Waiting in line to redo this part") : t("Redoing this part…")}</b> {project.status === "running" && progress?.stage === "transcribe" && progress.fraction != null ? `${Math.round(progress.fraction * 100)}%` : ""}</span>
            <button type="button" className="btn quiet small" onClick={onCancel}>{t("Stop")}</button>
          </div>
        )}
        {!easy && (highlights.length > 0 || result.segments.some((s) => s.marked)) && (
          <div className="pv-marklegend" role="note" aria-label={t("What the line badges mean")}>
            <span className="pv-lg"><span className="pv-flag pv-marked"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></svg>{t("Marked")}</span>
            <span>{t("a whole line for the minutes and the quote list")}</span></span>
            <span className="pv-lg"><span className="pv-flag pv-hlflag"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" /></svg>{t("Highlighted")}</span>
            <span>{t("words kept as a clip, shaded in the text")}</span></span>
          </div>
        )}
        {!easy && unsure.length > 0 && !unsureLegendSeen && (
          <div className="pv-legend" role="note">
            <span>{t("Dotted words: the model wasn't sure. Press R to check them.")}</span>
            <button type="button" className="btn quiet small" onClick={() => onRemember?.({ unsureLegendSeen: true })}>{t("Got it")}</button>
          </div>
        )}
        <Transcript easy={easy} showLang={easy ? false : showLang} result={result} names={names} time={time} query={query} findOpts={findOpts} highlights={highlights} onHighlight={easy ? undefined : (i, a, b) => { const h = highlightOf(result.segments[i], a, b); if (h) patchResult((x) => ({ ...x, highlights: addHighlight(x.highlights ?? [], h) })); }} matchSeg={matches[mi] ?? -1} onSeek={(t) => player.current?.seek(t)} onReassign={reassign} onNewSpeaker={newSpeaker}
          onEdit={(i, text) => onPatch({ result: { ...result, segments: result.segments.map((s, k) => (k === i ? retext(s, text) : s)) } }, t("edit a line"))}
          canRetranscribe={canTranscribe} reviewAt={reviewAt} translatingIndex={translating} playing={playing} onPause={() => player.current?.pause()}
          onTranslate={async (i, remove) => {
            const seg = result.segments[i];
            const put = (translation?: string) => onPatch({ result: { ...result, segments: result.segments.map((s, k) => { if (k !== i) return s; const { translation: _t, ...rest } = s; return translation ? { ...rest, translation } : rest; }) } }, t("translation"));
            if (remove) { put(); return; }
            setTranslating(i);
            const r = await window.api.translateLine({ input: path, start: seg.start, end: seg.end, model: ({ ...globalOpts(), ...project.opts }).model, language: seg.lang ?? result.language, backend: globalOpts().whisperEngine }).catch((e: unknown) => ({ ok: false, error: String(e) } as { ok: boolean; text?: string; error?: string }));
            setTranslating(null);
            if (r.ok && r.text) put(r.text); else flash(r.ok ? t("Nothing to translate here") : t("Translation failed: {reason}", { reason: r.error ?? "" }));
          }}
          onLanguage={(i, lang) => onPatch({ result: { ...result, segments: result.segments.map((s, k) => { if (k !== i) return s; const { lang: _l, ...rest } = s; return lang ? { ...rest, lang } : rest; }) } }, t("language change"))}
          onRetranscribe={(i, language) => { const s = result.segments[i]; onTranscribe([s.start, s.end], { language, speaker: s.speaker }); }}
          onSplit={(i, k) => { const parts = splitSegment(result.segments[i], k); if (parts) onPatch({ result: { ...result, segments: [...result.segments.slice(0, i), ...parts, ...result.segments.slice(i + 1)] } }, t("split a line")); }}
          onJoin={(i) => { const segments = joinWithPrevious(result.segments, i); if (segments) onPatch({ result: { ...result, segments } }, t("join lines")); }}
          onHeard={toggleHeardAt} onMark={(i) => onPatch({ result: { ...result, segments: result.segments.map((s, k) => { if (k !== i) return s; const { marked: _m, ...rest } = s; return s.marked ? rest : { ...rest, marked: true }; }) } }, t("mark a line"))}
          onChapter={(i, title) => onPatch({ result: { ...result, segments: result.segments.map((s, k) => { if (k !== i) return s; const { chapter: _c, ...rest } = s; return title ? { ...rest, chapter: title } : rest; }) } }, t("chapter"))}
          onRevert={(i) => onPatch({ result: { ...result, segments: result.segments.map((s, k) => (k === i ? revertLine(s) : s)) } }, t("put a line back"))} />
      </div>
    );
  }

  // Narrow windows (or large text): the inspector is a drawer opened from the header. The CSS decides when; this only tracks open or closed.
  const [drawer, setDrawer] = useState(false);
  const drawerBtn = useRef<HTMLButtonElement>(null);
  const closeDrawer = () => { setDrawer(false); drawerBtn.current?.focus(); };
  const inspectorId = "pv-inspector-" + project.id;

  return (
    <div hidden={!visible} className={"pview" + (review && !easy ? " reviewing" : "") + (drawer ? " insp-open" : "")}>
      <div className="pv-sr" role="status" aria-live="polite" aria-atomic="true">{announce}</div>
      {jumpDialog === "keys" && visible && <ShortcutSheet onClose={() => setJumpDialog(null)} />}
      {jumpDialog === "goto" && visible && <GoToTime duration={duration || result?.duration || 0} onGo={goToTime} onClose={() => setJumpDialog(null)} />}
      <section className="pview-main" aria-label={project.name}>
        <header className="tool pv-tool">
          <div className="titles">
            {renaming
              ? <input autoFocus className="input pv-title-input" defaultValue={project.name} aria-label={t("Project name")}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== project.name) onPatch({ name: n }); setRenaming(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false); }} />
              : <h1 tabIndex={0} className="pv-title" title={t("Double-click or press F2 to rename")} onDoubleClick={() => setRenaming(true)}
                  onKeyDown={(e) => { if (e.key === "F2") setRenaming(true); }}>{project.name}</h1>}{sub && <div className="sub" title={sub}>{sub}</div>}</div>
          {showResult && (
            <>
              {!easy && unsure.length > 0 && <button type="button" className="btn small pv-review-btn" style={review ? { visibility: "hidden" } : undefined} onClick={startReview} title={t("Step through the words the model was unsure of, with the audio, and fix or confirm each one")}>{unsure.length === 1 ? t("Review 1 unsure word") : t("Review {count} unsure words", { count: unsure.length })}</button>}
              <div className="search"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input ref={findBox} dir="auto" type="search" value={query} aria-label={t("Find in transcript")} placeholder={t("Find in transcript ({key}F)", { key: MOD_KEY })} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); } if (e.key === "Escape") { setQuery(""); findBox.current?.blur(); } }} />
                <span className="pv-hits" role="status">{hitLabel}</span>
              </div>
              {query.trim() && (
                <>
                  <button type="button" className="btn icon quiet" onClick={() => step(-1)} disabled={!matches.length} aria-label={t("Previous match")} title={t("Previous match (Shift+Enter)")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
                  <button type="button" className="btn icon quiet" onClick={() => step(1)} disabled={!matches.length} aria-label={t("Next match")} title={t("Next match (Enter)")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                </>
              )}
              {!easy && <button type="button" className={"btn quiet small" + (showLang ? " on" : "")} aria-pressed={showLang} onClick={toggleLang} title={t("Show the language of every line, so a line tagged with the wrong language stands out. Click a tag to change it.")}>{t("Languages")}</button>}
              {!easy && <button type="button" className={"btn quiet small" + (replaceOpen ? " on" : "")} aria-expanded={replaceOpen} aria-controls="pv-replace" onClick={() => setReplaceOpen(!replaceOpen)} title={t("Replace words in the transcript")}>{t("Replace")}</button>}
              <ExportMenu easy={easy} shown={exportShown} onOpenSettings={onOpenSettings} openSignal={exportSignal} lastExport={project.lastExport} defaultFormat={defaultExport} onRemember={(format, options) => onExported?.({ format, options })} hasChapters={result!.segments.some((s) => !!s.chapter?.trim())} markedCount={result!.segments.filter((s) => s.marked).length + keptHighlights.length} onExport={async (f, o) => { if (f === "copy-md") { const r = await window.api.exportText(payload("md", o)); if (!r.ok) return { ok: false, error: r.error }; try { await navigator.clipboard.writeText(r.text ?? ""); return { ok: true }; } catch { return { ok: false, error: t("The clipboard is not available.") }; } } if (f === "episode") return window.api.exportEpisode(payload(f, o), path, project.name); return f === "print" || f === "print-large" ? window.api.printPdf(project.name, f === "print-large") : window.api.exportTranscript(payload(f, o), f, project.name); }} />
            </>
          )}
          <button ref={drawerBtn} type="button" className={"btn icon quiet pv-insp-toggle" + (drawer ? " on" : "")} aria-expanded={drawer} aria-controls={inspectorId} aria-label={drawer ? t("Hide inspector") : t("Show inspector")} title={drawer ? t("Hide inspector") : t("Show inspector")} onClick={() => (drawer ? closeDrawer() : setDrawer(true))}>
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /></svg>
          </button>
        </header>

        {showResult && q && (
          <div className="pv-nohit">
            <span className="pv-opts" role="group" aria-label={t("Find options")}>
              <button type="button" className={"btn quiet small" + (findOpts.matchCase ? " on" : "")} aria-pressed={findOpts.matchCase} onClick={() => setFindOpts((o) => ({ ...o, matchCase: !o.matchCase }))}>{t("Match case")}</button>
              <button type="button" className={"btn quiet small" + (findOpts.wholeWord ? " on" : "")} aria-pressed={findOpts.wholeWord} onClick={() => setFindOpts((o) => ({ ...o, wholeWord: !o.wholeWord }))}>{t("Whole word")}</button>
            </span>
            {!matches.length && (
              <span role="status">{t("Nothing found for “{query}”.", { query: query.trim() })} {findOpts.matchCase || findOpts.wholeWord ? t("Match case or Whole word is on. Turn it off to find more.") : t("Capitals and accents are ignored, but the whole text has to appear. Try a shorter word.")}</span>
            )}
            {nearby.length > 0 && (
              <span className="pv-nohit-sug">{t("Closest:")}{" "}
                {nearby.map((n) => <button key={n.word} type="button" className="btn quiet small" onClick={() => { setQuery(n.word); findBox.current?.focus(); }}>{n.word} ({n.count})</button>)}
              </span>
            )}
          </div>
        )}

        {showResult && !easy && replaceOpen && (
          <div className="pv-replace" id="pv-replace" role="group" aria-label={t("Replace in transcript")}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setReplaceOpen(false); } }}>
            <div className="pv-rep-fields">
              <label className="pv-rep-field"><span>{t("Find")}</span>
                <input ref={panelFind} dir="auto" type="text" value={query} placeholder={t("Type what to find")} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (q) panelWith.current?.focus(); } }} /></label>
              <span className="pv-rep-arrow" aria-hidden>→</span>
              <label className="pv-rep-field"><span>{t("Replace with")}</span>
                <input ref={panelWith} dir="auto" type="text" value={replaceWith} placeholder={t("Type the new text")} onChange={(e) => setReplaceWith(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && matches.length) { e.preventDefault(); replaceIn([matches[mi]]); } }} /></label>
            </div>
            <div className="pv-rep-status" role="status">
              <b>{!q ? t("Type what to find") : !matches.length ? t("No matches") : occurrences === 1 ? t("1 match in 1 line") : matches.length === 1 ? t("{count} matches in 1 line", { count: occurrences }) : t("{count} matches in {lines} lines", { count: occurrences, lines: matches.length })}</b>
              {matches.length > 1 && (
                <span className="pv-rep-nav">
                  <button type="button" className="btn icon quiet small" onClick={() => step(-1)} aria-label={t("Previous match")} title={t("Previous match (Shift+Enter)")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
                  <span>{hitLabel}</span>
                  <button type="button" className="btn icon quiet small" onClick={() => step(1)} aria-label={t("Next match")} title={t("Next match (Enter)")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                </span>
              )}
            </div>
            {confirmAll && result && (
              <div className="pv-rep-preview">
                <p className="note">{t("These lines will change. Check them, then confirm.")}</p>
                <ul>
                  {matches.slice(0, 40).map((i) => {
                    const seg = result.segments[i];
                    const unsure = seg.words.some((w) => isUnsure(w) && fm.test(w.word));
                    return (
                      <li key={i}>
                        <span className="pv-rep-time">{fmt(seg.start)}</span>
                        <span className="pv-rep-line">{fm.parts(seg.text).map((p, k) => p.hit ? <span key={k}><del>{p.text}</del><ins>{replaceWith}</ins></span> : <span key={k}>{p.text}</span>)}</span>
                        {unsure && <span className="pv-rep-flag">{t("Unsure word")}</span>}
                      </li>
                    );
                  })}
                </ul>
                {matches.length > 40 && <p className="note">{t("{count} more lines", { count: matches.length - 40 })}</p>}
              </div>
            )}
            <div className="pv-rep-actions">
              {confirmAll ? (
                <>
                  <button type="button" className="btn sun small" onClick={() => replaceIn(matches)}>{t("Replace all {count}", { count: occurrences })}</button>
                  <button type="button" className="btn small" onClick={() => setConfirmAll(false)}>{t("Back")}</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn small" disabled={!matches.length} onClick={() => replaceIn([matches[mi]])}>{t("Replace in this line")}</button>
                  <button type="button" className="btn sun small" disabled={!matches.length} onClick={() => setConfirmAll(true)}>{occurrences > 0 ? t("Replace all {count}", { count: occurrences }) : t("Replace all")}</button>
                  <button type="button" className="btn quiet small" onClick={() => setReplaceOpen(false)}>{t("Close")}</button>
                </>
              )}
            </div>
            <p className="note pv-rep-help">{t("Upper and lower case and accents are ignored. Leave “Replace with” empty to delete the word. A changed line can be put back afterwards.")}</p>
          </div>
        )}

        {body}

        {!easy && review && showResult && (
          <ReviewBar segments={result!.segments} onHeard={() => reviewAt && toggleHeardAt(reviewAt.seg)} list={unsure} pos={rpos} current={reviewTotal - unsure.length + rpos + 1} total={Math.max(reviewTotal, unsure.length)}
            onFix={(text) => reviewAt && patchSeg(reviewAt.seg, (s) => fixWord(s, reviewAt.word, text))}
            onAccept={() => reviewAt && patchSeg(reviewAt.seg, (s) => acceptWord(s, reviewAt.word))}
            onSkip={() => setRpos((p) => p + 1)} onBack={() => setRpos((p) => Math.max(0, p - 1))}
            onReplay={() => playAround(reviewAt)} onTyping={() => { window.clearTimeout(clipTimer.current); player.current?.pause(); }} onRestart={() => { setReviewTotal(unsure.length); setRpos(0); }} onExit={endReview} />
        )}
        <div className={"card pv-dock" + (busy ? " off" : "")}>
          <div className="pv-transport">
            <button type="button" className="btn icon quiet skip" aria-label={t("Back 15 seconds")} onClick={() => player.current?.skip(-15)}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></svg><b aria-hidden="true">15</b></button>
            <button type="button" className="btn icon sun pv-play" aria-label={playing ? t("Pause") : t("Play")} onClick={() => player.current?.toggle()}>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d={playing ? "M9 6v12M15 6v12" : "M8 5l11 7-11 7z"} /></svg>
            </button>
            <button type="button" className="btn icon quiet skip" aria-label={t("Forward 15 seconds")} onClick={() => player.current?.skip(15)}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v4h-4" /></svg><b aria-hidden="true">15</b></button>
          </div>
          <div className="pv-clock">
            <div dir="ltr">{fmt(time)} <span>/ {fmt(duration || result?.duration || 0)}</span></div>
            <button type="button" className={"pv-speed" + (rate !== 1 ? " on" : "")} dir="ltr" onClick={() => stepRate(1, true)}
              aria-label={t("Playback speed {rate}×. Click to change.", { rate })} title={t("Playback speed: click to change, or press < and >")}>{rate}×</button>
          </div>
          <Waveform key={project.id} ref={player} path={path} result={result} onTime={setTime} onSelection={setSel} onPlaying={setPlaying} onDuration={setDuration} trim={trimHl ? { id: trimHl.id, start: trimHl.start, end: trimHl.end } : null} onTrim={dragHl} />
          {result && (
            <div className="pv-now" aria-live="off">
              <i style={{ background: nowName ? nowColor : undefined }} aria-hidden />
              <span title={nowName || t("Between speakers")}>{nowName || t("Between speakers")}</span>
            </div>
          )}
          {!easy && <button type="button" className="btn quiet small pv-more" aria-expanded={dockOpen} aria-controls="pv-drawer" onClick={toggleDock}>
            {dockOpen ? t("Less") : t("Details")}
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>}
          {!easy && <div className="pv-dock-side">
            <div className="pv-actions">
              {sel && <button type="button" className="btn quiet small" onClick={async () => { if (await window.api.saveClip(path, sel[0], sel[1])) flash(t("Clip saved ✓")); }}>{t("Save clip")}</button>}
            </div>
          </div>}
          {!easy && <div className="pv-drawer" id="pv-drawer" hidden={!dockOpen}>
            <div className="pv-tools" role="group">
              <button type="button" className="btn quiet small" onClick={prevTurn} title={t("Previous speaker")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 6v12l-9-6z" /></svg>{t("Previous")}</button>
              <button type="button" className="btn quiet small" onClick={replayTurn} title={t("Replay this turn")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></svg>{t("Replay")}</button>
              <button type="button" className="btn quiet small" onClick={nextTurn} title={t("Next speaker")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M5 6v12l9-6z" /></svg>{t("Next")}</button>
              <span className="pv-sep" aria-hidden />
              <button type="button" className="btn quiet small" onClick={() => void copyTime()}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" /></svg>{t("Copy time")}</button>
            </div>
            <div className="pv-tools" role="group">
              <button type="button" className="btn quiet small" onClick={markStart}>{t("Start clip")}</button>
              <button type="button" className="btn quiet small" onClick={markEnd}>{t("End clip")}</button>
              <button type="button" className="btn quiet small" disabled={!sel} onClick={async () => { if (sel && await window.api.saveClip(path, sel[0], sel[1])) flash(t("Clip saved ✓")); }}>{t("Save clip")}</button>
            </div>
            <div className="pv-hint pv-keys">{t("Drag the waveform to save a clip · Space or K plays · J / L skip 10 s · Double-click a word to fix it")}</div>
          </div>}
        </div>

        <div className="pv-sr" role="status" aria-live="polite" aria-atomic="true">{notice}</div>
        {notice && <div className="toast" aria-hidden="true"><span>{notice}</span></div>}
      </section>

      <div className="pv-insp-scrim" aria-hidden onClick={closeDrawer} />
      <Inspector top={showResult && mediaKind(path) === "video" ? <VideoPreview path={path} name={project.name} time={time} playing={playing} rate={rate} /> : undefined} easy={easy} id={inspectorId} drawerOpen={drawer} onDrawerClose={closeDrawer} project={project} tab={tab} onTab={setTab} visible={visible} moved={moved} onMoveAll={moveAll} onUndo={undo}
        canTranscribe={canTranscribe} onAskAgain={again} onPatch={onPatch} onOpenSettings={onOpenSettings} models={models} onShowLine={showLine}
        askPanel={<AskTab project={project} visible={visible} thread={askThread} job={llmJob} onAsk={runAsk}
          onStop={() => { askStopped.current = true; void window.api.cancel(llmId.current); }} onClear={() => setAskThread([])} onShow={showLine} />}
        highlightsPanel={<HighlightsTab project={project} visible={visible} trimId={trimHl ? trimHl.id : null} onTrim={setTrimId} onAdjust={adjustHl} job={llmJob} error={llmError}
          onSuggest={(m) => runLlm("highlights", m)} onSummarize={(m) => runLlm("summarize", m)} onStop={() => { void window.api.cancel(llmId.current); }}
          onKeep={(id) => patchResult((x) => ({ ...x, highlights: (x.highlights ?? []).map((h) => (h.id === id ? { ...h, suggested: undefined } : h)) }))}
          onRemove={(id) => patchResult((x) => ({ ...x, highlights: (x.highlights ?? []).filter((h) => h.id !== id) }))}
          onKeepAll={() => patchResult((x) => ({ ...x, highlights: (x.highlights ?? []).map((h) => ({ ...h, suggested: undefined })) }))}
          onDismissAll={() => patchResult((x) => ({ ...x, highlights: (x.highlights ?? []).filter((h) => !h.suggested) }))}
          onPlay={playRange} onPause={() => { window.clearTimeout(clipTimer.current); player.current?.pause(); }} clip={playing ? hlClip : null} time={time} onSeek={(s) => player.current?.seek(s)} onSaveClips={saveClips}
          onSaveOne={async (h) => { if (await window.api.saveClip(path, Math.max(0, h.start - 0.3), h.end + 0.3)) flash(t("Clip saved ✓")); }}
          onEditSummary={(text) => patchResult((x) => (x.summary ? { ...x, summary: { ...x.summary, summary: text } } : x))}
          onClearSummary={() => patchResult((x) => { const { summary: _s, ...rest } = x; return rest; })} />} />

      {dialog === "again" && (
        <Dialog title={t("Replace this transcript?")} cancel={t("Cancel")} confirm={t("Replace transcript")} onCancel={() => setDialog(null)} onConfirm={replace}>
          <p>{t("Transcribing again writes the text from scratch. Your speaker names, moved lines, edits, highlights and chapters are not carried over. Your recording is not changed.")}</p>
          <p>{t("The transcript you have now is kept for one step back: you can restore it afterwards.")}</p>
        </Dialog>
      )}
      {dialog === "stop" && (
        <Dialog title={t("Stop transcribing “{name}”?", { name: project.name })} cancel={t("Keep going")} confirm={t("Stop and discard")} onCancel={() => setDialog(null)} onConfirm={() => { setDialog(null); onCancel(); }}>
          <p>{t("The work done so far is discarded, and you'd start this recording again from the beginning.")}{result ? " " + t("The transcript you already have is kept.") : ""} {t("Your recording is not changed.")}</p>
        </Dialog>
      )}
    </div>
  );
}

/** The lines written so far, while the transcription runs. The newest line stays in view. */
function DraftList({ lines, names, speakers }: { lines: DraftLine[]; names: Record<string, string>; speakers: string[] }) {
  const t = useT();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [lines.length]);
  return (
    <section className="card pv-draft" aria-label={t("Transcript so far")}>
      <h3>{t("So far")}</h3>
      <div className="pv-draft-lines" role="log" aria-live="off">
        {lines.map((l, i) => (
          <p key={i}><span className="pv-draft-who">{displayName(l.speaker, speakers, names)}</span> <span className="pv-draft-time">{fmt(l.start)}</span> {l.text}</p>
        ))}
        <div ref={end} />
      </div>
    </section>
  );
}
