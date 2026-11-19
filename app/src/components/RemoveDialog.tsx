import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { Project } from "../types";

type Receipt = Awaited<ReturnType<typeof window.api.deleteProjectFiles>>;
interface Props { project: Project; /** Another project uses the same recording (a duplicate): its files are kept. */ shared?: boolean; onDone(): void; onClose(): void }

/** Delete a project: first say exactly what goes and what stays, then, after it is done, a receipt of what was removed. Names only, never transcript text. */
export default function RemoveDialog({ project, shared = false, onDone, onClose }: Props) {
  const t = useT();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const done = !!receipt;
  useEffect(() => { first.current?.focus(); }, [done]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); if (!busy) done ? finish() : onClose(); return; }
      if (e.key !== "Tab") return;
      const els = box.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!els?.length) return;
      const a = els[0], z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });
  const finish = () => { onDone(); };
  const run = async () => {
    if (shared) { setReceipt({ ok: false, error: "shared" }); return; } // a copy of this project still uses the recording and its backup file
    setBusy(true);
    let r: Receipt;
    try { r = await window.api.deleteProjectFiles(project.path); } catch { r = { ok: false, error: "failed" }; }
    setBusy(false); setReceipt(r);
  };
  const file = project.path.split(/[\\/]/).pop() ?? project.path;
  const line = (state: "removed" | "none" | "failed" | "kept", what: string) =>
    <li key={what}><b>{state === "removed" ? t("Deleted") : state === "none" ? t("Not found") : state === "failed" ? t("Could not delete") : t("Kept")}</b> {what}</li>;

  return (
    <div className="scrim win" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) done ? finish() : onClose(); }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={t("Delete “{name}” and its files?", { name: project.name })} ref={box}>
        {!receipt && (<>
          <h2>{t("Delete “{name}” and its files?", { name: project.name })}</h2>
          <p><b>{t("This deletes:")}</b></p>
          <ul className="rm-list">
            <li>{t("The transcript, edits, highlights and summary stored in this app.")}</li>
            <li>{t("The backup file next to the recording, if there is one.")}</li>
            <li>{t("The recording itself, only if it was made inside Cassette.")}</li>
          </ul>
          <p><b>{t("This does not touch:")}</b></p>
          <ul className="rm-list">
            <li>{t("Your own audio file “{file}”, if you added it.", { file })}</li>
            <li>{t("Anything you exported or saved as a clip. Cassette does not keep a list of those.")}</li>
            <li>{t("The activity log, which lists file names (Settings, Privacy).")}</li>
          </ul>
          {shared && <p className="note">{t("Another project (a copy) uses the same recording, so the recording and its backup file stay.")}</p>}
          <p>{t("This cannot be undone.")}</p>
          <div className="row">
            <button type="button" className="btn" ref={first} onClick={onClose} disabled={busy}>{t("Keep it")}</button>
            <button type="button" className="btn danger" onClick={() => void run()} disabled={busy}>{busy ? t("Deleting…") : t("Delete")}</button>
          </div>
        </>)}
        {receipt && (<>
          <h2>{t("Deleted “{name}”", { name: project.name })}</h2>
          {receipt.ok ? (
            <>
              <ul className="rm-list rm-receipt" aria-label={t("Receipt")}>
                <li><b>{t("Deleted")}</b> {t("The transcript and its edits in this app.")}</li>
                {line(receipt.backup, receipt.backupName)}
                {receipt.appMade ? line(receipt.audio, receipt.audioName) : line("kept", receipt.audioName)}
              </ul>
              {(receipt.backup === "failed" || receipt.audio === "failed") && <p className="alert warn" role="alert">{t("Some files could not be deleted. Close any program that is using them, then delete them by hand.")}</p>}
            </>
          ) : shared ? <p className="note">{t("Another project still uses this recording, so the recording and its backup file were kept.")}</p>
          : <p className="alert warn" role="alert">{t("The files next to the recording could not be checked. The transcript in this app was deleted.")}</p>}
          <p>{t("This receipt is shown once and is not saved anywhere.")}</p>
          <div className="row"><button type="button" className="btn sun" ref={first} onClick={finish}>{t("Done")}</button></div>
        </>)}
      </div>
    </div>
  );
}
