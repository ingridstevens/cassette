import { useRef, useState } from "react";
import { LOOKS, Options, lookLevelOf } from "../../types";
import { useT } from "../../i18n";

interface Props { opts: Options; set(o: Options): void }

export default function DisplaySection({ opts, set }: Props) {
  const t = useT();
  /** The joke options do nothing on purpose; the card says so. */
  const EXEC: { label: string; hint: string; reply: string }[] = [
    { label: t("Synergy level"), hint: t("Low · Medium · Paradigm shift"), reply: t("Synergy leveraged. Nothing changed, but we are aligned.") },
    { label: t("Per my last email"), hint: t("Adds a polite edge to every message"), reply: t("Enabled. There are no messages, so no one can tell.") },
    { label: t("Circle back"), hint: t("Postpones this setting"), reply: t("Circling back. Expect an update in 3–5 business years.") },
  ];
  const level = lookLevelOf(opts);
  const scheme = opts.colorScheme ?? "system";
  const SCHEMES: ["system" | "light" | "dark", string][] = [["system", t("Match my computer")], ["light", t("Light")], ["dark", t("Dark")]];
  const [toast, setToast] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const say = (m: string) => { setToast(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(""), 4200); };
  const go = (l: number) => set({ ...opts, lookLevel: l, boring: undefined });

  return (
    <>
      <div className="card st-card">
        <h2>{t("How should it feel?")}</h2>
        <p className="st-lead">{t("Drag from a fairytale sunset to boring corporate. Everything works the same at every stop; only the mood changes.")}</p>
        <div className="mood">
          <input type="range" min={0} max={3} step={1} value={level} aria-label={t("Look, from fairytale sunset to boring corporate")}
            aria-valuetext={t(LOOKS[level].name)} onChange={(e) => go(Number(e.target.value))} />
          <div className="mood-ticks" aria-hidden>
            {LOOKS.map((l, i) => <span key={l.name} className={i === level ? "on" : ""} style={{ ["--i" as string]: i }}>{t(l.name)}</span>)}
          </div>
        </div>
        <p className="mood-caption" role="status"><b>{t(LOOKS[level].name)}.</b> {t(LOOKS[level].caption)}</p>
        <div className="st-actions">
          {level < 3
            ? <button type="button" className="btn" onClick={() => { go(3); say(t("Fun removed. A mandatory 3-minute fun-removal survey has been scheduled for you. (It does not exist.)")); }}>{t("Remove all fun")}</button>
            : <button type="button" className="btn sun" onClick={() => { go(0); say(t("Fun restored. HR has been notified.")); }}>{t("Restore fun")}</button>}
        </div>
      </div>

      <div className="card st-card">
        <h2>{t("Light or dark")}</h2>
        <p className="st-lead">{t("Works with every look above.")}</p>
        <div className="seg-choice" role="radiogroup" aria-label={t("Light or dark")}>
          {SCHEMES.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={scheme === id} className={scheme === id ? "on" : ""}
              onClick={() => set({ ...opts, colorScheme: id })}>{label}</button>
          ))}
        </div>
      </div>

      {level === 3 && (
        <div className="card st-card">
          <h2>{t("Executive options")}</h2>
          <p className="st-lead">{t("Unlocked at the last stop. These do nothing. They are here for morale.")}</p>
          <ul className="exec">
            {EXEC.map((x) => (
              <li key={x.label}>
                <span className="grow"><b>{x.label}</b><small>{x.hint}</small></span>
                <button type="button" className="btn small" onClick={() => say(x.reply)}>{t("Apply")}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {toast && <div className="toast" role="status"><span>{toast}</span></div>}
    </>
  );
}
