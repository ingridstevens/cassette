import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { MAIN_LANGS, WHISPER_LANGS, langName } from "../languages";
import { Highlight, UnsureRef, isUnsure, MOD_KEY, PALETTE, Result, chapterDefault, displayName, fmt, wordIn, wordsInSelection } from "../types";
import { onMenuKeyDown } from "./ExportMenu";
import { FIND_DEFAULTS, FindOpts, matcher } from "../find";
import "../styles/project.css";

interface Props {
  result: Result; names: Record<string, string>; time: number;
  onSeek(t: number): void; onReassign(index: number, speaker: string): void;
  onEdit(index: number, text: string): void; onRevert(index: number): void; onChapter(index: number, title: string | null): void; onMark(index: number): void; onSplit(index: number, wordIndex: number): void; onLanguage(index: number, lang: string | null): void; onRetranscribe(index: number, language: string): void; onTranslate(index: number, remove?: boolean): void; playing: boolean; onPause(): void; reviewAt?: UnsureRef | null; translatingIndex?: number | null; canRetranscribe: boolean; onJoin(index: number): void;
  highlights?: Highlight[]; onHighlight?(index: number, from: number, to: number): void;
  /** Show the language of every line, not only lines that differ from the recording. */ showLang?: boolean;
  query?: string; findOpts?: FindOpts; matchSeg?: number;
}

/** How long a click on a word waits for a possible second click before it starts playing (a typical double-click gap). */
const DOUBLE_CLICK_MS = 260;

export default function Transcript({ showLang, result, names, time, onSeek, onReassign, onEdit, onRevert, onChapter, onMark, onSplit, onJoin, onLanguage, onRetranscribe, onTranslate, playing, onPause, reviewAt = null, translatingIndex = null, canRetranscribe, highlights = [], onHighlight, query = "", findOpts = FIND_DEFAULTS, matchSeg = -1 }: Props) {
  const t = useT();
  const color = (sp: string) => PALETTE[Math.max(0, result.speakers.indexOf(sp)) % PALETTE.length];
  const label = (sp: string) => displayName(sp, result.speakers, names);
  const activeRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<number | null>(null);
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
    setPicked(idx.length >= 2 ? { seg: i, from: idx[0], to: idx[idx.length - 1] } : null);
  };
  useEffect(() => { // clicking elsewhere or collapsing the selection hides the offer
    if (!picked) return;
    const gone = () => { if (window.getSelection()?.isCollapsed) setPicked(null); };
    document.addEventListener("selectionchange", gone);
    return () => document.removeEventListener("selectionchange", gone);
  }, [picked]);
  const highlight = (i: number, from: number, to: number) => { onHighlight?.(i, from, to); setPicked(null); window.getSelection()?.removeAllRanges(); };
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
    navigator.clipboard.writeText(`${label(seg.speaker)} (${fmt(seg.start)}): ${seg.text}`);
    setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1800);
  };
  const menuBox = useRef<HTMLDivElement>(null);
  const active = result.segments.findIndex((s) => time >= s.start && time < s.end);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [active]);
  const fm = matcher(query, findOpts);
  const q = fm.q;
  useEffect(() => { matchRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [matchSeg, q]);
  const inUse = new Set(result.segments.map((s) => s.speaker));
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

  return (
    <>
      {result.segments.map((seg, i) => (
        <div key={i} ref={i === matchSeg ? matchRef : i === active ? activeRef : undefined}
          data-turn={i} className={"pv-turn" + (seg.marked ? " marked" : "") + (i === active ? " now" : "") + (i === matchSeg ? " found" : "")}>
          <div className="pv-who">
            <button type="button" className="pv-who-btn" data-who={i} aria-haspopup="menu" aria-expanded={menu === i}
              aria-label={t("Change who said the line at {time}. Now: {name}", { time: fmt(seg.start), name: label(seg.speaker) })} onClick={() => setMenu(menu === i ? null : i)}>
              <span className="sw" style={{ background: color(seg.speaker) }} aria-hidden />{label(seg.speaker)}
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14 }}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <button type="button" className="pv-time" onClick={() => onSeek(seg.start)} title={t("Play from here")} aria-label={t("Play from {time}", { time: fmt(seg.start) })}>{fmt(seg.start)}</button>
            {seg.marked && <span className="pv-flag pv-marked" title={t("Marked: goes into the meeting minutes and the quote list")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></svg>{t("Marked")}</span>}
            {(seg.lang && seg.lang !== result.language || mixed || showLang) && (
              <button type="button" className="pv-flag pv-lang pv-lang-btn" aria-haspopup="dialog" aria-expanded={langPop === i}
                aria-label={t("Language of this line: {language}. Change it.", { language: langName(seg.lang ?? result.language) })} title={t("This line is in {language}", { language: langName(seg.lang ?? result.language) })}
                onClick={() => { setMenu(null); setLangPop(langPop === i ? null : i); }}>{(seg.lang ?? result.language).toUpperCase()}</button>
            )}
            {seg.overlap && <span className="pv-flag pv-overlap" title={t("More than one person was talking here. The words are assigned to the louder speaker.")}>{t("Overlap")}</span>}
            <button type="button" className="pv-copy pv-edit" aria-pressed={!!seg.marked} onClick={() => onMark(i)} title={t("Mark this line as a decision, action item or quote. Marked lines go into the meeting minutes and the quote list.")}>{seg.marked ? t("Marked ✓") : t("Mark")}</button>
            <button type="button" className="pv-copy pv-edit" data-chap={i} onClick={() => startChap(i)} aria-label={seg.chapter ? t("Change the chapter at the line at {time}", { time: fmt(seg.start) }) : t("Add a chapter at the line at {time}", { time: fmt(seg.start) })} title={t("Mark where a new topic starts. Chapters can be exported as a list for YouTube or podcast show notes.")}>{t("Chapter")}</button>
            <button type="button" className="pv-copy pv-edit" aria-pressed={splitting === i} onClick={() => setSplitting(splitting === i ? null : i)} title={t("Split this line in two, for example when several people spoke in turn and the app put them in one line.")}>{t("Split")}</button>
            <button type="button" className="pv-copy pv-edit-btn" onClick={() => startEdit(i)} aria-label={t("Edit the text of the line at {time}", { time: fmt(seg.start) })} title={t("Fix the words of this line")}>{t("Edit")}</button>
            <button type="button" className="pv-copy" onClick={() => copyQuote(i)} aria-label={t("Copy this line as a quote with the speaker and time")} title={t("Copy as a quote, with speaker and time")}>{copied === i ? t("Copied ✓") : t("Copy quote")}</button>
          </div>
          {menu === i && (
            <div ref={menuBox} className="menu pv-turn-menu" role="menu" aria-label={t("Who said this line?")} onKeyDown={onMenuKeyDown}>
              <div className="pv-menu-title" aria-hidden>{t("Who said this line?")}</div>
              {result.speakers.filter((sp) => inUse.has(sp) || sp === seg.speaker).map((sp) => (
                <button key={sp} type="button" role="menuitemradio" aria-checked={sp === seg.speaker} onClick={() => { setMenu(null); onReassign(i, sp); document.querySelector<HTMLElement>(`[data-who="${i}"]`)?.focus(); }}>
                  <span className="pv-menu-item"><span className="sw" style={{ background: color(sp) }} aria-hidden /><b>{label(sp)}</b><span aria-hidden>{sp === seg.speaker ? "✓" : ""}</span></span>
                </button>
              ))}
              <div className="pv-menu-sep" role="separator" />
              <button type="button" role="menuitem" aria-haspopup="dialog" onClick={() => { setMenu(null); setLangPop(i); }}>
                <span className="pv-menu-item"><b>{t("Language and translation…")}</b></span>
                <small>{langName(seg.lang ?? result.language)}</small>
              </button>
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
              <span key={j} className={"pv-w" + (time >= w.start && time < w.end ? " cur" : "") + (isUnsure(w) ? " weak" : "") + (reviewAt && reviewAt.seg === i && reviewAt.word === j ? " rv" : "") + (q && fm.test(w.word) ? " hit" : "") + hlClass(w)} data-w={j} title={isUnsure(w) ? t("The model was not sure about this word. Listen to check it.") : undefined} onClick={(e) => playFrom(e, w.start)}>{w.word}</span>
            ))}
          </p>
          )
          )}
          {picked?.seg === i && editing !== i && splitting !== i && (
            <div className="pv-picked" role="group" aria-label={t("Highlight the selected words")}>
              <button type="button" className="btn sun small" onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(i, picked.from, picked.to)}>{t("Highlight this passage")}</button>
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
      ))}
    </>
  );
}
