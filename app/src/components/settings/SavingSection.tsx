import { Options } from "../../types";
import { useT } from "../../i18n";

interface Props { opts: Options; set(o: Options): void }

export default function SavingSection({ opts, set }: Props) {
  const t = useT();
  const on = !!opts.autosave;
  return (
    <>
      <div className="card st-card">
        <div className="st-row">
          <div className="grow"><h2>{t("Save a backup copy next to each recording")}</h2>
            <p className="st-lead">{t("After every transcription, the app writes a small data file into the same folder as the recording. Your audio is never changed or moved. This file is a backup that this app can read again; for a transcript you can open or send, use Export on a project.")}</p></div>
          <button type="button" className="switch" role="switch" aria-checked={on} aria-label={t("Save a backup copy next to each recording")} onClick={() => set({ ...opts, autosave: !on })} />
        </div>
        {on && (
          <div className="st-inset st-file">
            <span className="st-ic" aria-hidden="true"><svg className="i" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5" /></svg></span>
            <span><b>Interview 2026.transcript.json</b><small>{t("Saved next to {file} · includes speaker names and timings", { file: "Interview 2026.m4a" })}</small></span>
          </div>
        )}
        {!on && <p className="note" role="status" style={{ marginTop: 14 }}>{t("Off. Transcripts stay in the app until you export them.")}</p>}
      </div>

      <div className="card st-card">
        <div className="st-row">
          <div className="grow"><h2>{t("Your projects")}</h2>
            <p className="st-lead">{t("Projects, transcripts and speaker names are always kept inside the app, so they're still here after you restart. Removing a project from the list never deletes your recording.")}</p></div>
          <button type="button" className="btn" onClick={() => window.api.reveal("data")}>{t("Show app folder")}</button>
        </div>
      </div>

      <div className="card st-card">
        <h2>{t("Exporting")}</h2>
        <p className="st-lead">{t("Use Export at the top of a project to save a Word document, plain text, spreadsheet, subtitles, Markdown or JSON, wherever you like.")}</p>
      </div>
    </>
  );
}
