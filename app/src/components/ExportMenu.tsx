import { KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { ExportOpts, LastExport } from "../types";
import { ALL, EXPORT_CHOICES, GROUPS, shownFormats } from "../exportFormats";
import ExportOptions, { OptionsKind, loadExportOpts } from "./ExportOptions";
import "../styles/project.css";

export { EXPORT_CHOICES };
/** Technical names that are the same in every language; the other formats use their menu label. */
const SHORT: Record<string, string> = { srt: "SRT", vtt: "VTT", edl: "EDL", csv: "CSV", json: "JSON" };

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
export const STYLED = new Set(["txt", "md", "copy-md", "docx", "csv", "minutes", "redacted"]);
/** Options a format needs when it is run without asking (the saved ones for subtitles and styled text, none for the rest). */
const usualOpts = (f: string): Record<string, unknown> => (WITH_OPTIONS.has(f) || STYLED.has(f) ? { ...loadExportOpts() } : {});
export default function ExportMenu({ onExport, openSignal = 0, hasChapters = false, markedCount = 0, lastExport, defaultFormat, onRemember, easy = false, shown, onOpenSettings }: { easy?: boolean; /** The formats chosen in Settings to show up front (undefined = the default set). */ shown?: string[]; onOpenSettings?(section?: string): void; onExport(format: string, options?: ExportOpts): Promise<Res>; openSignal?: number; hasChapters?: boolean; markedCount?: number; lastExport?: LastExport; defaultFormat?: string; onRemember?(format: string, options: Record<string, unknown>): void }) {
  const t = useT();
  const [asking, setAsking] = useState<OptionsKind | null>(null);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
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
    if (r.ok && f !== "text" && f !== "copy-md") onRemember?.(f, { ...(o ?? {}) });
    setBad(!r.ok); setMsg(r.ok ? (f === "copy-md" ? t("Copied as Markdown ✓") : f === "redacted" ? t("Exported ✓. A report and a key file were saved next to it. Keep the key apart from the data.") : t("Exported ✓")) : t("Export failed: {reason}", { reason: r.error ?? t("unknown error") }));
    setTimeout(() => setMsg(""), r.ok ? 2800 : 8000);
  };
  // The first item: what this project was last exported as, or else the default from Settings.
  const again = lastExport ?? (defaultFormat ? { format: defaultFormat, options: usualOpts(defaultFormat) } : null);
  const againRow = again && ALL.find((x) => x[0] === again.format);
  const againOk = !easy && !!againRow && !(again!.format === "chapters" && !hasChapters) && !(["quotes", "highlights"].includes(again!.format) && !markedCount);
  const againText = (() => {
    if (!again || !againRow) return "";
    const o = again.options as Partial<ExportOpts>, f = again.format;
    const name = SHORT[f] ?? t(againRow[1]);
    const details = f === "srt" || f === "vtt" ? (o.maxLines === 1 ? t("1 line, {chars} characters", { chars: o.maxChars ?? 42 }) : t("{lines} lines, {chars} characters", { lines: o.maxLines ?? 2, chars: o.maxChars ?? 42 })) : f === "edl" ? t("{fps} fps", { fps: o.fps ?? 25 }) : "";
    const label = details ? t("{format} ({details})", { format: name, details }) : name;
    return lastExport ? t("Again: {what}", { what: label }) : t("Usual: {what}", { what: label });
  })();
  const up = shownFormats(shown, easy);
  const host = trigger.current?.closest(".pview") ?? document.body;
  const item = ([f, label, hint]: readonly [string, string, string]) => (
    <button key={f} type="button" role="menuitem" aria-disabled={(f === "chapters" && !hasChapters) || ((f === "quotes" || f === "highlights") && !markedCount) ? true : undefined}
      onClick={() => {
        if ((f === "chapters" && !hasChapters) || ((f === "quotes" || f === "highlights") && !markedCount)) return;
        setOpen(false); trigger.current?.focus();
        if (WITH_OPTIONS.has(f)) setAsking(f as OptionsKind); else run(f, STYLED.has(f) ? loadExportOpts() : undefined);
      }}>
      <b>{t(label)}</b><small>{f === "chapters" && !hasChapters ? t("Mark chapters first: use “Chapter” on a line") : (f === "quotes" || f === "highlights") && !markedCount ? t("Highlight words or mark a line first") : t(hint)}</small>
    </button>
  );
  return (
    <>
      {asking && createPortal(<ExportOptions kind={asking} onCancel={() => setAsking(null)} onConfirm={(o) => { const f = asking; setAsking(null); if (f !== "text") run(f, o); }} />, host)}
      <div className="pv-export" ref={box}>
        <button ref={trigger} type="button" className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>{t("Export")}
        </button>
        {open && (
          <div className={"menu pv-export-menu" + (flip ? " flip" : "")} role="menu" aria-label={t("Export transcript")} onKeyDown={onMenuKeyDown}>
            {againOk && again && (
              <div role="group" aria-label={t("Export again")}>
                <button type="button" role="menuitem" className="menu-again" onClick={() => {
                  setOpen(false); trigger.current?.focus();
                  run(again.format, Object.keys(again.options).length ? (again.options as unknown as ExportOpts) : undefined);
                }}><b>{againText}</b></button>
              </div>
            )}
            {up.length > 0 && (
              <div role="group" aria-label={t("Most used")}>
                {up.map((f) => item(ALL.find((x) => x[0] === f)!))}
              </div>
            )}
            {!easy && <button type="button" role="menuitem" className="menu-more" aria-expanded={more} onClick={() => setMore(!more)}>
              <b>{more ? t("Fewer formats") : t("More formats…")}</b>
            </button>}
            {!easy && more && GROUPS.map((g) => {
              const rest = g.formats.filter(([f]) => !up.includes(f));
              return rest.length === 0 ? null : (
                <div key={g.title} role="group" aria-label={t(g.title)}>
                  <div className="menu-head" aria-hidden="true">{t(g.title)}</div>
                  {rest.map(item)}
                </div>
              );
            })}
            {!easy && more && onOpenSettings && (
              <button type="button" role="menuitem" className="menu-more" onClick={() => { setOpen(false); onOpenSettings("Saving and export"); }}>
                <b>{t("Choose which formats to show…")}</b>
              </button>
            )}
          </div>
        )}
      </div>
      {/* The live regions stay in the page and only their text changes: a region inserted together with its text is often not announced. */}
      <div className="pv-sr" role="status" aria-live="polite" aria-atomic="true">{bad ? "" : msg}</div>
      <div className="pv-sr" role="alert" aria-atomic="true">{bad ? msg : ""}</div>
      {msg && <div className={"toast" + (bad ? " pv-toast-bad" : "")} aria-hidden="true"><span>{msg}</span></div>}
    </>
  );
}
