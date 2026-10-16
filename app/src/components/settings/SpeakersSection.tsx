import { useState } from "react";
import { useT } from "../../i18n";
import { bytes } from "../../types";
import { ModelErrorCard } from "../ErrorCard";
import SpeakerSteps from "../SpeakerSteps";
import { MODEL_BYTES } from "../useModels";
import Dialog, { useReturnFocus } from "./Dialog";
import { Status } from "./ModelList";
import { Block, SectionProps, SwitchRow } from "./shared";

export default function SpeakersSection({ opts, set, status, models, say }: SectionProps) {
  const t = useT();
  const done = !!status?.diarization;
  const [ask, setAsk] = useState(false);
  const back = useReturnFocus();
  const close = () => { setAsk(false); back.restore(); };
  const size = bytes(status?.sizes?.diarization || MODEL_BYTES.diarization);
  return (
    <>
      {models.errInfo && !models.busy && <ModelErrorCard models={models} />}
      <Block id="sp-what" title={t("What this does")}>
        <p><b>{t("Optional.")}</b> {t("Transcription works without it. It needs a free Hugging Face account, or a models folder from someone who has already set it up.")}</p>
        <p>{t("Speaker detection (also called diarization) hears when the voice changes and labels each part Speaker 1, Speaker 2. It does not know who people are. You can rename speakers in each project.")}</p>
        <p className="note">{t("Steps 1 to 3 happen on the Hugging Face website. The app only downloads the speaker model. Your audio and text are never sent.")}</p>
        <p className="st-sp-status" role="status">{done ? <Status kind="ok">{t("Ready")}</Status> : <Status kind="off">{t("Not set up")}</Status>}</p>
      </Block>
      {done ? (
        <Block id="sp-on" title={t("Speaker detection")}>
          <SwitchRow id="sp-sw" title={t("Detect speakers in new projects")} help={t("You can switch it off for one project in its Options.")} on={!opts.noDiarize} onChange={(v) => set({ ...opts, noDiarize: !v })} />
          <div className="st-row st-setting"><div className="grow"><b>pyannote 3.1</b><p className="note">{t("Downloaded · {size}", { size })}</p></div>
            <button type="button" className="btn small quiet" disabled={!!models.busy} aria-label={t("Delete speaker detection, {size}", { size })} onClick={() => { back.remember(); setAsk(true); }}>{t("Delete")}</button></div>
        </Block>
      ) : (
        <Block id="sp-set" title={t("Set up speaker detection")}>
          <SpeakerSteps models={models} diarDone={false} />
          <p className="note"><button type="button" className="linkish" onClick={() => { set({ ...opts, noDiarize: true }); say(t("Speaker detection skipped. You can set it up later here.")); }}>{t("Skip this. Transcribe without speakers.")}</button> {t("Transcripts still work.")}</p>
          <div className="st-row st-setting"><div className="grow"><b>{t("No internet, or no account?")}</b><p className="note">{t("Import a models folder instead.")}</p></div>
            <button type="button" className="btn small" disabled={!!models.busy} onClick={() => void models.importFolder()}>{t("Import a models folder…")}</button></div>
        </Block>
      )}
      {ask && (
        <Dialog title={t("Delete speaker detection?")} keepLabel={t("Keep it")} okLabel={t("Delete speaker detection")} onKeep={close} onOk={() => { close(); void models.run("delete", "diarization").then((ok) => ok && say(t("Speaker detection deleted."))); }}>
          <p>{t("New transcripts will have no speaker names until you set it up again. Existing transcripts keep their names. Your saved Hugging Face token stays, so setting it up again is quick.")}</p>
        </Dialog>
      )}
    </>
  );
}
