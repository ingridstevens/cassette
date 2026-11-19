import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { bytes } from "../../types";
import type { Check } from "../../setupCheck";
import type { ModelStatus, Options } from "../../types";
import Dialog from "./Dialog";

type Files = { name: string; text: string; bytes: number }[];

/** "Export diagnostics": shows every file that would go into the zip, with its text, before anything is written. The window sends only a model name, the
 *  downloaded model names and the check results; the main process builds the files from an allowlist (electron/supportBundle.ts). */
export default function ExportDiagnostics({ opts, status, checks, onClose, say }: { opts: Options; status: ModelStatus | null; checks: Check[] | null; onClose(): void; say(s: string): void }) {
  const t = useT();
  const [log, setLog] = useState(true);
  const [files, setFiles] = useState<Files | null>(null);
  const [busy, setBusy] = useState(false);
  const req = () => ({ model: opts.model, downloaded: Object.entries(status?.whisper ?? {}).filter(([, v]) => v).map(([k]) => k), diarization: !!status?.diarization, checks: (checks ?? []).map((c) => ({ id: c.id, level: c.level })), includeLog: log });
  useEffect(() => { let live = true; setFiles(null); void window.api.bundlePreview(req()).then((f) => { if (live) setFiles(f ?? []); }); return () => { live = false; }; }, [log]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true);
    const r = await window.api.bundleSave(req());
    setBusy(false);
    if (r.cancelled) return;
    if (r.ok) { say(t("Diagnostics saved. Attach the file to your bug report yourself; nothing was sent.")); onClose(); }
    else say(t("The diagnostics could not be saved."));
  };
  return (
    <Dialog title={t("Export diagnostics")} keepLabel={t("Cancel")} okLabel={busy ? t("Saving…") : t("Save zip…")} okClass="btn sun" onKeep={onClose} onOk={() => { if (!busy && files) void save(); }}>
      <p>{t("This zip contains only the files listed here. No recordings, transcripts, project names, speaker names or token. Nothing is sent anywhere; you choose where to save it and attach it to a bug report yourself.")}</p>
      <label className="choice"><input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /><span>{t("Include the activity log (file names are hidden as far as the app can recognise them; read it below first)")}</span></label>
      {!files ? <p className="note" role="status">{t("Preparing the list…")}</p> : (
        <ul className="st-bundle" aria-label={t("Files in the zip")}>
          {files.map((f) => <li key={f.name}><details><summary><code>{f.name}</code> <span className="note">{bytes(f.bytes)}</span></summary><pre tabIndex={0} aria-label={f.name}>{f.text}</pre></details></li>)}
        </ul>
      )}
    </Dialog>
  );
}
