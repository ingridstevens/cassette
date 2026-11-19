import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { ModelStatus, bytes } from "../types";
import { llmOptionText, setLlm, useLlm } from "./llmChoice";
import { useModels } from "./useModels";
import type { LlmJob } from "./HighlightsTab";

/** What the Highlights and Summary tabs share: the status of the language model, which one is chosen, and the one-time download. */
export function useLlmSetup(visible: boolean) {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const refresh = useCallback(() => { window.api.models("status").then((r) => { if (alive.current && r) setStatus(r as unknown as ModelStatus); }).catch(() => {}); }, []);
  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);
  const models = useModels(refresh);
  const model = useLlm(status?.llm);
  const llm = status?.llm;
  return { status, models, model, llm, have: !!llm?.models?.[model] };
}
export type LlmSetupState = ReturnType<typeof useLlmSetup>;

/** The language-model menu, and below it the one-time download or a note when this build cannot run one. */
export function LlmSetup({ s, running }: { s: LlmSetupState; running: boolean }) {
  const t = useT();
  const { status, models, model, llm, have } = s;
  const catalog = llm?.catalog ?? [];
  const like = catalog.find((m) => m.id === model)?.like;
  const size = llm?.bytes?.[model];
  const downloading = models.busy === `download llm-${model}`;
  const pct = models.dl?.fraction != null ? Math.round(models.dl.fraction * 100) : null;
  return (
    <>
      {llm?.available && (
        <label className="field">{t("Language model")}
          <select className="input" value={model} onChange={(e) => setLlm(e.target.value)} disabled={running}>
            {catalog.map(({ id, label }) => <option key={id} value={id}>{llmOptionText(t, label, !!llm.models?.[id], llm.bytes?.[id])}</option>)}
          </select>
          {like && <span className="note">{t(like)}</span>}
        </label>
      )}
      {!llm?.available ? (
        status ? <p className="note">{t("The language model is not part of this version of the app, so suggestions and summaries are not available. Highlighting by hand works.")}</p> : null
      ) : !have && (
        <div className="pv-hl-setup">
          <p className="note">{t("Suggestions and summaries are written by a language model that runs on this computer. Nothing is sent anywhere. It needs a one-time download of {size}.", { size: bytes(size ?? 0) })}</p>
          {downloading ? (
            <div className="pv-hl-job" role="status">
              <div className="prog st-prog" role="progressbar" aria-label={t("Language model download progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}><i className={pct == null ? "indet" : ""} style={pct == null ? undefined : { width: `${pct}%` }} /></div>
              <span className="note">{models.dl?.message || t("Downloading…")}</span>
              <button type="button" className="btn quiet small" onClick={models.cancel}>{t("Cancel")}</button>
            </div>
          ) : (
            <button type="button" className="btn small" disabled={!!models.busy} onClick={() => models.run("download", `llm-${model}`, size)}>{t("Download the language model ({size})", { size: bytes(size ?? 0) })}</button>
          )}
          {models.errInfo && <div className="alert err" role="alert"><span><b>{models.errInfo.title}</b> {models.errInfo.body}</span></div>}
        </div>
      )}
    </>
  );
}

/** A running job's progress bar with its Stop button. */
export function JobProgress({ job, label, onStop }: { job: LlmJob | null; label: string; onStop(): void }) {
  const t = useT();
  return (
    <div className="pv-hl-job" role="status">
      <div className="prog st-prog" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job?.fraction != null ? Math.round(job.fraction * 100) : undefined}>
        <i className={job?.fraction == null ? "indet" : ""} style={job?.fraction == null ? undefined : { width: `${Math.round(job.fraction * 100)}%` }} />
      </div>
      <span className="note">{label}</span>
      <button type="button" className="btn quiet small" onClick={onStop}>{t("Stop")}</button>
    </div>
  );
}
