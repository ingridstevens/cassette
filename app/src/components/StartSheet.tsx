import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { Estimate, engineFor, estimate, loadCalib, saferModel, tooBigForMemory } from "../estimate";
import { ModelStatus, Options, Project, fmt } from "../types";
import TranscribeFields from "./TranscribeFields";
import { modelName } from "./modelInfo";
import { Models } from "./useModels";
import { loadDismissed, saveDismissed, suggest } from "../recommend";
import { loadStartOpen, saveStartOpen, summaryLine } from "../startSummary";
import "../styles/project.css";

/** The length of the sample run that lets you check the settings before the whole recording. */
export const TRIAL_SECONDS = 180;

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
  const [memGB, setMemGB] = useState<number | undefined>(undefined);
  const [sys, setSys] = useState<{ platform: string; arch: string } | null>(null);
  useEffect(() => {
    let alive = true;
    window.api.models("status").then((r) => { if (alive && r) setStatus(r as unknown as ModelStatus); }).catch(() => {});
    window.api.powerState().then((p) => { if (alive) setOnBattery(!!p?.onBattery); }).catch(() => {});
    window.api.paths().then((p) => { if (alive) { setMemGB(p?.system?.memGB); if (p?.system) setSys({ platform: p.system.platform, arch: p.system.arch }); } }).catch(() => {});
    return () => { alive = false; };
  }, [refreshKey]);
  const gpuSpeakers = eff.device !== "cpu";
  const forModel = (model: string, seconds: number) => estimate({ duration: seconds, model, engine: engineFor(model, eff, status), speakers: !eff.noDiarize, gpuSpeakers, calib: loadCalib() });
  const engine = engineFor(eff.model, eff, status);
  const est = useMemo(() => (duration > 0 ? forModel(eff.model, duration) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration, eff.model, eff.noDiarize, eff.whisperEngine, eff.device, eff.vad, status]);
  return { status, onBattery, memGB, sys, engine, est, forModel };
}
export type StartInfo = ReturnType<typeof useStartEstimate>;

interface Props {
  project: Project; duration: number; eff: Options; info: StartInfo; set(p: Partial<Options>): void;
  models: Models; canStart: boolean; blocker: string; othersWaiting: number;
  onStart(): void; onTrial(): void; onApplyToOthers(o: Partial<Options>): void; onRemember(p: Partial<Options>): void; onOpenSettings?(section?: string): void;
}

export default function StartSheet({ project, duration, eff, info, set, models, canStart, blocker, othersWaiting, onStart, onTrial, onApplyToOthers, onRemember, onOpenSettings }: Props) {
  const t = useT();
  const { status, onBattery, memGB, sys, engine, est, forModel } = info;
  // #187: a suggestion inside this sheet (never a second first-run card). One click accepts it; "No thanks" is remembered.
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [accepted, setAccepted] = useState("");
  const startBtn = useRef<HTMLButtonElement>(null);
  const sug = sys ? suggest(eff.model, { ...sys, memGB }, !eff.noDiarize, status) : null;
  const showSug = !!sug && dismissed !== sug.model;
  // The questions are folded behind "Change settings" and the choice is remembered, so Start stays in view.
  const [open, setOpen] = useState(loadStartOpen);
  const fields = useRef<HTMLDivElement>(null);
  const toggle = () => { const next = !open; setOpen(next); saveStartOpen(next); if (next) setTimeout(() => fields.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 0); };
  const choose = (p: Partial<Options>, remember = false) => { set(p); if (remember) onRemember(p); };

  const trialTime = duration > TRIAL_SECONDS * 2 ? spanText(t, forModel(eff.model, TRIAL_SECONDS)) : "";
  const batteryNote = onBattery && !!est && est.mid > 600;
  const share: Partial<Options> = { language: eff.language, multilingual: eff.multilingual, numSpeakers: eff.numSpeakers, minSpeakers: eff.minSpeakers, maxSpeakers: eff.maxSpeakers, noDiarize: eff.noDiarize, model: eff.model, translate: eff.translate, verbatim: eff.verbatim };

  return (
    <section className="pv-start" aria-labelledby="start-title">
      <div>
        <h2 id="start-title" className="pv-big">{t("Ready to transcribe")}</h2>
        <p className="pv-lead">{project.name}{duration > 0 ? ` · ${fmt(duration)}` : ""}. {t("Everything happens on this computer.")}</p>
      </div>

      <p className="pv-summary">{summaryLine(t, eff)}</p>

      <div role="status" aria-live="polite">
        {accepted && !showSug && <p className="note">{t("Now using the {model} size.", { model: modelName(accepted) })}</p>}
        {showSug && sug && (
          <div className="pv-suggest">
            <p><b>{t("Suggested for this computer: the {model} size.", { model: modelName(sug.model) })}</b>{" "}
              {sug.reason === "memory" ? t("{model} may not fit in this computer's memory, and this size does.", { model: modelName(eff.model) }) : t("It is the usual balance for most interviews and meetings; {model} makes more mistakes.", { model: modelName(eff.model) })}
              {" "}{sug.tested ? "" : t("Cassette has not been tested on this kind of computer, so this is a cautious guess from its memory alone.")}
              {sug.appleGpuMissing ? " " + t("An Apple GPU version of this size can be downloaded under Settings, Advanced.") : ""}</p>
            <div className="pv-suggest-actions">
              <button type="button" className="btn" onClick={() => { choose({ model: sug.model }, true); setAccepted(sug.model); startBtn.current?.focus(); }}>{t("Use {model}", { model: modelName(sug.model) })}</button>
              <button type="button" className="btn quiet" onClick={() => { saveDismissed(sug.model); setDismissed(sug.model); }}>{t("No thanks")}</button>
            </div>
          </div>
        )}
      </div>

      {batteryNote && <div className="alert warn" role="status">{t("You're on battery. A job this long uses a lot of power: consider plugging in first.")}</div>}
      {tooBigForMemory(eff.model, !eff.noDiarize, memGB) && <div className="alert warn" role="status">{t("{model} may not fit in this computer's {mem} GB of memory and could stop partway. The {safer} size is safer.", { model: modelName(eff.model), mem: memGB ?? 0, safer: modelName(saferModel(!eff.noDiarize, memGB)) })}</div>}
      {blocker && <div className="alert warn" role="status">{blocker}</div>}

      <div className="pv-actions">
        <button type="button" ref={startBtn} className="btn sun big" disabled={!canStart} onClick={onStart}>{est ? t("Start ({time})", { time: spanText(t, est) }) : t("Start")}</button>
        {trialTime && <button type="button" className="btn big" disabled={!canStart} onClick={onTrial}>{t("Try the first 3 minutes ({time})", { time: trialTime })}</button>}
      </div>
      <p className="note">
        {est ? (est.rough ? t("A rough guess. The app learns how fast this computer is after your first run.") : t("Based on earlier runs on this computer.")) : t("The length of the recording is being read.")}{" "}
        {engine === "mlx" ? t("Words are written on the Apple GPU.") : t("Words are written on the CPU.")} {t("Translation and several languages add time.")}
      </p>

      <div>
        <button type="button" className="btn quiet pv-fold" aria-expanded={open} aria-controls="start-settings" onClick={toggle}>{t("Change settings")}</button>
        {open && <div id="start-settings" ref={fields} className="pv-start-fields-anchor"><TranscribeFields hasResult={!!project.result} eff={eff} set={choose} status={status} models={models} onOpenSettings={onOpenSettings} /></div>}
      </div>

      {trialTime && <p className="note">{t("A short sample shows whether the speakers and languages look right before you spend the whole time.")}</p>}
      {othersWaiting > 0 && (
        <p className="note"><button type="button" className="linkish" onClick={() => onApplyToOthers(share)}>
          {othersWaiting === 1 ? t("Use these settings for the other waiting recording") : t("Use these settings for the other {count} waiting recordings", { count: othersWaiting })}</button></p>
      )}
    </section>
  );
}
