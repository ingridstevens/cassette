import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../styles/shell.css";
import { useT } from "../i18n";
import { FILTER_MIN, filterProjects } from "../projectFilter";
import { mediaKind, menuStep } from "../projectActions";
import { IS_MAC, JobProgress, MOD_KEY, Project, fmt } from "../types";

interface Props {
  projects: Project[]; activeId: string | null; progress: Record<string, JobProgress>; blocker: string;
  onSelect(id: string): void; onAdd(): void; onRecord(): void; onRemove(id: string): void; onRename(id: string, name: string): void; onDuplicate(id: string): string | null; onReveal(path: string): void; onTranscribeAll(): void; onExportAll(): void; doneCount: number;
  onOpenSettings(): void;
  activity?: React.ReactNode;
  playingId?: string | null;
  /** Easy mode: no Record, no Export all, no activity log. */ easy?: boolean;
}

const DOT: Record<Project["status"], string> = { idle: "idle", queued: "wait", running: "run", done: "done", error: "err" };

export default function ProjectSidebar({ projects, activeId, progress, blocker, onSelect, onAdd, onRecord, onRemove, onRename, onDuplicate, onReveal, onTranscribeAll, onExportAll, doneCount, onOpenSettings, activity, playingId, easy = false }: Props) {
  const t = useT();
  const langName = (c: string) => (c === "de" ? t("German") : c === "en" ? t("English") : c === "fr" ? t("French") : c === "es" ? t("Spanish") : c.toUpperCase());
  const [editing, setEditing] = useState<string | null>(null);
  /** The row whose "…" menu is open, where the menu goes (fixed, so the scrolling list cannot clip it), and what was just done (read out). */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [said, setSaid] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const closeMenu = (refocus = true) => { const id = menuFor; setMenuFor(null); setPos(null); if (refocus && id) triggers.current.get(id)?.focus(); };
  const todo = projects.filter((p) => p.status === "idle" || p.status === "error").length;
  const queue = projects.filter((p) => p.status === "queued");
  // Filter field: only for long lists. In the icon rail (below 900px) the field is hidden, so a leftover query must not keep hiding projects.
  const [q, setQ] = useState("");
  const [fieldShown, setFieldShown] = useState(true);
  const fieldRef = useRef<HTMLInputElement>(null);
  const canFilter = projects.length > FILTER_MIN;
  useEffect(() => {
    const el = fieldRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setFieldShown(el.offsetWidth > 0));
    ro.observe(el.closest("nav") ?? el); setFieldShown(el.offsetWidth > 0); return () => ro.disconnect();
  }, [canFilter]);
  const query = canFilter && fieldShown ? q : "";
  const shown = filterProjects(projects, query);
  // A filter that hides the row whose menu is open closes the menu.
  useEffect(() => { if (menuFor && !shown.some((p) => p.id === menuFor)) { setMenuFor(null); setPos(null); } }, [menuFor, shown]);
  useLayoutEffect(() => {
    if (!menuFor) return;
    const btn = triggers.current.get(menuFor), box = menuRef.current; if (!btn || !box) return;
    const zoom = parseFloat(getComputedStyle(document.body).getPropertyValue("--zoom")) || 1; // the text size is a body zoom; fixed positions are in zoomed pixels
    // The menu is first drawn at left 0, top 0: where that lands tells whether an ancestor (a blurred panel) is the reference for "fixed" instead of the window.
    const r = btn.getBoundingClientRect(), o = box.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, vh = window.innerHeight / zoom;
    const ox = o.left / zoom, oy = o.top / zoom;
    const left = r.right / zoom - w < 8 ? r.right / zoom + 4 : r.right / zoom - w, // not enough room to the left (the icon rail): open to the right of the rail
      below = r.bottom / zoom + 2;
    setPos({ left: left - ox, top: (below + h > vh - 8 ? Math.max(8, r.top / zoom - h - 2) : below) - oy });
  }, [menuFor]);
  // Focus the first item once the menu is visible (a hidden element cannot take focus).
  useEffect(() => { if (menuFor && pos) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, [menuFor, pos]);
  useEffect(() => {
    if (!menuFor) return;
    const out = (e: MouseEvent) => { const el = e.target as Node; if (!menuRef.current?.contains(el) && !triggers.current.get(menuFor)?.contains(el)) closeMenu(false); };
    const onScroll = () => closeMenu(false);
    document.addEventListener("mousedown", out); window.addEventListener("resize", onScroll);
    return () => { document.removeEventListener("mousedown", out); window.removeEventListener("resize", onScroll); };
  }, [menuFor]);
  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
    if (e.key === "Tab") { closeMenu(false); return; }
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const to = menuStep(e.key, items.indexOf(document.activeElement as HTMLElement), items.length);
    if (to >= 0) { e.preventDefault(); items[to].focus(); }
  };
  const live = query.trim() ? (shown.length === 0 ? t("No projects match “{text}”.", { text: q.trim() }) : shown.length === 1 ? t("1 project shown") : t("{count} projects shown", { count: shown.length })) : "";
  return (
    <nav className="side" aria-label={t("Projects")}>
      <div className={"brand" + (projects.some((p) => p.status === "running") ? " busy" : "")} aria-hidden="true">
        <svg viewBox="0 0 32 32" className="brand-mark"><rect width="32" height="32" rx="7" className="bm-bg" />
          <rect x="2.24" y="6.4" width="27.52" height="19.2" rx="2.88" className="bm-body" /><rect x="5.12" y="8.32" width="21.76" height="5.44" rx=".96" className="bm-label" />
          <rect x="6.72" y="9.92" width="9.6" height="2.24" rx="1.12" className="bm-bar" /><rect x="17.92" y="9.92" width="7.04" height="2.24" rx="1.12" className="bm-amber" />
          <rect x="5.12" y="15.36" width="21.76" height="7.68" rx="3.84" className="bm-win" />
          <g className="reel" style={{ transformOrigin: "10.56px 19.2px" }}><circle cx="10.56" cy="19.2" r="2.88" className="bm-reel" /><circle cx="11.2" cy="18.88" r="1.34" className="bm-pupil" /></g>
          <g className="reel" style={{ transformOrigin: "21.44px 19.2px" }}><circle cx="21.44" cy="19.2" r="2.88" className="bm-reel" /><circle cx="22.08" cy="18.88" r="1.34" className="bm-pupil" /></g></svg>
        <span>Cassette</span>
      </div>
      <button type="button" className="btn sun add-btn" onClick={onAdd}>
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{t("Add recordings")}
      </button>
      {!easy && <button type="button" className="btn add-btn rec-btn" onClick={onRecord}>
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" /></svg>{t("Record")}
      </button>}
      <div className="group group-row"><span id="proj-group">{t("Projects")}</span>
        {todo > 1 && <button type="button" className="btn small" disabled={!!blocker} title={blocker || undefined} onClick={onTranscribeAll}>{t("Transcribe all ({count})", { count: todo })}</button>}
      </div>
      {canFilter && (
        <div className="pf" role="search">
          <label htmlFor="proj-filter" className="pf-sr">{t("Filter projects")}</label>
          <input id="proj-filter" ref={fieldRef} className="input" type="search" placeholder={t("Filter projects")} value={q} autoComplete="off" spellCheck={false}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && q) { e.preventDefault(); e.stopPropagation(); setQ(""); } }} />
          {q && <button type="button" className="pf-clear" aria-label={t("Clear filter")} title={t("Clear filter")} onClick={() => { setQ(""); fieldRef.current?.focus(); }}>×</button>}
        </div>
      )}
      <div className="pf-sr" role="status" aria-live="polite" aria-atomic="true">{said || live}</div>
      <div className="plist" role="list" aria-labelledby="proj-group">
        {projects.length === 0 && <p className="note side-note">{t("Each recording you add becomes a project here, with its own transcript and speaker names.")}</p>}
        {query.trim() && shown.length === 0 && <p className="note side-note" aria-hidden="true">{t("No projects match “{text}”.", { text: q.trim() })}</p>}
        {shown.map((p) => {
          const pr = progress[p.id];
          const pct = pr?.fraction != null ? Math.round(pr.fraction * 100) : null;
          const sub = p.status === "done" && p.result
            ? `${langName(p.result.language)} · ${fmt(p.result.duration)} · ${p.result.speakers.length === 1 ? t("1 speaker") : t("{count} speakers", { count: p.result.speakers.length })}`
            : p.status === "running" ? (pct != null ? t("Transcribing · {pct}%", { pct }) : t("Transcribing…"))
            : p.status === "queued" ? t("Waiting · position {n} in line", { n: queue.findIndex((q) => q.id === p.id) + 1 })
            : p.status === "error" ? t("Failed. Open to try again") : t("Not transcribed yet");
          return (
            <div key={p.id} role="listitem" className={"prow" + (p.id === activeId ? " on" : "")}>
              {editing === p.id ? (
                <div className="nav on"><span className={"st " + DOT[p.status]} aria-hidden />
                  <input autoFocus className="input rename" defaultValue={p.name} aria-label={t("Project name")}
                    onBlur={(e) => { onRename(p.id, e.target.value.trim() || p.name); setEditing(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }} /></div>
              ) : (
                <button type="button" className={"nav" + (p.id === activeId ? " on" : "")} onClick={() => onSelect(p.id)} onDoubleClick={() => setEditing(p.id)}
                  onKeyDown={(e) => { if (e.key === "F2") setEditing(p.id); }}
                  aria-current={p.id === activeId ? "page" : undefined} title={`${p.path}\n${t("Double-click or press F2 to rename")}`}>
                  <span className={"st " + DOT[p.status]} aria-hidden />
                  <span className="nav-ini" aria-hidden>{[...p.name.trim()][0]?.toUpperCase() ?? "·"}</span>
                  <span className="grow"><b>{p.name}</b><small><span className={"kind " + mediaKind(p.path)}>{mediaKind(p.path) === "video" ? t("Video") : t("Audio")}</span> · {sub}</small>
                    {p.status === "running" && <div className="minibar" role="progressbar" aria-label={t("Progress for {name}", { name: p.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}><i style={{ width: `${pct ?? 5}%` }} /></div>}
                  </span>
                  {playingId === p.id && <span className="eq" role="img" aria-label={t("Playing now")}><i /><i /><i /></span>}
                </button>
              )}
              <button type="button" className="px" ref={(el) => { if (el) triggers.current.set(p.id, el); else triggers.current.delete(p.id); }}
                aria-label={t("Actions for {name}", { name: p.name })} title={t("Actions for {name}", { name: p.name })} aria-haspopup="menu" aria-expanded={menuFor === p.id}
                onClick={() => { if (menuFor === p.id) closeMenu(false); else { setSaid(""); setPos(null); setMenuFor(p.id); } }}
                onKeyDown={(e) => { if (e.key === "ArrowDown" && menuFor !== p.id) { e.preventDefault(); setSaid(""); setPos(null); setMenuFor(p.id); } }}>
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg></button>
              {menuFor === p.id && createPortal(
                <div ref={menuRef} className="menu prow-menu" role="menu" aria-label={t("Actions for {name}", { name: p.name })} onKeyDown={onMenuKey}
                  style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}>
                  <button type="button" role="menuitem" onClick={() => { closeMenu(false); setEditing(p.id); }}>{t("Rename")}</button>
                  {!easy && <button type="button" role="menuitem" onClick={() => { closeMenu(); const n = onDuplicate(p.id); if (n) setSaid(t("Duplicated as “{name}”", { name: n })); }}>{t("Duplicate")}</button>}
                  <button type="button" role="menuitem" onClick={() => { closeMenu(); onReveal(p.path); }}>{IS_MAC ? t("Show in Finder") : t("Show in file explorer")}</button>
                  <button type="button" role="menuitem" className="danger-item" onClick={() => { closeMenu(false); onRemove(p.id); }}>{t("Delete…")}</button>
                </div>, document.body)}
            </div>
          );
        })}
      </div>
      {!easy && doneCount > 1 && <button type="button" className="btn small" onClick={onExportAll} title={t("One spreadsheet with every finished project")}>{t("Export all as CSV ({count})", { count: doneCount })}</button>}
      <div className="spacer" />
      {!easy && activity && <div className="side-activity">{activity}</div>}
      <button type="button" className="nav settings-row" onClick={onOpenSettings} aria-keyshortcuts={IS_MAC ? "Meta+," : "Control+,"}>
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /><circle cx="12" cy="12" r="3" /></svg>
        <span className="grow"><b>{t("Settings")}</b><small>{t("For all projects")}</small></span>
        <span className="kbd" aria-hidden>{MOD_KEY},</span>
      </button>
    </nav>
  );
}
