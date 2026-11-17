import { currentLang, useT } from "../i18n";
import { MAIN_LANGS, TRANSLATE_LANGS, WHISPER_LANGS, langName } from "../languages";
import { ModelStatus, Options } from "../types";
import SpeakerCountField from "./SpeakerCountField";
import { ENGINE_MODELS, RECOMMENDED, WHISPER_MODELS, modelName, moonshineName } from "./modelInfo";
import { Models, modelSize } from "./useModels";
import "../styles/project.css";

/** The questions asked before a transcription. The start sheet and the Options tab both render this, so they read and behave the same. */
interface Props {
  eff: Options;
  /** `remember` also makes the choice the default for new recordings. */
  set(p: Partial<Options>, remember?: boolean): void;
  status: ModelStatus | null; models: Models;
  /** The time this recording would take with a model, when it is known. */
  timeOf?(model: string): string;
  /** Languages the app found in the last run, shown next to the automatic choice. */
  found?: string;
  /** Also show "Skip silence" and "Names and special words". */
  advanced?: boolean;
  onOpenSettings?(section?: string): void;
}

export default function TranscribeFields(p: Props) {
  return (
    <div className="pv-fields">
      <LanguageField {...p} />
      <ModelField {...p} />
      <div className="pv-start-col">
        <SpeakerCountField eff={p.eff} set={(x) => p.set(x)} />
        <TranscriptOnlyField {...p} />
        <ExtrasField {...p} />
        {p.advanced && <NamesField {...p} />}
      </div>
    </div>
  );
}

/** The sections below also render on their own in the Options tab's summary rows, where the row names the section, so `bare` hides the section's own title. */
type Section = Props & { bare?: boolean };

export const langMode = (eff: Options) => eff.multilingual === true ? "several" : eff.language !== "auto" ? "one" : "auto";

export function LanguageField({ eff, set, found, bare }: Section) {
  const t = useT();
  const mode = langMode(eff);
  const oneLanguage = eff.language !== "auto" ? eff.language : MAIN_LANGS.includes(currentLang()) ? currentLang() : "en";
  return (
    <fieldset className="pv-radios">
      <legend className={bare ? "pv-sr" : undefined}>{t("Which languages are spoken?")}</legend>
      <label className="pv-radio"><input type="radio" name="langmode" checked={mode === "auto"} onChange={() => set({ language: "auto", multilingual: undefined })} />
        <span><b>{t("Detect automatically")}</b><small>{found && mode === "auto" ? t("Found: {found}.", { found }) + " " : ""}{t("Checks each speaker and switches to several languages on its own if it hears more than one.")}</small></span></label>
      <label className="pv-radio"><input type="radio" name="langmode" checked={mode === "one"} onChange={() => set({ language: oneLanguage, multilingual: false })} />
        <span><b>{t("One language")}</b>
          <select className="input" aria-label={t("Language of the recording")} value={mode === "one" ? eff.language : oneLanguage} onChange={(e) => set({ language: e.target.value, multilingual: false })}>
            {MAIN_LANGS.map((c) => <option key={c} value={c}>{langName(c)}</option>)}
            <optgroup label={t("All other languages")}>
              {WHISPER_LANGS.filter((c) => !MAIN_LANGS.includes(c)).map((c) => ({ c, n: langName(c) })).sort((a, b) => a.n.localeCompare(b.n)).map(({ c, n }) => <option key={c} value={c}>{n}</option>)}
            </optgroup>
          </select>
          {mode === "one" && !MAIN_LANGS.includes(eff.language) && <small>{t("German, English, French and Spanish are the best tested. Other languages work, but accuracy varies, especially with the smaller models.")}</small>}
        </span></label>
      <label className="pv-radio"><input type="radio" name="langmode" checked={mode === "several"} onChange={() => set({ language: "auto", multilingual: true })} />
        <span><b>{t("Several languages")}</b><small>{t("Always checks every speaker's turn on its own, so one person can speak English and the next French. Slower.")}</small></span></label>
    </fieldset>
  );
}

export function ModelField({ eff, set, status, models, timeOf, onOpenSettings, bare }: Section) {
  const t = useT();
  const engines = ENGINE_MODELS.filter((m) => !!status && m.id in status.whisper); // only where that engine can run
  const moon = (status?.moonshine?.catalog ?? []).filter((m) => status?.whisper[m.id]).map((m) => ({ id: m.id, name: moonshineName(m.id), like: "Very fast. This one language only" })); // only the ones already downloaded
  const base: { id: string; name: string; tag?: string; like: string }[] = [...RECOMMENDED, ...engines, ...moon];
  const list = base.some((m) => m.id === eff.model) ? base : [...base, WHISPER_MODELS.find((m) => m.id === eff.model) ?? { id: eff.model, name: eff.model, like: "" }];
  const dlPct = models.dl?.fraction != null ? ` ${Math.round(models.dl.fraction * 100)}%` : "";
  return (
    <fieldset className="pv-radios">
      <legend className={bare ? "pv-sr" : undefined}>{t("Transcription model")}</legend>
      {list.map((m) => {
        const missing = !!status && !status.whisper[m.id];
        const going = models.busy === `download ${m.id}`;
        const label = t(m.name);
        return (
          <div key={m.id} className="pv-radio">
            <input id={`q-${m.id}`} type="radio" name="quality" checked={eff.model === m.id} disabled={missing} onChange={() => set({ model: m.id }, true)} />
            <label htmlFor={`q-${m.id}`}>
              <b>{label}{"tag" in m && m.tag && <span className="badge">{t(m.tag)}</span>}</b>
              <small>{missing ? t("Not downloaded · {size}", { size: modelSize(m.id) }) : timeOf?.(m.id) || ("like" in m && m.like ? t(m.like) : "")}</small>
            </label>
            {missing && (going ? (
              <span className="pv-dl"><span className="note" role="status">{models.dl?.fraction != null ? `${Math.round(models.dl.fraction * 100)}%` : t("Starting…")}</span>
                <button type="button" className="btn quiet small" onClick={models.cancel}>{t("Cancel")}</button></span>
            ) : (
              <button type="button" className="btn small" disabled={!!models.busy} aria-label={t("Download the {label} model, {size}", { label, size: modelSize(m.id) })} onClick={() => void models.run("download", m.id)}>{t("Download")}</button>
            ))}
          </div>
        );
      })}
      {models.err && <p className="alert warn" role="alert">{models.err}</p>}
      <small className="pv-more">{t("Need another size?")} <button type="button" className="linkish" onClick={() => onOpenSettings?.("Transcription")}>{t("Open Settings, Transcription")}</button></small>
      <span className="pv-sr" aria-live="polite">{models.busy.startsWith("download ") ? t("Downloading {model}", { model: modelName(models.busy.slice(9)) }) + dlPct : ""}</span>
    </fieldset>
  );
}

export function TranscriptOnlyField({ eff, set }: Section) {
  const t = useT();
  return (
    <label className="pv-check"><input type="checkbox" checked={!!eff.noDiarize} onChange={(e) => set({ noDiarize: e.target.checked })} />
      <span><b>{t("Transcript only")}</b><small>{t("Don't work out who is speaking. Saves time.")}</small></span></label>
  );
}

export function ExtrasField({ eff, set, advanced, status, onOpenSettings }: Section) {
  const t = useT();
  const translate = eff.translate ?? currentLang() === "en";
  const model = status?.llm?.translation?.[0], have = !!model && !!status?.llm?.models?.[model.id];
  const target = have ? eff.translateTo ?? "en" : "en";
  return (
    <>
      <label className="pv-check"><input type="checkbox" checked={translate} onChange={(e) => set({ translate: e.target.checked }, true)} />
        <span><b>{target === "en" ? t("English translation") : t("Translation")}</b><small>{t("Adds a translation under lines in other languages.")}</small></span></label>
      {translate && (
        <label className="field pv-target"><span>{t("Translate into")}</span>
          <select className="input" value={target} disabled={!have} onChange={(e) => set({ translateTo: e.target.value }, true)}>
            {(have ? TRANSLATE_LANGS : ["en"]).map((c) => ({ c, n: langName(c) })).sort((a, b) => (a.c === "en" ? -1 : b.c === "en" ? 1 : a.n.localeCompare(b.n))).map(({ c, n }) => <option key={c} value={c}>{n}</option>)}
          </select>
          {!have && model && <small>{t("Other languages need the translation model.")} <button type="button" className="linkish" onClick={() => onOpenSettings?.("Summaries and translation")}>{t("Open Settings, Summaries and translation")}</button></small>}
        </label>
      )}
      <label className="pv-check"><input type="checkbox" checked={!!eff.verbatim} onChange={(e) => set({ verbatim: e.target.checked }, true)} />
        <span><b>{t("Write hesitations down")}</b><small>{t("Keeps “um” and “äh”. A nudge, not a guarantee.")}</small></span></label>
      {advanced && <label className="pv-check"><input type="checkbox" checked={!!eff.vad} onChange={(e) => set({ vad: e.target.checked })} />
        <span><b>{t("Skip silence")}</b><small>{t("Ignores long pauses. Faster, but can miss quiet speech.")}</small></span></label>}
    </>
  );
}

export function NamesField({ eff, set, bare }: Section) {
  const t = useT();
  return (
    <label className="field"><span className={bare ? "pv-sr" : undefined}>{t("Names and special words")}</span>
      <textarea className="input" placeholder={t("Jonas, Müller GmbH…")} value={eff.prompt} onChange={(e) => set({ prompt: e.target.value })} />
    </label>
  );
}
