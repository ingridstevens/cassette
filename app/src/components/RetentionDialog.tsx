import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { Project } from "../types";
import { ageDays } from "../retention";

type Row = { id: string; name: string; state: "deleted" | "partly" | "failed" };
interface Props { projects: Project[]; days: number; onDelete(ids: string[]): void; onClose(): void }

/** Old projects (older than the retention period): list them, ask, and only then delete, one receipt for all. Names and counts only, never text. */
export default function RetentionDialog({ projects, days, onDelete, onClose }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { first.current?.focus(); }, [rows]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); if (!busy) { if (rows) finish(); else close.current(); } }
      else if (e.key === "Tab") { const b = document.querySelectorAll<HTMLElement>(".dialog button:not([disabled])"); if (!b.length) return; const a = b[0], z = b[b.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });
  const finish = () => { onDelete((rows ?? []).filter((r) => r.state !== "failed").map((r) => r.id)); };
  const run = async () => {
    setBusy(true);
    const out: Row[] = [];
    for (const p of projects) {
      let state: Row["state"] = "deleted";
      try {
        const r = await window.api.deleteProjectFiles(p.path);
        if (!r.ok) state = "partly";
        else if (r.backup === "failed" || r.audio === "failed") state = "partly";
      } catch { state = "partly"; }
      out.push({ id: p.id, name: p.name, state });
    }
    setBusy(false); setRows(out);
  };
  const label = (s: Row["state"]) => (s === "deleted" ? t("Deleted") : s === "partly" ? t("Deleted in the app; some files could not be checked") : t("Could not delete"));
  return (
    <div className="scrim win" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) { if (rows) finish(); else onClose(); } }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={t("Old projects")}>
        {!rows && (<>
          <h2>{projects.length === 1 ? t("Delete 1 old project?") : t("Delete {count} old projects?", { count: projects.length })}</h2>
          <p>{t("These were added more than {days} days ago. You chose to be asked about projects older than that. Nothing is deleted until you press Delete.", { days })}</p>
          <ul className="rm-list">{projects.map((p) => <li key={p.id}>{t("{name}, added {n} days ago", { name: p.name, n: ageDays(p.addedAt) })}</li>)}</ul>
          <p>{t("Deleting removes each project's transcript and edits, its backup file next to the recording, and the recording only if Cassette made it. Your own audio files are never touched. This cannot be undone.")}</p>
          <div className="row">
            <button type="button" className="btn" ref={first} onClick={onClose} disabled={busy}>{t("Keep them for now")}</button>
            <button type="button" className="btn danger" onClick={() => void run()} disabled={busy}>{busy ? t("Deleting…") : t("Delete")}</button>
          </div>
        </>)}
        {rows && (<>
          <h2>{t("Old projects deleted")}</h2>
          <ul className="rm-list rm-receipt" aria-label={t("Receipt")}>{rows.map((r) => <li key={r.id}><b>{label(r.state)}</b> {r.name}</li>)}</ul>
          <p>{t("This receipt is shown once and is not saved anywhere.")}</p>
          <div className="row"><button type="button" className="btn sun" ref={first} onClick={finish}>{t("Done")}</button></div>
        </>)}
      </div>
    </div>
  );
}
