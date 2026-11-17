import { KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { ExportOpts } from "../types";
import ExportOptions, { OptionsKind, loadExportOpts } from "./ExportOptions";
import "../styles/project.css";

/** Grouped by what the export is for. */
const GROUPS: { title: string; formats: readonly (readonly [string, string, string])[] }[] = [
  { title: "Read and share", formats: [
    ["docx", "Word document", ".docx · speakers in bold, with times"],
    ["txt", "Plain text", ".txt · [time] Speaker: text"],
    ["md", "Markdown", ".md"],
    ["redacted", "Anonymised text", ".txt · names replaced by P01, P02…"],
    ["text", "Text style…", "Keep or remove “um”, mark pauses, show or hide times"],
  ] },
  { title: "Subtitles and video", formats: [
    ["srt", "Subtitles (.srt)", "Line length, speaker names, time shift"],
    ["vtt", "Web subtitles (.vtt)", "For web video"],
    ["chapters", "Chapters (text)", "0:00 Title per line · YouTube and podcasts"],
    ["edl", "Markers (DaVinci Resolve .edl)", "Chapters or speaker turns as timeline markers"],
  ] },
  { title: "Data", formats: [
    ["csv", "Spreadsheet", ".csv · start and end times, speaker, text"],
    ["json", "Everything (JSON)", ".json · all lines, words and speakers"],
    ["changes", "Original vs. edited", ".txt · every line you changed, before and after"],
  ] },
  { title: "Highlights and minutes", formats: [
    ["minutes", "Meeting minutes (Word)", ".docx · summary, attendees, decisions, key quotes, record"],
    ["highlights", "Highlights (Word)", ".docx · quotes with speaker, time and reason"],
    ["quotes", "Highlights and marked lines (text)", ".txt · your highlights and marked lines as quotes"],
  ] },
];

/** Arrow/Home/End navigation between the menu items of the menu that received the key. */
export function onMenuKeyDown(e: KeyboardEvent<HTMLElement>) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const to = e.key === "ArrowDown" ? (i + 1) % items.length : e.key === "ArrowUp" ? (i - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
  if (to < 0) return;
  e.preventDefault(); items[to].focus();
}

type Res = { ok?: boolean; cancelled?: boolean; path?: string; error?: string };
const WITH_OPTIONS = new Set(["srt", "vtt", "edl", "text"]);
/** Formats that follow the "Text style" settings. */
export const STYLED = new Set(["txt", "md", "docx", "csv", "minutes", "redacted"]);
export default function ExportMenu({ onExport, openSignal = 0, hasChapters = false, markedCount = 0 }: { onExport(format: string, options?: ExportOpts): Promise<Res>; openSignal?: number; hasChapters?: boolean; markedCount?: number }) {
  const t = useT();
  const [asking, setAsking] = useState<OptionsKind | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const [flip, setFlip] = useState(false);
  // The toolbar can wrap, leaving the button near the left edge: open rightwards then, so the menu is never clipped by the sidebar.
  useLayoutEffect(() => {
    if (!open || !box.current) { setFlip(false); return; }
    const edge = box.current.closest(".pview")?.getBoundingClientRect().left ?? 0;
    const b = box.current.getBoundingClientRect();
    setFlip(b.right - 300 < edge + 8);
  }, [open]);
  useEffect(() => { if (open) box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const run = async (f: string, o?: ExportOpts) => {
    const r = await onExport(f, o).catch((e: unknown) => ({ ok: false, error: String(e) } as Res));
    if (r.cancelled) return;
    setBad(!r.ok); setMsg(r.ok ? t("Exported ✓") : t("Export failed: {reason}", { reason: r.error ?? t("unknown error") }));
    setTimeout(() => setMsg(""), r.ok ? 2800 : 8000);
  };
  const host = trigger.current?.closest(".pview") ?? document.body;
  return (
    <>
      {asking && createPortal(<ExportOptions kind={asking} onCancel={() => setAsking(null)} onConfirm={(o) => { const f = asking; setAsking(null); if (f !== "text") run(f, o); }} />, host)}
      <div className="pv-export" ref={box}>
        <button ref={trigger} type="button" className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>{t("Export")}
        </button>
        {open && (
          <div className={"menu pv-export-menu" + (flip ? " flip" : "")} role="menu" aria-label={t("Export transcript")} onKeyDown={onMenuKeyDown}>
            {GROUPS.map((g) => (
              <div key={g.title} role="group" aria-label={t(g.title)}>
                <div className="menu-head" aria-hidden="true">{t(g.title)}</div>
                {g.formats.map(([f, label, hint]) => (
                  <button key={f} type="button" role="menuitem" aria-disabled={(f === "chapters" && !hasChapters) || ((f === "quotes" || f === "highlights") && !markedCount) ? true : undefined}
                    onClick={() => {
                      if ((f === "chapters" && !hasChapters) || ((f === "quotes" || f === "highlights") && !markedCount)) return;
                      setOpen(false); trigger.current?.focus();
                      if (WITH_OPTIONS.has(f)) setAsking(f as OptionsKind); else run(f, STYLED.has(f) ? loadExportOpts() : undefined);
                    }}>
                    <b>{t(label)}</b><small>{f === "chapters" && !hasChapters ? t("Mark chapters first: use “Chapter” on a line") : (f === "quotes" || f === "highlights") && !markedCount ? t("Highlight words or mark a line first") : t(hint)}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {msg && <div className={"toast" + (bad ? " pv-toast-bad" : "")} role={bad ? "alert" : "status"}><span>{msg}</span></div>}
    </>
  );
}
