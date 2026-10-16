import { useEffect, useRef, useState } from "react";
import { FILE_MANAGER, ModelStatus, Options, bytes } from "../../types";
import { HF_TOKEN_PAGE, MODEL_BYTES, Models } from "../useModels";
import { useT } from "../../i18n";
import { ENGINE_MODELS, WHISPER_MODELS, isEngineModel, moonshineName } from "../modelInfo";
import { langName } from "../../languages";
import { setLlm, useLlm } from "../llmChoice";
import Dialog, { useReturnFocus } from "./Dialog";

/** Model ids with their display texts (English, translated when shown). */
const sizeInfo = (t: ReturnType<typeof useT>): [string, string, string, string][] => [...WHISPER_MODELS, ...ENGINE_MODELS].map((m) => [m.id, m.id === "large-v3-turbo" || m.id === "large-v3" || isEngineModel(m.id) ? m.name : t(m.name), t(m.like), "tag" in m && m.tag ? t(m.tag) : ""]);
/** Language names for the model table; the keys are the codes the engine sends. */
const LANGUAGE_NAMES: Record<string, string> = { en: "English", de: "German", fr: "French", es: "Spanish" };
const gb = (n: number) => bytes(n).replace(".0 GB", " GB");
/** Same rule as useModels: the download plus room to unpack it. */
const needed = (name: string, size?: number) => (size || MODEL_BYTES[name] || 5e8) * 1.5 + 5e8;

interface Props { opts: Options; status: ModelStatus | null; models: Models; onGoTo?(section: string): void }
type Ask = { name: string; label: string; size: number; inUse: boolean };

export default function StorageSection({ opts, status, models, onGoTo }: Props) {
  const t = useT();
  const SIZES = sizeInfo(t).filter(([n]) => !isEngineModel(n) || (!!status && n in status.whisper)); // an engine that cannot run here is not listed
  const [dir, setDir] = useState("");
  const [free, setFree] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const timer = useRef<number>(0);
  const back = useReturnFocus();
  useEffect(() => { window.api.paths().then((p) => setDir(p.models)); }, []);
  useEffect(() => { window.api.diskFree().then(setFree); }, [status]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const llm = status?.llm;
  const llmInUse = useLlm(llm);
  const sizes = status?.sizes;
  const busy = !!models.busy;
  const copy = async () => {
    try { await navigator.clipboard.writeText(dir); } catch { return; }
    setCopied(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  const close = () => { setAsk(null); back.restore(); };
  const confirm = () => { if (ask) models.run("delete", ask.name); close(); };

  const apple = !!status?.mlxAvailable;
  const floor = status?.fit;
  /** "Reliable in 52 of 99 languages": how many languages this size is expected to handle well (our estimate, see engine/fit.py). */
  const reliable = (n: string) => {
    if (!floor) return "";
    const own = floor.engines?.[n];
    if (own) return t("Reliable in {count} of {total} languages", { count: own.length, total: Object.keys(floor.floor).length });
    const at = floor.order.indexOf(n), all = Object.values(floor.floor);
    return t("Reliable in {count} of {total} languages", { count: all.filter((f) => floor.order.indexOf(f) <= at).length, total: all.length });
  };
  /** The Apple GPU copy of a size is a detail of that size's row, not a separate list. */
  const AppleGpu = ({ n, label }: { n: string; label: string }) => {
    if (isEngineModel(n)) return <span className="note">{t("Always on the Apple GPU")}</span>;
    const id = `mlx-${n}`, got = !!status?.mlx?.[n], size = status?.mlxSizes?.[n] || MODEL_BYTES[n], going = models.busy === `download ${id}`;
    return got ? (
      <span className="st-gpu"><span className="st-state ok">{t("Ready")}</span>
        <button type="button" className="btn quiet small danger" disabled={busy} aria-label={t("Delete the Apple GPU version of {label}", { label })} onClick={() => void models.run("delete", id)}>{t("Delete")}</button></span>
    ) : going ? (
      <span className="st-gpu"><span className="note">{dlPct != null ? `${dlPct}%` : t("Starting…")}</span><button type="button" className="btn quiet small" onClick={models.cancel}>{t("Cancel")}</button></span>
    ) : (
      <button type="button" className="btn small" disabled={busy} aria-label={t("Download the Apple GPU version of {label}", { label })} onClick={() => void models.run("download", id)}>{t("Download")} · {gb(size)}</button>
    );
  };

  const have = SIZES.filter(([n]) => status?.whisper[n]).map(([n]) => sizes?.whisper[n] ?? 0);
  const spk = status?.diarization ? sizes?.diarization ?? 0 : 0;
  const total = have.reduce((a, b) => a + b, 0) + spk;
  const parts = [...have.map(bytes), ...(status?.diarization ? [bytes(spk)] : [])];
  const diarDone = !!status?.diarization;
  const diarGoing = models.busy === "download diarization";
  const dlPct = models.dl?.fraction != null ? Math.round(models.dl.fraction * 100) : null;
  const lowDiar = free != null && free < needed("diarization");
  const dlProgress = models.dl ? (models.dl.fraction != null ? ` ${Math.round(models.dl.fraction * 100)}%` : "") : "";

  return (
    <>
      <div className="card st-card">
        <h2>{t("Transcription models")}</h2>
        <p className="st-lead">{t("Bigger models are more accurate and slower. “Small” is a good balance for most recordings.")}{apple && " " + t("On a Mac with an Apple chip each size can also run on the graphics chip, which is several times faster. That is a separate download.")}</p>
        <table className="st-table">
          <thead><tr><th scope="col">{t("Size")}</th><th scope="col">{t("What it's like")}</th><th scope="col">{t("On disk")}</th>{apple && <th scope="col">{t("Apple GPU version")}</th>}<th scope="col" className="act"><span className="st-sr">{t("Action")}</span></th></tr></thead>
          <tbody>
            {SIZES.map(([n, label, like, tag]) => {
              const has = !!status?.whisper[n];
              const size = has ? sizes?.whisper[n] ?? MODEL_BYTES[n] : MODEL_BYTES[n];
              const sz = gb(size);
              const lowDisk = free != null && free < needed(n);
              const inUse = has && opts.model === n; // the chosen size only counts as "in use" once it is downloaded
              const running = models.busy === `download ${n}`, deleting = models.busy === `delete ${n}`;
              return (
                <tr key={n}>
                  <td><b>{label}</b>{tag && <span className="badge">{tag}</span>}{inUse && <span className="badge">{t("In use")}</span>}</td>
                  <td>{like}{reliable(n) && <small>{reliable(n)}</small>}</td>
                  <td>{has ? sz : t("≈ {size}", { size: sz })}</td>
                  {apple && <td><AppleGpu n={n} label={label} /></td>}
                  <td className="act">
                    {has ? (
                      <button type="button" className="btn small danger" disabled={busy} aria-label={t("Delete the {label} model, {size}", { label, size: sz })}
                        onClick={() => { back.remember(); setAsk({ name: n, label, size, inUse }); }}>{deleting ? t("Deleting…") : t("Delete")}</button>
                    ) : (
                      <>
                        {lowDisk && <span className="note">{t("Needs {size} free", { size: gb(needed(n)) })}</span>}
                        <button type="button" className="btn small" disabled={busy || lowDisk}
                          aria-label={lowDisk ? t("Download the {label} model. Not enough free space.", { label }) : t("Download the {label} model, {size}", { label, size: sz })}
                          onClick={() => models.run("download", n)}>{running ? t("Downloading…") + dlProgress : t("Download")}</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <section className="st-item" aria-labelledby="spk-title">
          <div className="st-item-main">
            <div className="st-item-head">
              <h3 id="spk-title">{t("Speaker detection")}</h3>
              <span className={"st-state " + (diarDone ? "ok" : "todo")}>
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true">{diarDone ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <circle cx="12" cy="12" r="7" />}</svg>
                {diarDone ? t("Set up") : t("Not set up")}
              </span>
            </div>
            <p className="st-item-desc">{t("Works out who is speaking, so every line can have a name.")}</p>
            <dl className="st-meta">
              <div><dt>{t("Model")}</dt><dd>pyannote 3.1</dd></div>
              <div><dt>{t("On disk")}</dt><dd>{diarDone ? bytes(spk) : t("≈ {size}", { size: bytes(MODEL_BYTES.diarization) })}</dd></div>
              {!diarDone && (
                <div><dt>{t("Hugging Face token")}</dt><dd>{models.tokenSet ? t("Saved") : (
                  <>{t("No token saved.")} <button type="button" className="btn quiet small" onClick={() => window.api.openExternal(HF_TOKEN_PAGE)}>{t("Open token page")}</button></>
                )}</dd></div>
              )}
            </dl>
            {!diarDone && !models.tokenSet && (
              <p className="st-hint" id="spk-hint">{t("Speaker detection needs your Hugging Face token first. Add it in Privacy; it's a one-time step.")}</p>
            )}
            {!diarDone && lowDiar && <p className="st-hint" id="spk-space">{t("Needs {size} free", { size: gb(needed("diarization")) })}</p>}
            {diarGoing && (
              <>
                <div className="prog st-prog" role="progressbar" aria-label={t("Speaker detection download progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dlPct ?? undefined}>
                  <i className={dlPct == null ? "indet" : ""} style={dlPct == null ? undefined : { width: `${dlPct}%` }} />
                </div>
                <span className="st-sr" role="status" aria-live="polite">{dlPct == null ? t("Downloading speaker detection") : t("Downloading speaker detection, {percent}%", { percent: Math.floor(dlPct / 25) * 25 })}</span>
              </>
            )}
          </div>
          <div className="st-item-act">
            {diarDone ? (
              <button type="button" className="btn small danger" disabled={busy} aria-label={t("Delete speaker detection, {size}", { size: bytes(spk) })}
                onClick={() => { back.remember(); setAsk({ name: "diarization", label: "", size: spk, inUse: false }); }}>{models.busy === "delete diarization" ? t("Deleting…") : t("Delete")}</button>
            ) : diarGoing ? (
              <>
                <button type="button" className="btn small" disabled>{t("Downloading…") + dlProgress}</button>
                <button type="button" className="btn quiet small" onClick={models.cancel}>{t("Cancel")}</button>
              </>
            ) : !models.tokenSet ? (
              <button type="button" className="btn sun small" aria-describedby="spk-hint" onClick={() => onGoTo?.("Privacy")}>{t("Add token in Privacy")}</button>
            ) : (
              <button type="button" className="btn sun small" disabled={busy || lowDiar} aria-describedby={lowDiar ? "spk-space" : undefined}
                onClick={() => models.run("download", "diarization")}>{t("Download")}</button>
            )}
          </div>
        </section>
        {total > 0 && <p className="st-total">{spk > 0 && have.length > 0 ? t("Downloaded in total: {total}. Transcription {whisper}, speaker detection {speakers}.", { total: bytes(total), whisper: bytes(total - spk), speakers: bytes(spk) }) : t("Downloaded in total: {total}.", { total: bytes(total) })}</p>}
      </div>

      {!!status?.moonshine?.available && (
        <div className="card st-card">
          <h2>{t("Moonshine models")}</h2>
          <p className="st-lead">{t("Small, very fast speech models, one per language. They are downloaded from Moonshine's own server ({host}), not from Hugging Face, and they are free to use (MIT license). They give a time for each sentence, so word times are estimates.", { host: status.moonshine.source })}</p>
          <table className="st-table">
            <thead><tr><th scope="col">{t("Language")}</th><th scope="col">{t("On disk")}</th><th scope="col" className="act"><span className="st-sr">{t("Action")}</span></th></tr></thead>
            <tbody>
              {status.moonshine.catalog.map(({ id: n, name, language, bytes: size }) => {
                const has = !!status.whisper[n], sz = gb(size), label = moonshineName(n);
                const lowDisk = free != null && free < needed(n, size), running = models.busy === `download ${n}`, deleting = models.busy === `delete ${n}`;
                return (
                  <tr key={n}>
                    <td><b>{langName(language) || name}</b>{has && opts.model === n && <span className="badge">{t("In use")}</span>}</td>
                    <td>{has ? gb(sizes?.whisper[n] ?? size) : t("≈ {size}", { size: sz })}</td>
                    <td className="act">
                      {has ? (
                        <button type="button" className="btn small danger" disabled={busy} aria-label={t("Delete the {label} model, {size}", { label, size: sz })}
                          onClick={() => { back.remember(); setAsk({ name: n, label, size, inUse: opts.model === n }); }}>{deleting ? t("Deleting…") : t("Delete")}</button>
                      ) : (
                        <>
                          {lowDisk && <span className="note">{t("Needs {size} free", { size: gb(needed(n, size)) })}</span>}
                          <button type="button" className="btn small" disabled={busy || lowDisk} aria-label={t("Download the {label} model, {size}", { label, size: sz })}
                            onClick={() => void models.run("download", n, size)}>{running ? t("Downloading…") + dlProgress : t("Download")}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {llm?.available && (
        <div className="card st-card">
          <h2>{t("Language model")}</h2>
          <p className="st-lead">{t("Suggests highlights and writes summaries. It runs on this computer and sends nothing anywhere. Bigger models choose better and take longer. The one marked “In use” is used in every project.")}</p>
          <table className="st-table">
            <thead><tr><th scope="col">{t("Model")}</th><th scope="col">{t("What it's like")}</th><th scope="col">{t("On disk")}</th><th scope="col" className="act"><span className="st-sr">{t("Action")}</span></th></tr></thead>
            <tbody>
              {(llm.catalog ?? []).map(({ id: n, label, like, languages, license }) => {
                const has = !!llm.models?.[n], size = llm.bytes?.[n] ?? 0, sz = gb(size), id = `llm-${n}`;
                const lowDisk = free != null && free < needed(id, size), running = models.busy === `download ${id}`, deleting = models.busy === `delete ${id}`;
                const inUse = n === llmInUse;
                return (
                  <tr key={n}>
                    <td><b>{label}</b>{n === llm.default && <span className="badge">{t("Recommended")}</span>}{inUse && has && <span className="badge">{t("In use")}</span>}</td>
                    <td>{t(like)}<small>{languages.map((l) => t(LANGUAGE_NAMES[l] ?? l)).join(", ")} · {t("License: {name}", { name: license })}</small></td>
                    <td>{has ? sz : t("≈ {size}", { size: sz })}</td>
                    <td className="act">
                      {has ? (
                        <>
                          {!inUse && <button type="button" className="btn small" disabled={busy} aria-label={t("Use the {label} model", { label })} onClick={() => setLlm(n)}>{t("Use")}</button>}
                          <button type="button" className="btn small danger" disabled={busy} aria-label={t("Delete the {label} model, {size}", { label, size: sz })}
                            onClick={() => { back.remember(); setAsk({ name: id, label, size, inUse: false }); }}>{deleting ? t("Deleting…") : t("Delete")}</button>
                        </>
                      ) : (
                        <>
                          {lowDisk && <span className="note">{t("Needs {size} free", { size: gb(needed(id, size)) })}</span>}
                          <button type="button" className="btn small" disabled={busy || lowDisk} aria-label={t("Download the {label} model, {size}", { label, size: sz })}
                            onClick={async () => { if (await models.run("download", id, size)) setLlm(n); }}>{running ? t("Downloading…") + dlProgress : t("Download")}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!!llm?.available && !!llm.translation?.length && (
        <div className="card st-card">
          <h2>{t("Translation model")}</h2>
          <p className="st-lead">{t("Translates lines into another language, such as German or Arabic. Without it the app can only translate into English. It runs on this computer.")}</p>
          <table className="st-table">
            <thead><tr><th scope="col">{t("Model")}</th><th scope="col">{t("What it's like")}</th><th scope="col">{t("On disk")}</th><th scope="col" className="act"><span className="st-sr">{t("Action")}</span></th></tr></thead>
            <tbody>
              {llm.translation.map(({ id: n, label, like, license }) => {
                const has = !!llm.models?.[n], size = llm.bytes?.[n] ?? 0, sz = gb(size), id = `llm-${n}`;
                const lowDisk = free != null && free < needed(id, size), running = models.busy === `download ${id}`, deleting = models.busy === `delete ${id}`;
                return (
                  <tr key={n}>
                    <td><b>{label}</b><span className="badge">{t("Recommended")}</span></td>
                    <td>{t(like)}<small>{t("License: {name}", { name: license })}</small></td>
                    <td>{has ? sz : t("≈ {size}", { size: sz })}</td>
                    <td className="act">
                      {has ? (
                        <button type="button" className="btn small danger" disabled={busy} aria-label={t("Delete the {label} model, {size}", { label, size: sz })}
                          onClick={() => { back.remember(); setAsk({ name: id, label, size, inUse: false }); }}>{deleting ? t("Deleting…") : t("Delete")}</button>
                      ) : (
                        <>
                          {lowDisk && <span className="note">{t("Needs {size} free", { size: gb(needed(id, size)) })}</span>}
                          <button type="button" className="btn small" disabled={busy || lowDisk} aria-label={t("Download the {label} model, {size}", { label, size: sz })}
                            onClick={() => void models.run("download", id, size)}>{running ? t("Downloading…") + dlProgress : t("Download")}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card st-card">
        <h2>{t("Where the models are stored")}</h2>
        <p className="st-lead">{t("Models live only on this computer and are downloaded once. You choose which size to use under Options in a project. Deleting a model is safe: the app asks to download it again when it's needed.")}</p>
        <div className="st-path">
          <code title={dir}>{dir || "…"}</code>
          <button type="button" className="btn" onClick={() => window.api.reveal("models")}>{t("Show in {app}", { app: FILE_MANAGER })}</button>
          <button type="button" className="btn st-copy" onClick={copy} disabled={!dir}>{copied ? t("Copied ✓") : t("Copy path")}</button>
        </div>
        <details className="st-help">
          <summary>{t("Why are there several folders in there?")}</summary>
          <p>{t("This is the standard layout that Hugging Face (where the models come from) uses on disk. It is normal, and nothing is duplicated:")}</p>
          <ul>
            <li><b>{t("A folder for each model.")}</b> {t("Each transcription model you download gets its own folder, named like this:")} <code>models--Systran--faster-whisper-small</code>. {t("Speaker detection is made of three small models (pyannote speaker-diarization, segmentation and wespeaker), so it appears as three folders but as one row in the table below.")}</li>
            <li><b><code>blobs</code></b> {t("holds the actual data, stored once. The model folders mostly contain shortcuts to it, which is why they look tiny in {app}.", { app: FILE_MANAGER })}</li>
            <li><b><code>CACHEDIR.TAG</code></b> {t("is a small marker that tells backup programs this folder can be skipped.")}</li>
          </ul>
          <p>{t("Please don't edit these by hand. To free space, use the Delete button in the table below; the app removes the right folders and files together.")}</p>
        </details>
        {free != null && (free < 5e9
          ? <div className="alert warn" style={{ marginTop: 12 }} role="alert"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg><span><b>{t("Low disk space: {size} free.", { size: bytes(free) })}</b> {t("Medium and larger models need more room than that, including space to unpack them. Empty the Trash or remove files you no longer need, then come back.")}</span></div>
          : <p className="note" style={{ marginTop: 12 }}>{t("{size} free on this disk.", { size: bytes(free) })}</p>)}
        {models.err && <div className="alert err" style={{ marginTop: 12 }} role="alert"><span>{models.err}</span></div>}
      </div>

      {ask && (ask.name === "diarization" ? (
        <Dialog title={t("Delete speaker detection?")} keepLabel={t("Keep it")} okLabel={t("Delete speaker detection")} onKeep={close} onOk={confirm}>
          <p>{t("New transcripts will have no speaker names until you set it up again. Existing transcripts keep their names. Your saved Hugging Face token stays, so setting it up again is quick.")}</p>
        </Dialog>
      ) : (
        <Dialog title={t("Delete the {label} model?", { label: ask.label })} keepLabel={t("Keep it")} okLabel={t("Delete {label} model", { label: ask.label })} onKeep={close} onOk={confirm}>
          <p>{ask.inUse ? t("It is the model in use. After deleting it you cannot transcribe until you download a model again ({size}).", { size: gb(ask.size) }) : t("You can download it again later ({size}).", { size: gb(ask.size) })} {t("Your projects and transcripts are not touched.")}</p>
        </Dialog>
      ))}
    </>
  );
}
