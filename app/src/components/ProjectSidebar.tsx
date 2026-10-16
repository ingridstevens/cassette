import { useState } from "react";
import "../styles/shell.css";
import { useT } from "../i18n";
import { IS_MAC, JobProgress, MOD_KEY, Project, fmt } from "../types";

interface Props {
  projects: Project[]; activeId: string | null; progress: Record<string, JobProgress>; blocker: string;
  onSelect(id: string): void; onAdd(): void; onRecord(): void; onRemove(id: string): void; onRename(id: string, name: string): void; onTranscribeAll(): void; onExportAll(): void; doneCount: number;
  onOpenSettings(): void;
  activity?: React.ReactNode;
  playingId?: string | null;
}

const DOT: Record<Project["status"], string> = { idle: "idle", queued: "wait", running: "run", done: "done", error: "err" };

export default function ProjectSidebar({ projects, activeId, progress, blocker, onSelect, onAdd, onRecord, onRemove, onRename, onTranscribeAll, onExportAll, doneCount, onOpenSettings, activity, playingId }: Props) {
  const t = useT();
  const langName = (c: string) => (c === "de" ? t("German") : c === "en" ? t("English") : c === "fr" ? t("French") : c === "es" ? t("Spanish") : c.toUpperCase());
  const [editing, setEditing] = useState<string | null>(null);
  const todo = projects.filter((p) => p.status === "idle" || p.status === "error").length;
  const queue = projects.filter((p) => p.status === "queued");
  return (
    <nav className="side" aria-label={t("Projects")}>
      <button type="button" className="btn sun add-btn" onClick={onAdd}>
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{t("Add recordings")}
      </button>
      <button type="button" className="btn add-btn rec-btn" onClick={onRecord}>
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" /></svg>{t("Record")}
      </button>
      <div className="group" id="proj-group">{t("Projects")}</div>
      <div className="plist" role="list" aria-labelledby="proj-group">
        {projects.length === 0 && <p className="note side-note">{t("Each recording you add becomes a project here, with its own transcript and speaker names.")}</p>}
        {projects.map((p) => {
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
                  <span className="grow"><b>{p.name}</b><small>{sub}</small>
                    {p.status === "running" && <div className="minibar" role="progressbar" aria-label={t("Progress for {name}", { name: p.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}><i style={{ width: `${pct ?? 5}%` }} /></div>}
                  </span>
                  {playingId === p.id && <span className="eq" role="img" aria-label={t("Playing now")}><i /><i /><i /></span>}
                </button>
              )}
              <button type="button" className="px" aria-label={t("Remove {name} from the list", { name: p.name })} title={t("Remove from list (your audio file is not deleted)")}
                onClick={() => { if (confirm(t("Remove “{name}” from the list?", { name: p.name }) + "\n\n" + t("Your audio file is not deleted. Its transcript in this app will be."))) onRemove(p.id); }}>×</button>
            </div>
          );
        })}
      </div>
      {doneCount > 1 && <button type="button" className="btn small" onClick={onExportAll} title={t("One spreadsheet with every finished project")}>{t("Export all as CSV ({count})", { count: doneCount })}</button>}
      {todo > 1 && <button type="button" className="btn small" disabled={!!blocker} title={blocker || undefined} onClick={onTranscribeAll}>{t("Transcribe all ({count})", { count: todo })}</button>}
      <div className="spacer" />
      {activity && <div className="side-activity">{activity}</div>}
      <div className="pill local"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{t("Everything stays on this computer")}</div>
      <button type="button" className="nav settings-row" onClick={onOpenSettings} aria-keyshortcuts={IS_MAC ? "Meta+," : "Control+,"}>
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /><circle cx="12" cy="12" r="3" /></svg>
        <span className="grow"><b>{t("Settings")}</b><small>{t("For all projects")}</small></span>
        <span className="kbd" aria-hidden>{MOD_KEY},</span>
      </button>
    </nav>
  );
}
