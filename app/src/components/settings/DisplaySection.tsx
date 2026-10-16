import type { KeyboardEvent } from "react";
import { LOOKS, Options, lookOf } from "../../types";
import { useT } from "../../i18n";

interface Props { opts: Options; set(o: Options): void }

export default function DisplaySection({ opts, set }: Props) {
  const t = useT();
  const look = lookOf(opts);
  const contrast = opts.contrast === "high" ? "high" : "standard";
  const scheme = opts.colorScheme ?? "system";
  const SCHEMES: ["system" | "light" | "dark", string][] = [["system", t("Match my computer")], ["light", t("Light")], ["dark", t("Dark")]];
  const CONTRASTS: ["standard" | "high", string][] = [["standard", t("Standard")], ["high", t("High contrast")]];
  /** Saving `look` also drops the older lookLevel / boring settings, so they cannot disagree with it. */
  const pick = (id: "sunset" | "clean") => set({ ...opts, look: id, lookLevel: undefined, boring: undefined });

  /** Radio groups are one tab stop; the arrow keys move the choice, as a native radio group does. */
  const arrows = (e: KeyboardEvent<HTMLElement>) => {
    const k = e.key, fwd = k === "ArrowRight" || k === "ArrowDown", back = k === "ArrowLeft" || k === "ArrowUp";
    if (!fwd && !back) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = radios[(i + (fwd ? 1 : -1) + radios.length) % radios.length];
    next.focus(); next.click();
  };

  return (
    <>
      <div className="card st-card">
        <h2>{t("Look")}</h2>
        <p className="st-lead">{t("Two looks with the same layout and controls. Only the colours differ.")}</p>
        <div className="look-tiles" role="radiogroup" aria-label={t("Choose a look")} onKeyDown={arrows}>
          {LOOKS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={look === l.id} tabIndex={look === l.id ? 0 : -1} className={`look-tile ${look === l.id ? "on" : ""}`} data-preview={l.id} onClick={() => pick(l.id)}>
              <span className="look-swatch" aria-hidden><i /><i /><i /></span>
              <b>{t(l.name)}</b>
              <small>{t(l.caption)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="card st-card">
        <h2>{t("Light or dark")}</h2>
        <p className="st-lead">{t("Works with every look above.")}</p>
        <div className="seg-choice" role="radiogroup" aria-label={t("Light or dark")} onKeyDown={arrows}>
          {SCHEMES.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={scheme === id} tabIndex={scheme === id ? 0 : -1} className={scheme === id ? "on" : ""}
              onClick={() => set({ ...opts, colorScheme: id })}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card st-card">
        <h2>{t("Contrast")}</h2>
        <p className="st-lead">{t("Stronger colours and heavier borders, in either look.")}</p>
        <div className="seg-choice" role="radiogroup" aria-label={t("Contrast level")} onKeyDown={arrows}>
          {CONTRASTS.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={contrast === id} tabIndex={contrast === id ? 0 : -1} className={contrast === id ? "on" : ""}
              onClick={() => set({ ...opts, contrast: id })}>{label}</button>
          ))}
        </div>
      </div>
    </>
  );
}
