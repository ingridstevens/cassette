import { type KeyboardEvent as ReactKeyEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { MAIN_LANGS, WHISPER_LANGS, langName } from "../languages";
import { BoundaryNote } from "./BoundaryNote";
import type { Boundary } from "../sources";
import { Highlight, UnsureRef, isUnsure, PALETTE, Result, chapterDefault, displayName, fmt, wordIn, wordsInSelection } from "../types";
import { onMenuKeyDown } from "./ExportMenu";
import { FIND_DEFAULTS, FindOpts, matcher } from "../find";
import { quoteText, toolbarPosition } from "../selectionToolbar";
import { quoteCues } from "../lineCues";
import { rangeOfWords } from "../playRange";
import { WordSel, extendSel, selBounds, startSel } from "../wordSelection";
import { FILTER_AT, filterSpeakers } from "../speakerMenu";
import { SCROLL_EVENT, ScrollJob, renderIndices, rowOffsets, spacerHeight, visibleRange } from "../windowing";
import "../styles/project.css";

interface Props {
  result: Result; names: Record<string, string>; time: number;
  onSeek(t: number): void; /** Play from the start of the range and stop at its end. */ onPlayRange?(start: number, end: number): void; onReassign(index: number, speaker: string): void; /** Give the line to a new speaker with this name (empty: the usual default name). */ onNewSpeaker(index: number, name: string): void;
  onEdit(index: number, text: string): void; onRevert(index: number): void; onChapter(index: number, title: string | null): void; onMark(index: number): void; onHeard(index: number): void; onSplit(index: number, wordIndex: number): void; onLanguage(index: number, lang: string | null): void; onRetranscribe(index: number, language: string): void; onTranslate(index: number, remove?: boolean): void; playing: boolean; onPause(): void; reviewAt?: UnsureRef | null; translatingIndex?: number | null; canRetranscribe: boolean; onJoin(index: number): void;
  highlights?: Highlight[]; onHighlight?(index: number, from: number, to: number): void;
  /** Show the language of every line, not only lines that differ from the recording. */ showLang?: boolean;
  /** Easy mode: only the speaker, the time and Edit stay on each line. */ easy?: boolean;
  query?: string; findOpts?: FindOpts; matchSeg?: number;
  /** Where a recording ends and the next begins: the notes shown above the first line of the later recording (line index to boundaries). */ boundaries?: Map<number, Boundary[]>;
  /** Speakers nobody has matched or named (from an added recording): Copy quote says so, as the exports do. */ unconfirmed?: string[];
}

/** How long a click on a word waits for a possible second click before it starts playing (a typical double-click gap). */
const DOUBLE_CLICK_MS = 260;
/** Space between two lines (the .pv-rows gap), and how far past the visible area lines stay drawn, in px. */
const GAP = 2, OVERSCAN = 700;

export default function Transcript({ easy = false, showLang, result, names, time, onSeek, onPlayRange, onReassign, onNewSpeaker, onEdit, onRevert, onChapter, onMark, onHeard, onSplit, onJoin, onLanguage, onRetranscribe, onTranslate, playing, onPause, reviewAt = null, translatingIndex = null, canRetranscribe, highlights = [], onHighlight, query = "", findOpts = FIND_DEFAULTS, matchSeg = -1, boundaries, unconfirmed = [] }: Props) {
  const t = useT();
  const color = (sp: string) => PALETTE[Math.max(0, result.speakers.indexOf(sp)) % PALETTE.length];
  const label = (sp: string) => displayName(sp, result.speakers, names);
  const [menu, setMenu] = useState<number | null>(null);
  /** The "Who said this line?" menu: the text typed in its filter, whether the new speaker's name is being typed, and that name. */
  const [who, setWho] = useState({ filter: "", naming: false, name: "" });
  const [whoNote, setWhoNote] = useState("");
  useEffect(() => { setWho({ filter: "", naming: false, name: "" }); setWhoNote(""); }, [menu]);
  const closeWho = (i: number) => { setMenu(null); document.querySelector<HTMLElement>(`[data-who="${i}"]`)?.focus(); };
  const [langPop, setLangPop] = useState<number | null>(null);
  const langBox = useRef<HTMLDivElement>(null);
  const closeLang = (i: number) => { setLangPop(null); setTimeout(() => document.querySelector<HTMLElement>(`[data-who="${i}"]`)?.focus(), 0); };
  const [copied, setCopied] = useState<number | null>(null);
  /** In a recording with several languages every line shows its language; otherwise only lines that differ from the recording do. */
  const mixed = new Set(result.segments.map((s) => s.lang ?? result.language)).size > 1;
  const [editing, setEditing] = useState<number | null>(null);
  const [splitting, setSplitting] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  /** Words selected with the mouse in a line (first and last index), offered as "Highlight this passage". */
  const [picked, setPicked] = useState<{ seg: number; from: number; to: number } | null>(null);
  /** Characters selected in the editor's text box. */
  const [typedSel, setTypedSel] = useState<[number, number]>([0, 0]);
  const pickWords = (i: number, root: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) { setPicked(null); return; }
    const r = sel.getRangeAt(0), idx: number[] = [];
    root.querySelectorAll<HTMLElement>("[data-w]").forEach((el) => {
      const w = document.createRange(); w.selectNodeContents(el);
      if (r.compareBoundaryPoints(Range.END_TO_START, w) < 0 && r.compareBoundaryPoints(Range.START_TO_END, w) > 0) idx.push(Number(el.dataset.w));
    });
    setKb(null);
    setPicked(idx.length >= 2 ? { seg: i, from: idx[0], to: idx[idx.length - 1] } : null);
  };
  useEffect(() => { // clicking elsewhere or collapsing the selection hides the offer
    if (!picked) return;
    const gone = () => { if (window.getSelection()?.isCollapsed) setPicked(null); };
    document.addEventListener("selectionchange", gone);
    return () => document.removeEventListener("selectionchange", gone);
  }, [picked]);
  useEffect(() => { if (!picked && kb) setKb(null); }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const highlight = (i: number, from: number, to: number) => { onHighlight?.(i, from, to); setPicked(null); setKb(null); window.getSelection()?.removeAllRanges(); };
  /** The floating toolbar above the selection: placed in the viewport (position: fixed) and moved when the page scrolls or resizes. It stays in the line's own markup, so Tab from the selection reaches it. */
  const bar = useRef<HTMLDivElement>(null);
  const [barAt, setBarAt] = useState<{ top: number; left: number } | null>(null);
  const [said, setSaid] = useState("");
  /** A selection made with the keyboard (Shift+Left or Right in a line): the line and the two ends. The words are also selected in the page, so the toolbar and copying work as with the mouse. */
  const [kb, setKb] = useState<(WordSel & { seg: number }) | null>(null);
  /** The control that had focus when the keyboard selection began, so Esc can give focus back to it. */
  const origin = useRef<HTMLElement | null>(null);
  const cancelPick = () => {
    const inBar = !!bar.current?.contains(document.activeElement);
    if (kb) window.getSelection()?.removeAllRanges();
    setPicked(null); setKb(null);
    setSaid(kb ? t("Selection cancelled") : "");
    if (inBar && origin.current?.isConnected) origin.current.focus();
  };
  useLayoutEffect(() => {
    if (!picked) { setBarAt(null); return; }
    const place = () => {
      const sel = window.getSelection(), el = bar.current;
      if (!sel || !sel.rangeCount || !el) return;
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setBarAt(toolbarPosition({ top: r.top, left: r.left, width: r.width, height: r.height }, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
    };
    place();
    window.addEventListener("scroll", place, true); window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [picked]);
  useEffect(() => { // Esc closes the toolbar (and keeps the selection, so it can still be copied)
    if (!picked) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) cancelPick(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!kb && picked) setSaid(t("{count} words selected. Press Tab to reach the actions, Esc to close them.", { count: picked.to - picked.from + 1 })); }, [picked?.seg, picked?.from, picked?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Left and right arrows move between the toolbar's buttons. */
  const arrowKeys = (e: ReactKeyEvent<HTMLElement>) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button")], at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault(); items[(at + d + items.length) % items.length].focus();
  };
  const copyPicked = (i: number, from: number, to: number) => {
    const seg = result.segments[i];
    navigator.clipboard.writeText(quoteText(label(seg.speaker), fmt(seg.words[from]?.start ?? seg.start), seg.words, from, to) + quoteCues(t, seg, unconfirmed, seg.words.slice(from, to + 1)));
    setSaid(t("Quote copied"));
  };
  /** Shift+Left or Right in a line selects words (starting at the playing word, or the first or last word), Shift+Down goes to the toolbar. Plain arrows and Tab are left alone. */
  const wordKeys = (e: ReactKeyEvent<HTMLElement>, i: number) => {
    if (easy || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowDown") return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, [role=menu], [role=dialog], [role=toolbar]") || editing === i || splitting === i) return;
    const seg = result.segments[i];
    if (e.key === "ArrowDown") {
      if (kb?.seg !== i) return;
      e.preventDefault(); bar.current?.querySelector<HTMLElement>("button")?.focus();
      return;
    }
    const dir = e.key === "ArrowRight" ? 1 : -1;
    e.preventDefault();
    const starting = kb?.seg !== i;
    const next = starting ? startSel(seg.words, time, dir) : extendSel(kb!, dir, seg.words.length);
    if (!next) return;
    if (starting) origin.current = target;
    const [from, to] = selBounds(next);
    const els = e.currentTarget.querySelectorAll<HTMLElement>(".pv-read [data-w]"), a = els[from], b = els[to];
    if (a && b) { const r = document.createRange(); r.setStartBefore(a); r.setEndAfter(b); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    setKb({ ...next, seg: i }); setPicked({ seg: i, from, to });
    const word = (j: number) => seg.words[j]?.word.trim() ?? "";
    setSaid(starting ? t("Selecting words from “{word}”. Shift+Right or Shift+Left extends, Shift+Down goes to the actions, Esc cancels.", { word: word(from) }) : t("{count} words selected, from “{first}” to “{last}”", { count: to - from + 1, first: word(from), last: word(to) }));
  };
  /** Which part of the text to select when the editor opens (the word that was double-clicked). */
  const editSel = useRef<[number, number] | null>(null);
  const editArea = useRef<HTMLTextAreaElement | null>(null);
  const wasPlaying = useRef(false);
  // A single click on a word plays from there, but only after a short wait: if a second click follows it is a double-click (edit), and nothing should have played.
  const playTimer = useRef<number | undefined>(undefined);
  const cancelPlay = () => { window.clearTimeout(playTimer.current); playTimer.current = undefined; };
  const playFrom = (e: React.MouseEvent, at: number) => {
    cancelPlay();
    if (e.detail > 1) return;
    playTimer.current = window.setTimeout(() => { playTimer.current = undefined; onSeek(at); }, DOUBLE_CLICK_MS);
  };
  useEffect(() => cancelPlay, []);
  const startEdit = (i: number, word?: number) => {
    const seg = result.segments[i];
    editSel.current = null;
    if (word !== undefined && seg.words[word]) {
      const full = seg.words.map((w) => w.word).join(""), lead = full.length - full.trimStart().length;
      const before = seg.words.slice(0, word).map((w) => w.word).join(""), w = seg.words[word].word;
      const start = before.length + (w.length - w.trimStart().length) - lead;
      if (seg.text === full.trim()) editSel.current = [start, start + w.trim().length];
    }
    setDraft(seg.text); setEditing(i);
  };
  useEffect(() => {
    if (editing === null) return;
    const ta = editArea.current;
    if (ta && editSel.current) ta.setSelectionRange(editSel.current[0], editSel.current[1]);
  }, [editing]);
  const saveEdit = () => { if (editing !== null) onEdit(editing, draft); setEditing(null); };
  const [chap, setChap] = useState<number | null>(null);
  const [chapDraft, setChapDraft] = useState("");
  const startChap = (i: number) => { setChapDraft(result.segments[i].chapter ?? chapterDefault(result.segments[i].text)); setChap(i); };
  const closeChap = (i: number) => { setChap(null); setTimeout(() => document.querySelector<HTMLElement>(`[data-chap="${i}"]`)?.focus(), 0); };
  const saveChap = (i: number) => { const title = chapDraft.trim(); onChapter(i, title || null); closeChap(i); };
  const copyQuote = (i: number) => {
    const seg = result.segments[i];
    navigator.clipboard.writeText(`${label(seg.speaker)} (${fmt(seg.start)}): ${seg.text}${quoteCues(t, seg, unconfirmed)}`);
    setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1800);
  };
  const menuBox = useRef<HTMLDivElement>(null);
  const active = result.segments.findIndex((s) => time >= s.start && time < s.end);
  // Follow the playing line until the user scrolls or types; Play (or the button) turns it back on.
  const [follow, setFollow] = useState(true);
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (playing) setFollow(true); }, [playing]);
  useEffect(() => {
    const box = anchor.current?.closest(".pv-scroll");
    if (!box) return;
    const off = () => setFollow(false);
    box.addEventListener("wheel", off, { passive: true });
    box.addEventListener("touchmove", off, { passive: true });
    box.addEventListener("keydown", off);
    return () => { box.removeEventListener("wheel", off); box.removeEventListener("touchmove", off); box.removeEventListener("keydown", off); };
  }, []);
  const fm = matcher(query, findOpts);
  const q = fm.q;

  // Windowing: only the lines near the viewport are in the page; blank space of the same height stands in for the rest.
  const n = result.segments.length;
  const listRef = useRef<HTMLDivElement>(null);
  const box = useRef<Element | null>(null);
  const heights = useRef(new WeakMap<object, number>()); // measured height of each line, kept by line so a split or join does not lose the others
  const [rev, setRev] = useState(0); // bumped when a measured height changed
  const offsets = useMemo(() => rowOffsets(result.segments.map((s) => heights.current.get(s)), n, GAP), [rev, result.segments, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const offsetsRef = useRef(offsets); offsetsRef.current = offsets;
  const segsRef = useRef(result.segments); segsRef.current = result.segments;
  const [range, setRange] = useState<[number, number]>([0, 40]);
  /** The line that has keyboard focus stays drawn (with its neighbours, so Tab can reach them) even when scrolled out of the window. */
  const [focusRow, setFocusRow] = useState<number | null>(null);
  /** A pending "scroll this line into view": the line is drawn first, then scrolled to. */
  const [job, setJob] = useState<ScrollJob | null>(null);
  const jobRef = useRef<ScrollJob | null>(null);
  const [printing, setPrinting] = useState(false);
  const goTo = (index: number, block: "center" | "nearest", behavior: "smooth" | "auto" = "smooth") => { if (index >= 0 && index < n) setJob({ index, block, behavior, resolve: () => {} }); };

  const recalc = () => {
    const b = box.current, list = listRef.current;
    if (!b || !list || !b.clientHeight) return; // not on screen
    const rel = b.getBoundingClientRect().top - list.getBoundingClientRect().top; // how far the top of the list is above the top of the scroller
    const [s, e] = visibleRange(offsetsRef.current, rel, rel + b.clientHeight, OVERSCAN);
    setRange((r) => (r[0] === s && r[1] === e ? r : [s, e]));
  };
  const recalcRef = useRef(recalc); recalcRef.current = recalc;
  useLayoutEffect(() => {
    const b = box.current = anchor.current?.closest(".pv-scroll") ?? null;
    if (!b) return;
    const onScroll = () => recalcRef.current(); // scroll events already come once per frame
    b.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(b);
    recalcRef.current();
    return () => { b.removeEventListener("scroll", onScroll); ro.disconnect(); };
  }, []);
  useLayoutEffect(() => { recalcRef.current(); }, [offsets]);

  // Measure the lines that are drawn (now, and whenever one grows or shrinks: an editor opens, a translation arrives).
  const seen = useRef(new Set<Element>());
  const sizes = useRef<ResizeObserver | null>(null);
  const measure = (el: Element) => {
    const seg = segsRef.current[Number((el as HTMLElement).dataset.turn)], h = (el as HTMLElement).offsetHeight;
    if (!seg || !h || Math.abs((heights.current.get(seg) ?? 0) - h) < 0.5) return false;
    heights.current.set(seg, h); return true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    sizes.current ??= new ResizeObserver((entries) => { let changed = false; for (const e of entries) changed = measure(e.target) || changed; if (changed) setRev((r) => r + 1); });
    const rows = [...(listRef.current?.querySelectorAll(":scope > [data-turn]") ?? [])];
    let changed = false;
    for (const el of rows) { changed = measure(el) || changed; if (!seen.current.has(el)) { seen.current.add(el); sizes.current.observe(el); } }
    for (const el of [...seen.current]) if (!rows.includes(el)) { seen.current.delete(el); sizes.current.unobserve(el); }
    if (changed) setRev((r) => r + 1); // settles: the second pass measures the same heights
  });
  useEffect(() => () => sizes.current?.disconnect(), []);

  // Other parts of the app ask for a line to be scrolled to (keyboard jumps, the highlights list, "show the line"): see scrollToTurn.
  useEffect(() => {
    const on = (ev: Event) => {
      const j = (ev as CustomEvent<ScrollJob>).detail;
      if (!j || j.handled || anchor.current?.closest(".pview[hidden]") || !(j.index >= 0 && j.index < segsRef.current.length)) return;
      j.handled = true; jobRef.current?.resolve(null); setJob(j);
    };
    document.addEventListener(SCROLL_EVENT, on);
    return () => document.removeEventListener(SCROLL_EVENT, on);
  }, []);
  useLayoutEffect(() => {
    if (!job) return;
    jobRef.current = job;
    const b = box.current, el = listRef.current?.querySelector<HTMLElement>(`:scope > [data-turn="${job.index}"]`) ?? null;
    if (!el || !b) { job.resolve(null); return; }
    const far = Math.abs(el.getBoundingClientRect().top - b.getBoundingClientRect().top) > 3 * b.clientHeight; // a long jump does not animate through thousands of lines
    el.scrollIntoView({ block: job.block, behavior: far ? "auto" : job.behavior });
    recalcRef.current(); // draw the lines around the target now rather than on the first scroll event
    if (far) requestAnimationFrame(() => requestAnimationFrame(() => { // lines drawn on the way were measured: put the target back where it belongs
      const r = el.getBoundingClientRect(), bb = b.getBoundingClientRect();
      if (el.isConnected && Math.abs(r.top + r.height / 2 - (bb.top + bb.height / 2)) > 4 && job.block === "center") el.scrollIntoView({ block: "center", behavior: "auto" });
    }));
    job.resolve(el);
    const done = window.setTimeout(() => setJob((c) => (c === job ? null : c)), 2500); // the line stays drawn while the scroll settles
    return () => window.clearTimeout(done);
  }, [job]);

  // Printing needs every line on the page: the main process adds .printing to <html> and waits for data-print-ready.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setPrinting(root.classList.contains("printing") && !anchor.current?.closest(".pview[hidden]"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => {
    if (!printing) return;
    document.documentElement.dataset.printReady = "1";
    return () => { delete document.documentElement.dataset.printReady; };
  }, [printing]);

  useEffect(() => { if (follow && active >= 0) goTo(active, "nearest"); }, [active, follow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (matchSeg >= 0) goTo(matchSeg, "center"); }, [matchSeg, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const inUse = new Set(result.segments.map((s) => s.speaker));
  const listed = (cur: string) => result.speakers.filter((sp) => inUse.has(sp) || sp === cur);
  /** Keys in the "Who said this line?" menu: arrows move through the entries (also out of the filter); typing a letter on an entry goes to the filter. */
  const whoKeys = (e: ReactKeyEvent<HTMLElement>, filterShown: boolean) => {
    if (e.target instanceof HTMLInputElement) { if (e.key === "ArrowDown" || e.key === "ArrowUp") onMenuKeyDown(e); return; }
    if (filterShown && e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); setWho((w) => ({ ...w, filter: w.filter + e.key }));
      menuBox.current?.querySelector<HTMLElement>(".pv-who-filter")?.focus(); return;
    }
    onMenuKeyDown(e);
  };
  /** Highlighted words get a colour: kept highlights in yellow, suggestions from the language model dotted until the user decides. */
  const hlClass = (w: { start: number; end: number; word: string }) => { const h = highlights.find((x) => wordIn(w as never, x)); return h ? (h.suggested ? " hl sug" : " hl") : ""; };

  useEffect(() => {
    if (menu === null) return;
    menuBox.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    menuBox.current?.scrollIntoView({ block: "nearest" }); // a tall menu near the bottom must not hide under the player
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".pv-turn-menu, .pv-who-btn")) setMenu(null); };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(null);
      document.querySelector<HTMLElement>(`[data-who="${menu}"]`)?.focus();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  useEffect(() => { // the language dialog: focus its dropdown, keep it in view, close on Escape or a click outside
    if (langPop === null) return;
    langBox.current?.querySelector<HTMLElement>("select")?.focus();
    langBox.current?.scrollIntoView({ block: "nearest" });
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".pv-lang-pop, .pv-lang-btn, .pv-who-btn")) setLangPop(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setLangPop(null); document.querySelector<HTMLElement>(`[data-who="${langPop}"]`)?.focus(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [langPop]);

  const shown = renderIndices(n, printing ? [0, n] : range, [editing, menu, langPop, chap, splitting, picked?.seg, translatingIndex, job?.index, reviewAt?.seg, focusRow, focusRow === null ? null : focusRow - 1, focusRow === null ? null : focusRow + 1].filter((x): x is number => typeof x === "number"));
  const layout: ({ i: number } | { gap: number; key: string })[] = [];
  let prev = -1;
  for (const i of shown) { if (i > prev + 1) layout.push({ gap: spacerHeight(offsets, prev + 1, i, GAP), key: `g${prev + 1}` }); layout.push({ i }); prev = i; }
  if (n > 0 && prev < n - 1) layout.push({ gap: spacerHeight(offsets, prev + 1, n, GAP), key: `g${prev + 1}` });

  return (
    <>
      <span ref={anchor} hidden />
      <span className="pv-sr" role="status" aria-live="polite">{said}</span>
      <span id="pv-unsure-label" className="pv-sr">{t("unsure")}</span>
      <div className="pv-rows" role="list" ref={listRef}>
      {layout.map((it) => {
        if ("gap" in it) return <div key={it.key} className="pv-gap" aria-hidden style={{ height: it.gap, flex: "none" }} />;
        const i = it.i, seg = result.segments[i], spk = menu === i ? listed(seg.speaker) : [];
        return (
        <div key={i} role="listitem" aria-posinset={i + 1} aria-setsize={n} onFocus={() => setFocusRow(i)} onKeyDown={(e) => wordKeys(e, i)}
          data-turn={i} className={"pv-turn" + (seg.marked ? " marked" : "") + (i === active ? " now" : "") + (i === matchSeg ? " found" : "") + (i > 0 && result.segments[i - 1].speaker === seg.speaker ? " cont" : "")}>
          {boundaries?.get(i)?.map((b) => <BoundaryNote key={b.after.id} boundary={b} onSeek={onSeek} />)}
          <div className="pv-who">
            <button type="button" className="pv-who-btn" data-who={i} aria-haspopup="menu" aria-expanded={menu === i}
              aria-label={t("Change who said the line at {time}. Now: {name}", { time: fmt(seg.start), name: label(seg.speaker) })} onClick={() => setMenu(menu === i ? null : i)}>
              <span className="sw" style={{ background: color(seg.speaker) }} aria-hidden />{label(seg.speaker)}
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14 }}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <button type="button" className="pv-time" onClick={() => onSeek(seg.start)} title={t("Play from here")} aria-label={t("Play from {time}", { time: fmt(seg.start) })}>{fmt(seg.start)}</button>
            {seg.marked && <span className="pv-flag pv-marked" title={t("Marked: goes into the meeting minutes and the quote list")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></svg>{t("Marked")}</span>}
            {!easy && seg.heard && <span className="pv-flag pv-heard" title={t("Heard: you listened to this line against the audio")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{t("Heard")}</span>}
            {(() => { // a highlighted passage in this line gets its own badge (a pen, not the marked line's star) so the two never look alike
              const inLine = highlights.filter((h) => h.start < seg.end && h.end > seg.start), kept = inLine.some((h) => !h.suggested);
              return inLine.length > 0 && <span className="pv-flag pv-hlflag" title={kept ? t("Highlighted: a passage in this line is kept in the Highlights tab") : t("Suggested: a passage in this line is a suggested highlight you have not kept yet")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" /></svg>{kept ? t("Highlighted") : t("Suggested")}</span>;
            })()}
            {!easy && (seg.lang && seg.lang !== result.language || mixed || showLang) && (
              <button type="button" className="pv-flag pv-lang pv-lang-btn" aria-haspopup="dialog" aria-expanded={langPop === i}
                aria-label={t("Language of this line: {language}. Change it.", { language: langName(seg.lang ?? result.language) })} title={t("This line is in {language}", { language: langName(seg.lang ?? result.language) })}
                onClick={() => { setMenu(null); setLangPop(langPop === i ? null : i); }}>{(seg.lang ?? result.language).toUpperCase()}</button>
            )}
            {seg.overlap && <span className="pv-flag pv-overlap" title={t("More than one person was talking here. The words are assigned to the louder speaker.")}>{t("Overlap")}</span>}
            {!easy && <button type="button" className="pv-copy pv-edit" aria-pressed={!!seg.marked} onClick={() => onMark(i)} title={t("Mark this line as a decision, action item or quote. Marked lines go into the meeting minutes and the quote list.")}>{seg.marked ? t("Marked ✓") : t("Mark")}</button>}
            {!easy && <button type="button" className="pv-copy pv-edit" aria-pressed={!!seg.heard} onClick={() => onHeard(i)} title={t("Mark this line as heard by you against the audio. Press H.")}>{seg.heard ? t("Heard ✓") : t("Heard it")}</button>}
            {!easy && <button type="button" className="pv-copy pv-edit" data-chap={i} onClick={() => startChap(i)} aria-label={seg.chapter ? t("Change the chapter at the line at {time}", { time: fmt(seg.start) }) : t("Add a chapter at the line at {time}", { time: fmt(seg.start) })} title={t("Mark where a new topic starts. Chapters can be exported as a list for YouTube or podcast show notes.")}>{t("Chapter")}</button>}
            {!easy && <button type="button" className="pv-copy pv-edit" aria-pressed={splitting === i} onClick={() => setSplitting(splitting === i ? null : i)} title={t("Split this line in two, for example when several people spoke in turn and the app put them in one line.")}>{t("Split")}</button>}
            <button type="button" className="pv-copy pv-edit-btn" onClick={() => startEdit(i)} aria-label={t("Edit the text of the line at {time}", { time: fmt(seg.start) })} title={t("Fix the words of this line")}>{t("Edit")}</button>
            {!easy && <button type="button" className="pv-copy" onClick={() => copyQuote(i)} aria-label={t("Copy this line as a quote with the speaker and time")} title={t("Copy as a quote, with speaker and time")}>{copied === i ? t("Copied ✓") : t("Copy quote")}</button>}
          </div>
          {menu === i && (
            <div ref={menuBox} className="menu pv-turn-menu" role="menu" aria-label={t("Who said this line?")} onKeyDown={(e) => whoKeys(e, spk.length >= FILTER_AT)}>
              <div className="pv-menu-title" aria-hidden>{t("Who said this line?")}</div>
              {spk.length >= FILTER_AT && (
                <input type="search" className="input pv-who-filter" value={who.filter} dir="auto" autoComplete="off" spellCheck={false} aria-label={t("Find a speaker")} placeholder={t("Find a speaker")}
                  onChange={(e) => { const f = e.target.value, n = filterSpeakers(spk, label, f).length; setWho({ ...who, filter: f }); setWhoNote(f.trim() ? (n === 0 ? t("No speaker matches") : n === 1 ? t("1 speaker matches") : t("{count} speakers match", { count: n })) : ""); }}
                  onKeyDown={(e) => { if (e.key === "Escape" && who.filter) { e.preventDefault(); e.stopPropagation(); setWho({ ...who, filter: "" }); setWhoNote(""); } }} />
              )}
              {filterSpeakers(spk, label, who.filter).map((sp) => (
                <button key={sp} type="button" role="menuitemradio" aria-checked={sp === seg.speaker} onClick={() => { setMenu(null); onReassign(i, sp); document.querySelector<HTMLElement>(`[data-who="${i}"]`)?.focus(); }}>
                  <span className="pv-menu-item"><span className="sw" style={{ background: color(sp) }} aria-hidden /><b>{label(sp)}</b><span aria-hidden>{sp === seg.speaker ? "✓" : ""}</span></span>
                </button>
              ))}
              {who.filter.trim() && filterSpeakers(spk, label, who.filter).length === 0 && <div className="pv-menu-none" aria-hidden>{t("No speaker matches")}</div>}
              {who.naming ? (
                <div className="pv-who-new" role="group" aria-label={t("New speaker")}>
                  <input autoFocus type="text" className="input" dir="auto" value={who.name} autoComplete="off" aria-label={t("Name of the new speaker")} placeholder={t("Name of the new speaker")}
                    onChange={(e) => setWho({ ...who, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setWho({ ...who, naming: false }); setTimeout(() => menuBox.current?.querySelector<HTMLElement>(".pv-who-add")?.focus(), 0); }
                      else if (e.key === "Enter") { e.preventDefault(); closeWho(i); onNewSpeaker(i, who.name); }
                    }} />
                  <div className="pv-editor-row">
                    <button type="button" className="btn sun small" onClick={() => { closeWho(i); onNewSpeaker(i, who.name); }}>{t("Add speaker")}</button>
                    <button type="button" className="btn quiet small" onClick={() => { setWho({ ...who, naming: false }); setTimeout(() => menuBox.current?.querySelector<HTMLElement>(".pv-who-add")?.focus(), 0); }}>{t("Cancel")}</button>
                  </div>
                </div>
              ) : (
                <button type="button" role="menuitem" className="pv-who-add" onClick={() => setWho({ ...who, naming: true, name: who.filter.trim() })}>
                  <span className="pv-menu-item"><b>{t("+ New speaker…")}</b></span>
                </button>
              )}
              <div className="pv-sr" role="status" aria-live="polite" aria-atomic="true">{whoNote}</div>
              {!easy && <><div className="pv-menu-sep" role="separator" />
              <button type="button" role="menuitem" aria-haspopup="dialog" onClick={() => { setMenu(null); setLangPop(i); }}>
                <span className="pv-menu-item"><b>{t("Language and translation…")}</b></span>
                <small>{langName(seg.lang ?? result.language)}</small>
              </button></>}
            </div>
          )}
          {langPop === i && (
            <div ref={langBox} className="menu pv-turn-menu pv-lang-pop" role="dialog" aria-label={t("Language of this line")}>
              <label className="pv-pop-label" htmlFor={`pl-${i}`}>{t("Language of this line")}</label>
              <select id={`pl-${i}`} className="input" value={seg.lang ?? ""} onChange={(e) => onLanguage(i, e.target.value || null)}>
                <option value="">{t("Same as the recording ({language})", { language: langName(result.language) })}</option>
                {MAIN_LANGS.map((c) => <option key={c} value={c}>{langName(c)}</option>)}
                <optgroup label={t("All other languages")}>
                  {WHISPER_LANGS.filter((c) => !MAIN_LANGS.includes(c)).map((c) => ({ c, n: langName(c) })).sort((a, b) => a.n.localeCompare(b.n)).map(({ c, n }) => <option key={c} value={c}>{n}</option>)}
                </optgroup>
              </select>
              <div className="pv-pop-actions">
                {(seg.lang ?? result.language) !== "en" && (
                  <button type="button" className="btn small" disabled={translatingIndex !== null} onClick={() => { closeLang(i); onTranslate(i); }}>{seg.translation ? t("Translate to English again") : t("Translate to English")}</button>
                )}
                {seg.translation && <button type="button" className="btn quiet small" onClick={() => { closeLang(i); onTranslate(i, true); }}>{t("Remove the translation")}</button>}
                {seg.lang && (
                  <button type="button" className="btn small" disabled={!canRetranscribe} aria-describedby={!canRetranscribe ? `pw-${i}` : undefined} onClick={() => { closeLang(i); onRetranscribe(i, seg.lang!); }}>{t("Transcribe this line again in {language}", { language: langName(seg.lang) })}</button>
                )}
              </div>
              {seg.lang && !canRetranscribe && <p className="note" id={`pw-${i}`}>{t("Wait until the current transcription finishes.")}</p>}
              <div className="pv-pop-foot"><button type="button" className="btn quiet small" onClick={() => closeLang(i)}>{t("Close")}</button></div>
            </div>
          )}
          {seg.chapter && chap !== i && (
            <div className="pv-chapter"><span className="pv-flag" title={t("A chapter starts here")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>{t("Chapter")}</span><b dir="auto">{seg.chapter}</b></div>
          )}
          {chap === i && (
            <div className="pv-editor pv-chap-edit" role="group" aria-label={t("Chapter title")}>
              <input autoFocus dir="auto" type="text" value={chapDraft} aria-label={t("Chapter title")} placeholder={t("Chapter title")} onChange={(e) => setChapDraft(e.target.value)} onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeChap(i); } if (e.key === "Enter") { e.preventDefault(); saveChap(i); } }} />
              <div className="pv-editor-row">
                <button type="button" className="btn sun small" onClick={() => saveChap(i)}>{t("Save")}</button>
                {seg.chapter && <button type="button" className="btn quiet small" onClick={() => { onChapter(i, null); closeChap(i); }}>{t("Remove")}</button>}
                <button type="button" className="btn quiet small" onClick={() => closeChap(i)}>{t("Cancel")}</button>
              </div>
            </div>
          )}
          {editing === i ? (
            <div className="pv-editor">
              <textarea autoFocus dir="auto" ref={editArea} value={draft} rows={Math.max(2, Math.ceil(draft.length / 60))} aria-label={t("Edit this line")}
                onChange={(e) => setDraft(e.target.value)} onSelect={(e) => setTypedSel([e.currentTarget.selectionStart, e.currentTarget.selectionEnd])}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); saveEdit(); } // Enter saves; Shift+Enter would add a line break, ⌘/Ctrl+Enter also saves
                }} />
              <div className="pv-editor-row">
                <button type="button" className="btn sun small" onClick={saveEdit}>{t("Save")}</button>
                <button type="button" className="btn quiet small" onClick={() => setEditing(null)}>{t("Cancel")}</button>
                {onHighlight && typedSel[1] > typedSel[0] && draft === seg.text && (() => { const r = wordsInSelection(seg, typedSel[0], typedSel[1]); return r && r[1] > r[0] ? (
                  <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => { highlight(i, r[0], r[1]); setEditing(null); }} title={t("Keep the selected words as a highlight: it can be exported as text and as audio.")}>{t("Highlight selection")}</button>
                ) : null; })()}
                <span className="note">{t("Enter saves, Esc cancels. Words keep their timing.")}</span>
              </div>
            </div>
          ) : (
          splitting === i ? (
            <div className="pv-editor pv-split" role="group" aria-label={t("Split this line")}>
              <p className="pv-read" dir="auto">
                {seg.words.map((w, j) => (
                  <button key={j} type="button" className="pv-w pv-cut" disabled={j === 0} onClick={() => { onSplit(i, j); setSplitting(null); }}
                    aria-label={j === 0 ? w.word.trim() : t("Start a new line at “{word}”", { word: w.word.trim() })}>{w.word}</button>
                ))}
              </p>
              <div className="pv-editor-row">
                <span className="note">{t("Click the word where the new line should start. Then change who said each part with the name above it.")}</span>
                {i > 0 && <button type="button" className="btn quiet small" onClick={() => { onJoin(i); setSplitting(null); }}>{t("Join with previous line")}</button>}
                <button type="button" className="btn quiet small" onClick={() => setSplitting(null)}>{t("Cancel")}</button>
              </div>
            </div>
          ) : (
          <p className="pv-read" dir="auto" title={t("Double-click a word to fix it")}
            onMouseUp={(e) => { const root = e.currentTarget; window.setTimeout(() => pickWords(i, root), 0); }}
            onMouseDown={(e) => { if (e.detail === 1) wasPlaying.current = playing; }}
            onDoubleClick={(e) => {
              cancelPlay(); // the click that began this double-click must not start the audio
              if (!wasPlaying.current) onPause();
              const w = (e.target as HTMLElement).closest<HTMLElement>("[data-w]")?.dataset.w;
              startEdit(i, w === undefined ? undefined : Number(w));
            }}>
            {seg.words.map((w, j) => (
              <span key={j} className={"pv-w" + (time >= w.start && time < w.end ? " cur" : "") + (isUnsure(w) ? " weak" : "") + (reviewAt && reviewAt.seg === i && reviewAt.word === j ? " rv" : "") + (q && fm.test(w.word) ? " hit" : "") + hlClass(w) + (kb?.seg === i && j >= Math.min(kb.anchor, kb.head) && j <= Math.max(kb.anchor, kb.head) ? " sel" : "")} data-w={j} aria-describedby={isUnsure(w) ? "pv-unsure-label" : undefined} title={isUnsure(w) ? t("The model was not sure about this word. Listen to check it.") : undefined} onClick={(e) => playFrom(e, w.start)}>{w.word}</span>
            ))}
          </p>
          )
          )}
          {!easy && picked?.seg === i && editing !== i && splitting !== i && (
            <div ref={bar} className="pv-picked" role="toolbar" aria-label={t("Actions for the selected words")} style={barAt ? { top: barAt.top, left: barAt.left } : { visibility: "hidden" }}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); cancelPick(); } else arrowKeys(e); }}>
              <button type="button" className="btn sun small" onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(i, picked.from, picked.to)}>{t("Highlight this passage")}</button>
              <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => copyPicked(i, picked.from, picked.to)} title={t("Copy as a quote, with speaker and time")}>{t("Copy quote")}</button>
              <button type="button" className="btn small" aria-pressed={!!seg.marked} onMouseDown={(e) => e.preventDefault()} onClick={() => onMark(i)} title={t("Mark this line as a decision, action item or quote. Marked lines go into the meeting minutes and the quote list.")}>{seg.marked ? t("Marked ✓") : t("Mark")}</button>
              <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => { const r = rangeOfWords(seg.words, picked.from, picked.to); if (r && onPlayRange) onPlayRange(r.start, r.end); else onSeek(seg.words[picked.from]?.start ?? seg.start); }}>{t("Play from selection")}</button>
              <span className="note">{t("{count} words selected", { count: picked.to - picked.from + 1 })}</span>
            </div>
          )}
          {translatingIndex === i && <p className="pv-trans" role="status">{t("Translating…")}</p>}
          {seg.translation && editing !== i && (
            <p className="pv-trans" dir="auto" lang={seg.translationLang ?? "en"} aria-label={seg.translationLang && seg.translationLang !== "en" ? t("Translation") : t("English translation")}><span className="pv-flag pv-lang" aria-hidden="true">{(seg.translationLang ?? "en").toUpperCase()}</span> {seg.translation}</p>
          )}
          {seg.edited && editing !== i && (
            <div className="pv-edited"><span>{t("Edited")}</span><button type="button" className="link-btn" onClick={() => onRevert(i)} aria-label={t("Put the line at {time} back to what the model heard", { time: fmt(seg.start) })}>{t("Put back what the model heard")}</button></div>
          )}
        </div>
        );
      })}
      </div>
      {playing && !follow && active >= 0 && (
        <button type="button" className="btn small pv-follow" onClick={() => setFollow(true)}>{t("Back to the playing line")}</button>
      )}
    </>
  );
}
