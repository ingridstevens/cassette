import { ReactNode, useEffect, useState } from "react";
import { FILE_MANAGER, bytes } from "../../types";
import { useT } from "../../i18n";
import { WHISPER_MODELS } from "../modelInfo";
import { MODEL_BYTES } from "../useModels";
import Dialog, { useReturnFocus } from "./Dialog";
import ModelList, { Entry } from "./ModelList";
import { SectionProps } from "./shared";
import { Check, checksText, setupChecks } from "../../setupCheck";
import type { ModelStatus } from "../../types";

type Paths = Awaited<ReturnType<typeof window.api.paths>>;

/** A closed-by-default group, so the page never shows everything at once. */
function Acc({ title, value, children, open }: { title: string; value?: string; children: ReactNode; open?: boolean }) {
  return <details className="st-acc" open={open}><summary><span className="acc-t">{title}</span>{value && <span className="acc-v">{value}</span>}</summary><div className="acc-b">{children}</div></details>;
}
function Radios({ name, legend, value, options, onChange }: { name: string; legend: string; value: string; options: [string, string][]; onChange(v: string): void }) {
  return (
    <fieldset className="choices row st-fieldset"><legend>{legend}</legend>
      {options.map(([v, l]) => <label key={v} className={"choice" + (value === v ? " on" : "")}><input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} /><span><b>{l}</b></span></label>)}
    </fieldset>
  );
}

export default function AdvancedSection({ opts, set, status, models, say, onReset }: SectionProps) {
  const t = useT();
  const [paths, setPaths] = useState<Paths | null>(null);
  const [free, setFree] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [ask, setAsk] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [checking, setChecking] = useState(false);
  const back = useReturnFocus();
  useEffect(() => { window.api.paths().then(setPaths); }, []);
  useEffect(() => { window.api.diskFree().then(setFree); }, [status]);
  const device = opts.device === "cpu" ? "cpu" : "auto";
  const sys = paths?.system, apple = sys?.platform === "darwin" && sys.arch === "arm64";
  const mlx = !!status?.mlxAvailable, engine = opts.whisperEngine === "faster" ? "faster" : "auto";
  const haveMlx = !!status?.mlx?.[opts.model];
  const speakersOn = device === "cpu" || !apple ? "CPU" : "Apple GPU";
  const wordsOn = mlx && engine === "auto" && device !== "cpu" && haveMlx ? "Apple GPU" : "CPU";
  const detect = opts.detectModel ?? "tiny";
  const gpu: Entry[] = mlx ? WHISPER_MODELS.map((m) => {
    const label = m.id.startsWith("large") ? m.name : t(m.name);
    return { id: `mlx-${m.id}`, run: `mlx-${m.id}`, name: `Whisper ${label} (${t("Apple GPU")})`, size: status?.mlxSizes?.[m.id] || MODEL_BYTES[m.id], have: !!status?.mlx?.[m.id], inUse: false };
  }) : [];
  const runCheck = async () => {
    setChecking(true);
    let fresh: ModelStatus | null;
    try { fresh = (await window.api.models("status")) as unknown as ModelStatus; } catch { fresh = null; }
    let mics: number | null;
    try { mics = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput").length; } catch { mics = null; }
    const p = paths ?? await window.api.paths();
    const list = setupChecks({ opts, status: fresh, memGB: p.system.memGB, freeBytes: await window.api.diskFree(), microphones: mics }, t);
    setChecks(list); setChecking(false);
    say(list.some((c) => c.level !== "ok") ? t("Something needs attention.") : t("Everything is ready."));
  };
  const copyDiag = async () => {
    const text = [`Cassette ${__APP_VERSION__}`, sys ? `${sys.platform} ${sys.arch}, ${sys.chip || "?"}, ${sys.cores} cores, ${sys.memGB} GB` : "",
      `Model in use: ${opts.model}`, `Speaker detection: ${status?.diarization ? "ready" : "not set up"}`, `Models: ${Object.entries(status?.whisper ?? {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}`, free != null ? `Free disk: ${bytes(free)}` : "", checks ? "Setup check:\n" + checksText(checks) : ""].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopied(true); say(t("Diagnostics copied. They contain no transcript text and no token.")); window.setTimeout(() => setCopied(false), 2000);
  };
  const close = () => { setAsk(false); back.restore(); };
  return (
    <>
      <p className="st-lead-big">{t("You don't need to change anything here. The defaults work for most people.")}</p>
      <h2 className="grp-h">{t("Speed")}</h2>
      <Acc title={t("Processor")} value={device === "auto" && engine === "auto" ? t("Automatic") : t("Changed")} open>
        <p className="note">{t("Leave both on Automatic unless the app is slow, crashes, or labels speakers oddly. The graphics chip is also called the Apple GPU.")}</p>
        <Radios name="dev" legend={t("Finding speakers")} value={device} onChange={(v) => set({ ...opts, device: v })} options={[["auto", t("Automatic")], ["cpu", t("Processor only")]]} />
        {mlx && <Radios name="eng" legend={t("Writing the words down")} value={engine} onChange={(v) => set({ ...opts, whisperEngine: v === "auto" ? undefined : "faster" })} options={[["auto", t("Automatic")], ["faster", t("Processor only")]]} />}
        <p className="note" role="status"><b>{t("Right now:")}</b> {t("speakers on {a}, words on {b}.", { a: speakersOn === "CPU" ? t("the processor") : t("the Apple GPU"), b: wordsOn === "CPU" ? t("the processor") : t("the Apple GPU") })}</p>
      </Acc>
      {mlx && <Acc title={t("Apple GPU models")} value={t("{n} of {total} downloaded", { n: gpu.filter((g) => g.have).length, total: gpu.length })}>
        <p className="note">{t("Faster versions of Whisper for Apple chips, 4 to 16 times faster than the processor. The app uses them by itself when they are downloaded.")}</p>
        <ModelList entries={gpu} models={models} say={say} label={t("Apple GPU models")} />
      </Acc>}
      <Acc title={t("Language checker")} value={detect === "same" ? t("Same as transcription") : WHISPER_MODELS.find((m) => m.id === detect)?.name ?? detect}>
        <p className="note">{t("The model that finds the language of a file. A small one is fast but can be wrong on short lines.")}</p>
        <div className="f7"><label htmlFor="det-model">{t("Language checker")}</label>
          <select id="det-model" className="input" value={detect} onChange={(e) => set({ ...opts, detectModel: e.target.value === "tiny" ? undefined : e.target.value })}>
            <option value="same">{t("The same as for writing the words down")}</option>
            {WHISPER_MODELS.map((m) => <option key={m.id} value={m.id}>{m.id.startsWith("large") ? m.name : t(m.name)}{m.id === "tiny" ? " · " + t("Recommended") : ""}{status?.whisper[m.id] ? "" : " · " + t("not downloaded")}</option>)}
          </select></div>
      </Acc>
      <h2 className="grp-h">{t("Storage")}</h2>
      <Acc title={t("Models folder")} value={status?.sizes ? bytes(Object.values(status.sizes.whisper).reduce((a, b) => a + b, 0) + (status.diarization ? status.sizes.diarization : 0)) : undefined}>
        <p><code className="pathb">{paths?.models ?? "…"}</code></p>
        <div className="row-btns"><button type="button" className="btn small" onClick={() => window.api.reveal("models")}>{t("Show in {app}", { app: FILE_MANAGER })}</button></div>
        {free != null && <p className="note">{t("{size} free on this disk.", { size: bytes(free) })}</p>}
        <p className="note">{t("Delete models on their own pages, not by hand. Hugging Face keeps a shared folder of data files, so the model folders look small.")}</p>
      </Acc>
      <h2 className="grp-h">{t("Help and reset")}</h2>
      <Acc title={t("Diagnostics and reset")}>
        <div className="st-row st-setting"><div className="grow"><b>{t("Check my setup")}</b><p className="note">{t("Checks that the engine, the model, speaker detection, memory, disk space and microphone are ready, and says what to do if not.")}</p></div>
          <button type="button" className="btn small" disabled={checking} onClick={() => void runCheck()}>{checking ? t("Checking…") : t("Check")}</button></div>
        {checks && (
          <ul className="st-checks" aria-label={t("Check my setup")}>
            {checks.map((c) => <li key={c.id} className={"st-check " + c.level}><b>{c.level === "ok" ? t("Ready") : c.level === "warn" ? t("Warning") : t("Problem")}</b> <span>{c.text}</span></li>)}
          </ul>
        )}
        <div className="st-row st-setting"><div className="grow"><b>{t("Copy diagnostics")}</b><p className="note">{t("Version, system and model list for a bug report. It never contains transcript text or your token.")}</p></div>
          <button type="button" className="btn small" onClick={copyDiag}>{copied ? t("Copied ✓") : t("Copy")}</button></div>
        <div className="st-row st-setting"><div className="grow"><b>{t("Activity log")}</b><p className="note">{t("File names and folders. It never contains transcript text.")}</p></div>
          <button type="button" className="btn small" onClick={() => window.api.reveal("log")}>{t("Show log file")}</button></div>
        <div className="st-row st-setting"><div className="grow"><b>{t("Reset all settings")}</b><p className="note">{t("Models, projects and recordings are not touched.")}</p></div>
          <button type="button" className="btn small" onClick={() => { back.remember(); setAsk(true); }}>{t("Reset…")}</button></div>
      </Acc>
      {ask && <Dialog title={t("Reset all settings?")} keepLabel={t("Keep my settings")} okLabel={t("Reset settings")} onKeep={close} onOk={() => { close(); onReset(); say(t("Settings reset to defaults.")); }}><p>{t("Your choices go back to the standard ones. Models, projects and recordings are not touched.")}</p></Dialog>}
    </>
  );
}
