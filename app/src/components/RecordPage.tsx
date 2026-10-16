import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { langName } from "../languages";
import { Options, fmt } from "../types";
import { modelName } from "./modelInfo";
import { Recorded, useRecorder } from "./useRecorder";
import "../styles/record.css";

interface Props {
  opts: Options; blocker: string;
  /** The recording was saved: the app adds it as a project and transcribes it properly (speakers, final words). */
  onSaved(r: Recorded): void;
  onBack(): void;
}

export default function RecordPage({ opts, blocker, onSaved, onBack }: Props) {
  const t = useT();
  const rec = useRecorder();
  const [device, setDevice] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const on = rec.state === "recording" || rec.state === "starting";
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [rec.confirmed, rec.tentative]);

  const begin = () => { void rec.start({ model: opts.model, language: opts.language, whisperEngine: opts.whisperEngine, device: opts.device }, device || undefined); };
  const finish = async () => { const r = await rec.stop(); if (r) onSaved(r); };
  const denied = rec.error === "denied", silent = rec.error === "silent";

  return (
    <div className="rec-page">
      <div className="rec-head">
        <button type="button" className="btn quiet small" onClick={onBack} disabled={on || rec.state === "saving"}>{t("Back to projects")}</button>
        <h1>{t("Record")}</h1>
      </div>
      <div className="card rec-card">
        <p className="rec-lead">{t("Speak and watch the words appear. When you stop, the recording is saved and transcribed again properly, with speakers. Nothing leaves this computer.")}</p>
        <div className="rec-controls">
          {!on && rec.state !== "saving" ? (
            <button type="button" className="btn sun big" disabled={!!blocker} onClick={begin}>{t("Start recording")}</button>
          ) : (
            <button type="button" className="btn big rec-stop" disabled={rec.state !== "recording"} onClick={() => void finish()}>{rec.state === "saving" ? t("Saving…") : t("Stop and save")}</button>
          )}
          <span className="rec-time" role="timer" aria-label={t("Recording time")}>{fmt(rec.seconds)}</span>
          <span className="rec-meter" role="meter" aria-label={t("Microphone level")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rec.level * 100)}><i style={{ width: `${Math.round(Math.min(1, rec.level * 1.6) * 100)}%` }} /></span>
        </div>
        {!on && rec.devices.length > 1 && (
          <label className="field rec-device"><span>{t("Microphone")}</span>
            <select className="input" value={device} onChange={(e) => setDevice(e.target.value)}>
              <option value="">{t("Default microphone")}</option>
              {rec.devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || t("Microphone {n}", { n: i + 1 })}</option>)}
            </select>
          </label>
        )}
        <p className="note rec-using">{t("Using {model}. Language: {language}.", { model: modelName(opts.model), language: opts.language === "auto" ? t("detected automatically") : langName(opts.language) })}{blocker && " " + blocker}</p>
        {denied && <p className="alert warn" role="alert">{t("The microphone is blocked. Allow it for this app in your computer's privacy settings, then try again.")}</p>}
        {silent && <p className="alert warn" role="alert">{t("Nothing was heard, so nothing was saved. Check that the right microphone is chosen and not muted, then try again.")}</p>}
        {rec.error && !denied && !silent && <p className="alert err" role="alert">{rec.error}</p>}
        {on && rec.state === "recording" && rec.seconds >= 6 && !rec.heard && <p className="alert warn" role="status">{t("No sound from the microphone yet. Is it muted, or is another one selected?")}</p>}
        {rec.fit && on && <p className="alert warn" role="status">{t("This sounds like {language}, and {model} is weak at it. After you stop you can switch to a better model before the full transcript is made.", { language: langName(rec.fit.language), model: modelName(rec.fit.model) })}</p>}
        {on && !rec.ready && <p className="note" role="status">{t("Getting the speech model ready. Keep talking, nothing is lost.")}</p>}
      </div>
      {(on || rec.confirmed || rec.tentative) && (
        <section className="card rec-text" aria-label={t("Live transcript")}>
          <h2>{t("Live transcript")}</h2>
          <p className="rec-words" aria-live="off">{rec.confirmed}<span className="rec-tent">{rec.tentative}</span></p>
          <div ref={end} />
          <p className="note">{t("Grey words may still change. This is a draft: the saved recording is transcribed again with speakers.")}</p>
        </section>
      )}
    </div>
  );
}
