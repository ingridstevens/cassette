import { LANGS, LangPref, systemLang, useT } from "../../i18n";
import { Options } from "../../types";

export default function LanguageSection({ opts, set }: { opts: Options; set(o: Options): void }) {
  const t = useT();
  const pref: LangPref = opts.appLanguage ?? "system";
  const name = (id: string) => LANGS.find((l) => l.id === id)?.label ?? id;
  return (
    <>
      <div className="card st-card">
        <h2>{t("Language of the app")}</h2>
        <p className="st-lead">{t("Menus, buttons and messages. By default the app uses your computer's language when it has it, and English otherwise.")}</p>
        <div className="choices" role="radiogroup" aria-label={t("Language of the app")}>
          {([["system", t("Match my computer ({language})", { language: name(systemLang()) })], ...LANGS.map((l) => [l.id, l.label])] as [LangPref, string][]).map(([id, label]) => (
            <label key={id} className={"choice" + (pref === id ? " on" : "")}>
              <input type="radio" name="app-language" checked={pref === id} onChange={() => set({ ...opts, appLanguage: id === "system" ? undefined : id })} />
              <span><b>{label}</b></span>
            </label>
          ))}
        </div>
        <p className="note" style={{ marginTop: 12 }}>{t("Translations are machine-assisted and have not been reviewed by native speakers yet. If something reads oddly, the English text is the reference.")}</p>
      </div>
      <div className="card st-card">
        <h2>{t("Language of your recordings")}</h2>
        <p className="st-lead">{t("This is set per project, not here: open a project, choose the Options tab, and pick the language under Language of the recording. By default it is detected automatically. German, English, French and Spanish are supported.")}</p>
        <p className="note" style={{ marginTop: 12 }}>{t("Tip: if a recording mixes languages, leave Mixed languages on Automatic in the project's Options, or set the language of a single line in its speaker menu.")}</p>
      </div>
    </>
  );
}
