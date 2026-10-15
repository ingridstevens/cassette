import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n";
import { Estimate, engineFor, estimate, loadCalib } from "../estimate";
import { ModelStatus, Options, Project, fmt } from "../types";
import TranscribeFields from "./TranscribeFields";
import { Models } from "./useModels";
import "../styles/project.css";

/** The length of the sample run that lets you check the settings before the whole recording. */
export const TRIAL_SECONDS = 180;
/** Recordings predicted to take longer than this get the questions; shorter ones only get the estimate. */
export const ASK_ABOVE_SECONDS = 60;

type TFn = ReturnType<typeof useT>;

/** "about 14 min", "14–41 min", "under a minute", "about 1 h 40 min". */
export function spanText(t: TFn, e: Estimate): string {
  if (e.high < 60) return t("under a minute");
  const m = (s: number) => Math.max(1, Math.round(s / 60));
  const lo = m(e.low), hi = m(e.high);
  const long = (n: number) => (n >= 120 ? t("{h} h {m} min", { h: Math.floor(n / 60), m: n % 60 }) : t("{min} min", { min: n }));
  if (lo === hi) return t("about {time}", { time: long(lo) });
  return hi < 120 ? t("{from}–{to} min", { from: lo, to: hi }) : t("{from} to {to}", { from: long(lo), to: long(hi) });
}

/** Shared by the start sheet and the "first minutes only" banner: what is installed, the battery, and the time this recording will take. */
export function useStartEstimate(eff: Options, duration: number, refreshKey: unknown = null) {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [onBattery, setOnBattery] = useState(false);
  useEffect(() => {
    let alive = true;
    window.api.models("status").then((r) => { if (alive && r) setStatus(r as unknown as ModelStatus); }).catch(() => {});
    window.api.powerState().then((p) => { if (alive) setOnBattery(!!p?.onBattery); }).catch(() => {});
    return () => { alive = false; };
  }, [refreshKey]);
  const gpuSpeakers = eff.device !== "cpu";
  const forModel = (model: string, seconds: number) => estimate({ duration: seconds, model, engine: engineFor(model, eff, status), speakers: !eff.noDiarize, gpuSpeakers, calib: loadCalib() });
  const engine = engineFor(eff.model, eff, status);
  const est = useMemo(() => (duration > 0 ? forModel(eff.model, duration) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration, eff.model, eff.noDiarize, eff.whisperEngine, eff.device, eff.vad, status]);
  return { status, onBattery, engine, est, forModel };
}
export type StartInfo = ReturnType<typeof useStartEstimate>;

interface Props {
  project: Project; duration: number; eff: Options; info: StartInfo; set(p: Partial<Options>): void;
  models: Models; canStart: boolean; blocker: string; othersWaiting: number;
  onStart(): void; onTrial(): void; onApplyToOthers(o: Partial<Options>): void; onRemember(p: Partial<Options>): void; onOpenSettings?(section?: string): void;
}

export default function StartSheet({ project, duration, eff, info, set, models, canStart, blocker, othersWaiting, onStart, onTrial, onApplyToOthers, onRemember, onOpenSettings }: Props) {
  const t = useT();
  const { status, onBattery, engine, est, forModel } = info;
  const [more, setMore] = useState(false);
  const asks = !!est && est.mid > ASK_ABOVE_SECONDS;
  const open = asks || more;
  const choose = (p: Partial<Options>, remember = false) => { set(p); if (remember) onRemember(p); };

  const timeOf = (model: string) => (duration > 0 ? spanText(t, forModel(model, duration)) : "");
  const trialTime = duration > TRIAL_SECONDS * 2 ? spanText(t, forModel(eff.model, TRIAL_SECONDS)) : "";
  const batteryNote = onBattery && !!est && est.mid > 600;
  const share: Partial<Options> = { language: eff.language, multilingual: eff.multilingual, numSpeakers: eff.numSpeakers, minSpeakers: eff.minSpeakers, maxSpeakers: eff.maxSpeakers, noDiarize: eff.noDiarize, model: eff.model, translate: eff.translate, verbatim: eff.verbatim };

  return (
    <section className="pv-start" aria-labelledby="start-title">
      <div>
        <h2 id="start-title" className="pv-big">{t("Ready to transcribe")}</h2>
        <p className="pv-lead">{project.name}{duration > 0 ? ` · ${fmt(duration)}` : ""}. {t("Everything happens on this computer.")}</p>
      </div>

      <div className="pv-estimate" role="status">
        <b>{est ? t("Estimated time: {time}", { time: spanText(t, est) }) : t("Estimated time: working it out…")}</b>
        <span>
          {est ? (est.rough ? t("A rough guess. The app learns how fast this computer is after your first run.") : t("Based on earlier runs on this computer.")) : t("The length of the recording is being read.")}{" "}
          {engine === "mlx" ? t("Words are written on the Apple GPU.") : t("Words are written on the CPU.")} {t("Translation and several languages add time.")}
        </span>
      </div>
      {batteryNote && <div className="alert warn" role="status">{t("You're on battery. A job this long uses a lot of power: consider plugging in first.")}</div>}
      {blocker && <div className="alert warn" role="status">{blocker}</div>}

      {open && <TranscribeFields eff={eff} set={choose} status={status} models={models} timeOf={duration > 0 ? timeOf : undefined} onOpenSettings={onOpenSettings} />}

      <div className="pv-actions">
        <button type="button" className="btn sun big" disabled={!canStart} onClick={onStart}>{est ? t("Start ({time})", { time: spanText(t, est) }) : t("Start")}</button>
        {trialTime && <button type="button" className="btn big" disabled={!canStart} onClick={onTrial}>{t("Try the first 3 minutes ({time})", { time: trialTime })}</button>}
        {!open && <button type="button" className="btn quiet" onClick={() => setMore(true)}>{t("Change settings")}</button>}
      </div>
      {trialTime && <p className="note">{t("A short sample shows whether the speakers and languages look right before you spend the whole time.")}</p>}
      {othersWaiting > 0 && (
        <p className="note"><button type="button" className="linkish" onClick={() => onApplyToOthers(share)}>
          {othersWaiting === 1 ? t("Use these settings for the other waiting recording") : t("Use these settings for the other {count} waiting recordings", { count: othersWaiting })}</button></p>
      )}
    </section>
  );
}
