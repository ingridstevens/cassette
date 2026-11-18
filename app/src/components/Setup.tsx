import { useEffect, useRef, useState } from "react";
import "../styles/shell.css";
import { useT } from "../i18n";
import { ModelStatus, Options } from "../types";
import { ModelErrorCard } from "./ErrorCard";
import { modelName } from "./modelInfo";
import SpeakerSteps, { Progress } from "./SpeakerSteps";
import { Models, modelSize } from "./useModels";




interface Props {
  opts: Options; set(o: Options): void; status: ModelStatus | null; models: Models;
  /** True when a project exists (or the user moved on): show only a slim banner. */
  compact?: boolean; onContinue?(): void; onOpenSettings?(): void;
}

export default function Setup({ opts, set, status, models, compact = false, onContinue, onOpenSettings }: Props) {
  const t = useT();
  const { busy, errInfo, dl, importFolder, run, cancel } = models;
  // Someone with a saved token is part-way through: open the steps straight away.
  const [open, setOpen] = useState(models.tokenSet);
  const [expanded, setExpanded] = useState(false);
  const [info, setInfo] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const asDialog = compact && expanded;
  useEffect(() => {
    if (!asDialog) return;
    dialog.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [asDialog]);
  if (!status) return null;

  const modelDone = !!status.whisper[opts.model];
  const diarDone = status.diarization;
  const allDone = modelDone && (diarDone || opts.noDiarize);
  if (allDone) return null;

  const dlModel = busy === `download ${opts.model}`;
  const size = modelSize(opts.model);
  const pct = dl?.fraction != null ? Math.round(dl.fraction * 100) : null;

  if (compact && !expanded) {
    return (
      <div className={"setup-slim" + (modelDone ? " info" : "")} role="status">
        <span className="mark" aria-hidden>{modelDone ? "i" : "!"}</span>
        <span><b>{t("Finish setup to transcribe.")}</b> {!modelDone ? t("The transcription model isn't downloaded yet.") : t("Speaker detection isn't set up yet (optional).")}</span>
        <span className="grow" />
        {modelDone && <button type="button" className="btn small quiet" onClick={() => set({ ...opts, noDiarize: true })}>{t("Transcribe without speakers")}</button>}
        <button type="button" ref={reopen} className="btn small" onClick={() => setExpanded(true)}>{t("Continue setup")}</button>
      </div>
    );
  }

  const infoPanel = (
    <div className="info-panel" id="spk-info">
      <b>{t("What is speaker detection?")}</b>
      <p>{t("It is also called diarization. The app listens for changes in voice and splits the transcript into turns, one per speaker. It doesn't know who anyone is: speakers are numbered, and you can rename them afterwards, for example to “Anna”.")}</p>
      <p>{t("It works best with clear voices and can struggle when people talk over each other. For a single voice, like a voice memo or a lecture, you don't need it.")}</p>
    </div>
  );
  const cont = () => { set({ ...opts, noDiarize: true }); onContinue?.(); };

  const steps = (
    <>
      {errInfo && busy === "" && <ModelErrorCard models={models} onOpenSettings={onOpenSettings} />}

      <div className="card setup-card">
        <div className="step">
          <div className={"num" + (modelDone ? " ok" : " on")} aria-hidden="true">{modelDone ? "✓" : "1"}</div>
          <div className="grow">
            <h3>{modelDone ? t("Transcription model downloaded") : t("Download the transcription model")}</h3>
            <p className="sub">{t("The part that listens and writes the words down: “{model}”, about {size}. You can pick another size in Settings.", { model: modelName(opts.model), size: size.replace(/^≈\s/, "") })}</p>
            {!modelDone && !dlModel && (
              <div className="actions"><button type="button" className="btn sun" disabled={!!busy} onClick={() => run("download", opts.model)}>{t("Download now")}</button></div>
            )}
            {dlModel && (
              <>
                <Progress label={t("Model download progress")} fraction={dl?.fraction ?? null} />
                <p className="sub small-row">
                  <span>{pct != null ? t("{pct}% of about {size}. Keep the app open.", { pct, size: size.replace(/^≈\s/, "") }) : t("Starting… Keep the app open.")}</span>
                  <button type="button" className="btn quiet small" onClick={cancel}>{t("Cancel download")}</button>
                </p>
              </>
            )}
            <details className="detail"><summary>{t("Technical details")}</summary>Whisper “{opts.model}” by OpenAI, run with faster-whisper · MIT licence{status.dir ? <> · {t("saved to")} <code>{status.dir}</code></> : null}</details>
          </div>
        </div>

        <div className="step">
          <div className={"num" + (diarDone ? " ok" : "")} aria-hidden="true">{diarDone ? "✓" : "2"}</div>
          <div className="grow">
            {!open ? (
              <>
                <h3>{t("Tell speakers apart")} <span className="opt">{t("(optional)")}</span>
                  <button type="button" className="info-btn" aria-expanded={info} aria-controls="spk-info" aria-label={t("What is speaker detection?")} onClick={() => setInfo(!info)}>i</button></h3>
                <p className="sub">{t("For interviews, or any recording with more than one voice. Each line then says who is talking: Speaker 1, Speaker 2 and so on.")}</p>
                {info && infoPanel}
                <div className="choices">
                  <button type="button" className="choice-card" aria-expanded={false} onClick={() => setOpen(true)}>
                    <b>{t("Set up speaker detection")}</b>
                    <span>{t("Needs a free Hugging Face account. Only the speaker files are downloaded; your recordings are never sent there.")}</span>
                    <em>{t("About 3 minutes")}</em>
                  </button>
                  <button type="button" className="choice-card" onClick={cont}>
                    <b>{t("Continue without it")}</b>
                    <span>{t("You get one transcript that doesn’t say who is talking. Fine for a single voice. You can add it later under Settings, Speakers.")}</span>
                    <em>{t("Ready now")}</em>
                  </button>
                </div>
                <details className="detail"><summary>{t("Someone else can do this for me")}</summary>
                  <p className="sub">{t("Ask a friend or your IT team to set up speaker detection once on their computer and copy the models folder to you (it is the folder this app shows under Settings, Advanced). Then choose that folder here. Nothing goes online.")}</p>
                  <div className="actions"><button type="button" className="btn" disabled={!!busy} onClick={() => void importFolder()}>{t("Import a models folder…")}</button></div>
                </details>
              </>
            ) : (
              <>
                <h3>{t("Tell speakers apart")} <span className="opt">{t("(optional)")}</span>
                  <button type="button" className="info-btn" aria-expanded={info} aria-controls="spk-info" aria-label={t("What is speaker detection?")} onClick={() => setInfo(!info)}>i</button></h3>
                <p className="sub">{t("For interviews, or any recording with more than one voice. Each line then says who is talking: Speaker 1, Speaker 2 and so on.")}</p>
                {info && infoPanel}
                <SpeakerSteps models={models} diarDone={diarDone} />
                <div className="sp-foot">
                  <button type="button" className="btn quiet" onClick={() => setOpen(false)}>{t("Do this later")}</button>
                  <span>{t("You can finish this any time under Settings, Speakers.")}</span>
                </div>
                <details className="detail"><summary>{t("Technical details")}</summary>pyannote speaker-diarization 3.1 and segmentation 3.0 · MIT licence. {t("The token is kept in your computer’s secure storage and used only for this download.")}</details>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // With a recording open, setup covers the main column as its own page, so the two screens don't stack in one column.
  if (asDialog) {
    return (
      <div className="setup-overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title" tabIndex={-1} ref={dialog}>
        <section className="setup-page">
          <div className="setup-overlay-head">
            <button type="button" className="btn quiet small" onClick={() => setExpanded(false)}>{t("← Back to recording")}</button>
            <h1 id="setup-title">{t("Finish setup")}</h1>
          </div>
          {steps}
        </section>
      </div>
    );
  }

  return (
    <section className="setup-page" aria-labelledby="setup-title">
      <div>
        <h1 id="setup-title">{t("Turn a recording into text")}</h1>
        <p className="lead">{t("First, one quick download (about {size}). After that it works without internet, and your recordings never leave this computer.", { size: size.replace(/^≈\s/, "") })}</p>
      </div>
      {steps}
    </section>
  );
}
