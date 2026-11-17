import { useEffect, useState } from "react";
import { MAIN_LANGS, WHISPER_LANGS, langName } from "../../languages";
import { useT } from "../../i18n";
import { ModelErrorCard } from "../ErrorCard";
import { ENGINE_MODELS, WHISPER_MODELS, isMoonshine, moonshineName } from "../modelInfo";
import { MODEL_BYTES } from "../useModels";
import ModelList, { Entry } from "./ModelList";
import { Block, Engine, SectionProps, engineOf } from "./shared";

const ORDER = [...WHISPER_MODELS.map((m) => m.id), ...ENGINE_MODELS.map((m) => m.id)];
const QUICK: [string, string][] = [["Faster", "base"], ["In the middle", "small"], ["Fewer mistakes", "large-v3-turbo"]];

export default function TranscriptionSection({ opts, set, status, models, say }: SectionProps) {
  const t = useT();
  const inUse = engineOf(opts.model);
  const [eng, setEng] = useState<Engine>(inUse);
  const [slow, setSlow] = useState(false);
  useEffect(() => { window.api.paths().then((p) => setSlow(p.system.platform === "darwin" && p.system.arch === "x64")); }, []);
  const nameOf = (id: string) => (isMoonshine(id) ? moonshineName(id) : ENGINE_MODELS.some((m) => m.id === id) ? ENGINE_MODELS.find((m) => m.id === id)!.name : `Whisper ${labelOf(id)}`);
  const labelOf = (id: string) => { const m = WHISPER_MODELS.find((x) => x.id === id); return !m ? id : id.startsWith("large") ? m.name : t(m.name); };
  const have = (id: string) => !!status?.whisper[id];
  const size = (id: string) => status?.sizes?.whisper[id] || MODEL_BYTES[id] || 5e8;
  /** After deleting the model in use: the nearest downloaded one, same engine first. */
  const altFor = (id: string): Entry["alt"] => {
    const others = [...ORDER, ...(status?.moonshine?.catalog.map((m) => m.id) ?? [])].filter((x) => x !== id && have(x));
    const same = others.filter((x) => engineOf(x) === engineOf(id)), pick = (same.length ? same : others).sort((a, b) => Math.abs(ORDER.indexOf(a) - ORDER.indexOf(id)) - Math.abs(ORDER.indexOf(b) - ORDER.indexOf(id)))[0];
    return pick ? { label: nameOf(pick), apply: () => set({ ...opts, model: pick }) } : undefined;
  };
  const reliable = (id: string) => {
    const f = status?.fit; if (!f) return "";
    const own = f.engines?.[id];
    if (own) return t("Reliable in {count} of {total} languages", { count: own.length, total: Object.keys(f.floor).length });
    const at = f.order.indexOf(id), all = Object.values(f.floor);
    return at < 0 ? "" : t("Reliable in {count} of {total} languages", { count: all.filter((x) => f.order.indexOf(x) <= at).length, total: all.length });
  };
  const entry = (id: string, name: string, purpose: string, badge?: string, extra?: Partial<Entry>): Entry => ({
    id, run: id, name, purpose: <>{purpose}{reliable(id) && <small className="rel">{reliable(id)}</small>}</>, badge, size: size(id), have: have(id), inUse: opts.model === id,
    onUse: () => set({ ...opts, model: id }), undo: () => set({ ...opts, model: opts.model }), alt: opts.model === id ? altFor(id) : undefined, ...extra,
  });
  const parakeetOk = !!status?.parakeetAvailable, moonOk = !!status?.moonshine?.available;
  const engines: [Engine, string, string, boolean][] = [
    ["whisper", "Whisper", t("By OpenAI · MIT licence · about 99 languages · finds the language by itself"), true],
    ["parakeet", "Parakeet v3", t("By NVIDIA · CC-BY-4.0 · 25 European languages · cannot find the language by itself"), parakeetOk],
    ["moonshine", "Moonshine", t("By Moonshine AI · MIT licence · one small model per language · word times are estimates"), moonOk],
  ];
  const missing = status ? engines.filter((e) => !e[3]).map((e) => e[1]) : [];
  let entries: Entry[] = [];
  if (eng === "whisper") entries = WHISPER_MODELS.map((m) => entry(m.id, `Whisper ${labelOf(m.id)}`, t(m.like), m.tag ? t(m.tag) : undefined, slow && ["medium", "large-v3-turbo", "large-v3"].includes(m.id) ? { note: t("May be slow on this computer. A smaller size is quicker.") } : {}));
  else if (eng === "parakeet") entries = ENGINE_MODELS.map((m) => entry(m.id, m.name, t(m.like)));
  else entries = (status?.moonshine?.catalog ?? []).map((m) => entry(m.id, moonshineName(m.id), t("Fast drafts in {language}.", { language: langName(m.language) }), undefined, { size: status?.sizes?.whisper[m.id] || m.bytes, downloadSize: m.bytes }));

  // Language of recordings follows the model in use
  const lang = opts.language || "auto";
  const mode = lang === "auto" ? "auto" : "fixed";
  const anyWhisper = WHISPER_MODELS.some((m) => have(m.id));
  const codes = [...MAIN_LANGS, ...WHISPER_LANGS.filter((c) => !MAIN_LANGS.includes(c))];
  const langOptions = (list: string[]) => list.map((c) => <option key={c} value={c}>{langName(c)}</option>);
  const pLangs = status?.fit?.engines?.["parakeet-v3"] ?? ["de", "en", "fr", "es", "it", "nl", "pl", "ru", "uk"];
  const choice = (id: string, value: "auto" | "fixed", title: string, help: string, disabled = false) => (
    <label className={"choice" + (mode === value ? " on" : "")}>
      <input type="radio" name="rec-lang" checked={mode === value} disabled={disabled} onChange={() => set({ ...opts, language: value === "auto" ? "auto" : (lang !== "auto" ? lang : "en") })} />
      <span><b>{title}</b><small>{help}</small></span>
    </label>
  );
  const moonCat = status?.moonshine?.catalog ?? [];
  return (
    <>
      <p className="st-lead-big" role="status">{t("In use: {model}. This is the default for new projects.", { model: have(opts.model) ? nameOf(opts.model) : t("no model yet") })}</p>
      {models.errInfo && !models.busy && <ModelErrorCard models={models} />}
      <Block id="tr-eng" title={t("Engine")}>
        <p className="note">{t("The engine is the program that turns speech into text.")}</p>
        <fieldset className="choices st-fieldset"><legend className="st-sr">{t("Engine to show")}</legend>
          {engines.filter((e) => e[3]).map(([id, name, facts]) => (
            <label key={id} className={"choice" + (eng === id ? " on" : "")}>
              <input type="radio" name="engine" checked={eng === id} onChange={() => setEng(id)} />
              <span><b>{name}{inUse === id && have(opts.model) && <span className="badge">{t("In use")}</span>}</b><small>{facts}</small></span>
            </label>
          ))}
        </fieldset>
        <p className="note">{t("Choosing an engine only shows its models. The model you use stays the same until you press Use.")}</p>
        {missing.length > 0 && <p className="note">{t("Not available on this computer: {list}.", { list: missing.join(", ") })}</p>}
      </Block>
      <Block id="tr-mod" title={t("Models for {engine}", { engine: engines.find((e) => e[0] === eng)![1] })}>
        {eng === "whisper" && (
          <div className="quick" role="group" aria-label={t("Quick pick")}>
            <span className="note">{t("Quick pick:")}</span>
            {QUICK.map(([label, id]) => (
              <button key={id} type="button" className="btn small" aria-label={t("{choice}: Whisper {model}", { choice: t(label), model: labelOf(id) })}
                onClick={() => { if (have(id)) { set({ ...opts, model: id }); say(t("Now using {name}. This is the default for new projects.", { name: nameOf(id) }), () => set({ ...opts, model: opts.model })); } else say(t("{name} is not downloaded yet. Download it below first.", { name: nameOf(id) })); }}>{t(label)}</button>
            ))}
          </div>
        )}
        <ModelList entries={entries} models={models} say={say} label={t("Models for {engine}", { engine: engines.find((e) => e[0] === eng)![1] })} />
        {eng === "whisper" && <p className="note">{t("One measurement, not a promise: Whisper Small took about 15 seconds for 58 seconds of audio on the processor, and about 1 second on the Apple GPU. Other models have not been measured.")}</p>}
        <p className="note">{t("Words the model is unsure about are always underlined in the transcript.")}</p>
        <p className="note"><button type="button" className="linkish" onClick={() => void models.importFolder()}>{t("Use a models folder…")}</button> {t("Someone in your team can share one folder so nobody has to download.")}</p>
        <p className="note">{t("Models download from huggingface.co. Transcription models need no account or key; only speaker detection needs a free Hugging Face token.")}</p>
      </Block>
      <Block id="tr-lang" title={t("Language of your recordings")}>
        <p className="note">{t("This follows the model in use: {model}.", { model: nameOf(opts.model) })}</p>
        {inUse === "whisper" && (
          <>
            <fieldset className="choices st-fieldset"><legend className="st-sr">{t("How to choose the language")}</legend>
              {choice("auto", "auto", t("Find it by itself"), t("The app listens to the start of each file. Works best when a recording switches language."))}
              {choice("fixed", "fixed", t("Always this language"), t("Faster when you know the language. Assumes one language per recording."))}
            </fieldset>
            {mode === "fixed" && <div className="f7"><label htmlFor="rec-fixed">{t("Language")}</label><select id="rec-fixed" className="input" value={lang} onChange={(e) => set({ ...opts, language: e.target.value })}>{langOptions(codes)}</select></div>}
          </>
        )}
        {inUse === "parakeet" && (
          <>
            <p className="note">{t("Parakeet cannot find the language by itself.")}</p>
            <fieldset className="choices st-fieldset"><legend className="st-sr">{t("How to choose the language")}</legend>
              {choice("auto", "auto", t("Let the app find it"), anyWhisper ? t("Uses a small Whisper model to listen to the first seconds.") : t("Needs a Whisper model. Download Whisper Tiny first."), !anyWhisper)}
              {choice("fixed", "fixed", t("Always this language"), t("Choose one of the 25 languages."))}
            </fieldset>
            {mode === "fixed" && <div className="f7"><label htmlFor="rec-fixed">{t("Language")}</label><select id="rec-fixed" className="input" value={lang} onChange={(e) => set({ ...opts, language: e.target.value })}>{langOptions(pLangs)}</select></div>}
          </>
        )}
        {inUse === "moonshine" && (
          <>
            <p className="note">{t("Moonshine has one model per language. Choose the language of your files.")}</p>
            <div className="f7"><label htmlFor="rec-moon">{t("Language")}</label>
              <select id="rec-moon" className="input" value={opts.model} onChange={(e) => { const m = moonCat.find((x) => x.id === e.target.value); if (m) set({ ...opts, model: m.id, language: m.language }); }}>
                {moonCat.map((m) => <option key={m.id} value={m.id} disabled={!have(m.id)}>{langName(m.language)}{have(m.id) ? "" : " (" + t("download first") + ")"}</option>)}
              </select></div>
          </>
        )}
        <p className="note">{t("You can change it for one project in its Options, or for one line in its speaker menu.")}</p>
      </Block>
      <details className="st-help"><summary>{t("Can I add another engine, like Voxtral?")}</summary><p>{t("No. The app runs only these three engines. Adding a new one needs a code change. It is not a setting.")}</p></details>
    </>
  );
}
