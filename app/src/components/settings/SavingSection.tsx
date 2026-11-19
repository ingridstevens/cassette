import { Options } from "../../types";
import { useT } from "../../i18n";
import { EXPORT_CHOICES } from "../ExportMenu";
import { GROUPS, isDefaultShown, normaliseShown, toggleShown } from "../../exportFormats";

interface Props { opts: Options; set(o: Options): void }

export default function SavingSection({ opts, set }: Props) {
  const t = useT();
  const on = !!opts.autosave;
  const shown = normaliseShown(opts.exportShown);
  return (
    <>
      <div className="card st-card">
        <div className="st-row">
          <div className="grow"><h2>{t("Save a backup copy next to each recording")}</h2>
            <p className="st-lead">{t("After every transcription, the app writes a small data file into the same folder as the recording. Your audio is never changed or moved. This file is a backup that this app can read again; for a transcript you can open or send, use Export on a project.")} <b>{t("Transcribing the same recording again replaces that file.")}</b></p></div>
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
        <label className="field">{t("First item in the Export menu")}
          <select value={opts.defaultExport ?? ""} onChange={(e) => set({ ...opts, defaultExport: e.target.value || undefined })}>
            <option value="">{t("None (only what each project was last exported as)")}</option>
            {EXPORT_CHOICES.map(([f, label]) => <option key={f} value={f}>{t(label)}</option>)}
          </select>
          <span className="note">{t("Each project remembers how you last exported it and offers that first. For a project you have not exported yet, it offers this format.")}</span>
        </label>
      </div>

      <div className="card st-card">
        <h2 id="st-export-formats">{t("Formats in the Export menu")}</h2>
        <p className="st-lead">{t("Tick the formats you use and the Export menu lists them first. All the others stay one step away under “More formats…”, so nothing is lost. This only changes the menu: the Export shortcut and Export all still work, and a format that is not listed can still be chosen from “More formats…”.")}</p>
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="st-fmt">
            <legend>{t(g.title)}</legend>
            {g.formats.map(([f, label, hint]) => (
              <label key={f} className="pv-check">
                <input type="checkbox" checked={shown.includes(f)} onChange={(e) => set({ ...opts, exportShown: toggleShown(opts.exportShown, f, e.target.checked) })} />
                <span><b>{t(label)}</b><small>{t(hint)}</small></span>
              </label>
            ))}
          </fieldset>
        ))}
        <div className="row-btns">
          <button type="button" className="btn small" disabled={isDefaultShown(opts.exportShown)} onClick={() => set({ ...opts, exportShown: undefined })}>{t("Reset to the default set")}</button>
        </div>
        <p className="note" role="status">{shown.length === 0 ? t("No format is listed up front. Use “More formats…” in the Export menu.") : t("{count} of {total} formats listed up front.", { count: shown.length, total: GROUPS.reduce((n, g) => n + g.formats.length, 0) })}{isDefaultShown(opts.exportShown) ? " " + t("This is the default set.") : ""}</p>
      </div>
    </>
  );
}
