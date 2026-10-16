import { useState } from "react";
import { useT } from "../i18n";
import { langName } from "../languages";
import { FitAsk, bytes } from "../types";
import { modelName } from "./modelInfo";
import { MODEL_BYTES, Models } from "./useModels";
import "../styles/project.css";

interface Props {
  ask: FitAsk; models: Models;
  /** Run again with this model (already downloaded). */
  onUse(model: string): void;
  /** Run again with the model the user picked, and do not ask again. */
  onContinue(): void;
  onDismiss(): void;
}

/** Shown when the first seconds of a recording are in a language the chosen model is weak at. Nothing has been transcribed yet. */
export default function FitCard({ ask, models, onUse, onContinue, onDismiss }: Props) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const language = langName(ask.language), now = modelName(ask.model), better = modelName(ask.suggested);
  const have = !!ask.have[ask.suggested];
  const downloading = models.busy === `download ${ask.suggested}`;
  const size = bytes(MODEL_BYTES[ask.suggested] ?? 5e8);
  const pct = models.dl?.fraction != null ? ` ${Math.round(models.dl.fraction * 100)}%` : "";
  const getBetter = async () => { setFailed(false); if (await models.run("download", ask.suggested)) onUse(ask.suggested); else setFailed(true); };
  return (
    <div className="card pv-fit" role="alert">
      <h2><span className="pv-tag">{t("Language")}</span>{ask.level === "poor" ? t("{model} struggles with {language}", { model: now, language }) : t("{model} is not great at {language}", { model: now, language })}</h2>
      <p>{t("The first seconds sound like {language}. A bigger model makes far fewer mistakes in it. Nothing has been transcribed yet, so no time is lost.", { language })}</p>
      <div className="pv-actions">
        {have
          ? <button type="button" className="btn sun" onClick={() => onUse(ask.suggested)}>{t("Use {model} and continue", { model: better })}</button>
          : <button type="button" className="btn sun" disabled={!!models.busy} onClick={() => void getBetter()}>{downloading ? t("Downloading {model}…", { model: better }) + pct : t("Download {model} ({size}) and continue", { model: better, size })}</button>}
        {downloading && <button type="button" className="btn quiet" onClick={models.cancel}>{t("Cancel")}</button>}
        <button type="button" className="btn" disabled={downloading} onClick={onContinue}>{t("Continue with {model} anyway", { model: now })}</button>
        <button type="button" className="btn quiet" disabled={downloading} onClick={onDismiss}>{t("Not now")}</button>
      </div>
      {(failed || models.err) && <p className="alert warn" role="alert">{models.err || t("The download didn't finish.")}</p>}
    </div>
  );
}
