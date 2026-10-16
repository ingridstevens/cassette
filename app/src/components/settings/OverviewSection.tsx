import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { modelName } from "../modelInfo";
import { setLlm, useLlm } from "../llmChoice";
import { Status } from "./ModelList";
import { SectionProps } from "./shared";

type Paths = Awaited<ReturnType<typeof window.api.paths>>;

/** The first page: can I transcribe? One line per job, with its state in words and one button. */
export default function OverviewSection({ opts, status, models, onGoTo }: SectionProps) {
  const t = useT();
  const [sys, setSys] = useState<Paths["system"] | null>(null);
  useEffect(() => { window.api.paths().then((p) => setSys(p.system)); }, []);
  void setLlm;
  const llm = status?.llm, llmUse = useLlm(llm);
  const asr = !!status?.whisper[opts.model];
  const spk = !!status?.diarization;
  const sum = !!llm?.available && !!llm.models?.[llmUse];
  const sumName = llm?.catalog?.find((m) => m.id === llmUse)?.label ?? "";
  const about = !sys ? "" : sys.chip ? t("This computer has {chip} with {cores} cores and {mem} GB of memory.", { chip: sys.chip, cores: sys.cores, mem: sys.memGB }) : t("This computer has a {arch} processor with {cores} cores and {mem} GB of memory.", { arch: sys.arch, cores: sys.cores, mem: sys.memGB });
  const job = (id: string, title: string, what: string, state: React.ReactNode, label: string, page: string, primary = false) => (
    <section className="st-job card" aria-labelledby={id}>
      <div className="grow"><h2 id={id}>{title}</h2><p className="note">{what}</p></div>
      <div className="st-job-s">{state}</div>
      <button type="button" className={"btn" + (primary ? " sun" : "")} aria-describedby={id} onClick={() => onGoTo(page)}>{label}</button>
    </section>
  );
  return (
    <>
      <p className="st-lead-big">{about || t("Detecting this computer…")}</p>
      {job("ov-tr", t("Transcription"), t("Turns speech into text. No account needed."),
        asr ? <Status kind="ok">{t("Ready · {model}", { model: modelName(opts.model) })}</Status> : <Status kind="warn">{t("Not ready · no model downloaded")}</Status>,
        asr ? t("Change") : t("Download a model"), "Transcription", !asr)}
      {job("ov-sp", t("Speakers"), t("Tells voices apart and labels them Speaker 1, Speaker 2. You add names later, in each project. Optional."),
        spk ? <Status kind="ok">{t("Ready")}</Status> : models.tokenSet ? <Status kind="warn">{t("Set up, not finished")}</Status> : <Status kind="off">{t("Not set up")}</Status>,
        spk ? t("Change") : models.tokenSet ? t("Continue") : t("Set up"), "Speakers", !spk && !opts.noDiarize)}
      {job("ov-su", t("Summaries and translation"), t("Writes short summaries and translates text. Optional."),
        sum ? <Status kind="ok">{t("Ready · {model}", { model: sumName })}</Status> : <Status kind="off">{t("Not set up")}</Status>,
        sum ? t("Change") : t("Set up"), "Summaries and translation")}
      <p className="note">{t("Nothing leaves this computer unless you download a model. This comes from reading the app's code, not from an independent audit.")} <button type="button" className="linkish" onClick={() => onGoTo("Privacy")}>{t("See every connection")}</button></p>
      <p className="note">{t("Already have the model files from a colleague?")} <button type="button" className="linkish" onClick={() => void models.importFolder()}>{t("Use a models folder…")}</button> {t("No account needed.")}</p>
    </>
  );
}
