import { LANGS, LangPref, systemLang } from "../../i18n";
import { useT } from "../../i18n";
import { LOOKS, MOD_KEY, lookOf } from "../../types";
import { Block, SectionProps } from "./shared";

const SIZES: [number, string][] = [[1, "Normal"], [1.15, "Large"], [1.3, "Extra large"], [1.5, "Largest"]];

export default function TextLanguageSection({ opts, set }: SectionProps) {
  const t = useT();
  const size = opts.textSize ?? 1, look = lookOf(opts), scheme = opts.colorScheme ?? "system", contrast = opts.contrast === "high" ? "high" : "standard";
  const pref: LangPref = opts.appLanguage ?? "system";
  const name = (id: string) => LANGS.find((l) => l.id === id)?.label ?? id;
  const keys: [string, string][] = [
    ["Space / K", t("Play or pause")], ["J / L", t("Back or forward 10 seconds")], [`${MOD_KEY}F`, t("Find in the transcript")], [`${MOD_KEY}E`, t("Open the Export menu")],
    [`${MOD_KEY},`, t("Open Settings")], ["Enter", t("Save an edit")], ["Esc", t("Close a menu or dialog, or cancel an edit")],
  ];
  return (
    <>
      <Block id="tx-size" title={t("Text size")}>
        <p className="note">{t("Changes everything in the app. Try it.")}</p>
        <fieldset className="sizes"><legend className="st-sr">{t("Text size")}</legend>
          {SIZES.map(([v, label]) => (
            <label key={v} className={size === v ? "on" : ""}>
              <input type="radio" name="text-size" checked={size === v} onChange={() => set({ ...opts, textSize: v === 1 ? undefined : v })} />
              <span><b>{t(label)}</b><span>{t("The quick brown fox.")}</span></span>
            </label>
          ))}
        </fieldset>
      </Block>
      <Block id="tx-lang" title={t("Language of the app")}>
        <div className="f7">
          <label htmlFor="app-lang">{t("Menus, buttons and messages")}</label>
          <select id="app-lang" className="input" value={pref} onChange={(e) => { const v = e.target.value as LangPref; set({ ...opts, appLanguage: v === "system" ? undefined : v }); }}>
            <option value="system">{t("Match my computer ({language})", { language: name(systemLang()) })}</option>
            {LANGS.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.label}</option>)}
          </select>
        </div>
        <p className="note">{t("Translations are machine-assisted and have not been reviewed by native speakers yet. If something reads oddly, the English text is the reference.")}</p>
      </Block>
      <Block id="tx-look" title={t("Appearance")}>
        <fieldset className="look-tiles st-fieldset"><legend className="st-sr">{t("Choose a look")}</legend>
          {LOOKS.map((l) => (
            <label key={l.id} className={"look-tile" + (look === l.id ? " on" : "")} data-preview={l.id}>
              <input type="radio" name="look" checked={look === l.id} onChange={() => set({ ...opts, look: l.id, lookLevel: undefined, boring: undefined })} />
              <span className="look-swatch" aria-hidden><i /><i /><i /></span>
              <b>{t(l.name)}</b>
              <small>{t(l.caption)}</small>
            </label>
          ))}
        </fieldset>
        <fieldset className="choices row st-fieldset"><legend>{t("Light or dark")}</legend>
          {([["system", t("Match my computer")], ["light", t("Light")], ["dark", t("Dark")]] as const).map(([id, label]) => (
            <label key={id} className={"choice" + (scheme === id ? " on" : "")}><input type="radio" name="scheme" checked={scheme === id} onChange={() => set({ ...opts, colorScheme: id })} /><span><b>{label}</b></span></label>
          ))}
        </fieldset>
        <fieldset className="choices row st-fieldset"><legend>{t("Contrast")}</legend>
          {([["standard", t("Standard")], ["high", t("High contrast")]] as const).map(([id, label]) => (
            <label key={id} className={"choice" + (contrast === id ? " on" : "")}><input type="radio" name="contrast" checked={contrast === id} onChange={() => set({ ...opts, contrast: id })} /><span><b>{label}</b><small>{id === "high" ? t("Stronger colours and heavier borders, in either look.") : ""}</small></span></label>
          ))}
        </fieldset>
        <fieldset className="choices row st-fieldset"><legend>{t("Soft look")}</legend>
          {([["auto", t("Automatic"), t("Blurred glass on menus and panels, only on computers with plenty of memory.")], ["on", t("On"), ""], ["off", t("Off"), ""]] as const).map(([id, label, hint]) => (
            <label key={id} className={"choice" + ((opts.soft ?? "auto") === id ? " on" : "")}><input type="radio" name="soft" checked={(opts.soft ?? "auto") === id} onChange={() => set({ ...opts, soft: id })} /><span><b>{label}</b><small>{hint}</small></span></label>
          ))}
        </fieldset>
      </Block>
      <Block id="tx-keys" title={t("Keyboard shortcuts")}>
        <div className="tbl-wrap"><table className="st-table"><caption className="st-sr">{t("Keyboard shortcuts")}</caption>
          <thead><tr><th scope="col">{t("Keys")}</th><th scope="col">{t("Does")}</th></tr></thead>
          <tbody>{keys.map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody></table></div>
      </Block>
    </>
  );
}
