import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { fmt } from "../types";
import { parseTime, shortcutList } from "../shortcuts";

/** Keeps Tab inside a small dialog and closes it on Escape. */
function useDialogKeys(onClose: () => void) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab") return;
      const els = box.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input");
      if (!els?.length) return;
      const a = els[0], z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); before?.focus?.(); };
  }, []);
  return box;
}

/** The list of keyboard shortcuts (the ? key). */
export function ShortcutSheet({ onClose }: { onClose(): void }) {
  const t = useT();
  const box = useDialogKeys(onClose);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return (
    <div className="scrim win" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t("Keyboard shortcuts")} ref={box}>
        <h2>{t("Keyboard shortcuts")}</h2>
        <table className="st-table kb-table"><caption className="st-sr">{t("Keyboard shortcuts")}</caption>
          <thead><tr><th scope="col">{t("Keys")}</th><th scope="col">{t("Does")}</th></tr></thead>
          <tbody>{shortcutList(t).map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody>
        </table>
        <div className="row"><button type="button" className="btn sun" ref={first} onClick={onClose}>{t("Close")}</button></div>
      </div>
    </div>
  );
}

/** Type a time and land on that line (the G key). */
export function GoToTime({ duration, onGo, onClose }: { duration: number; onGo(seconds: number): void; onClose(): void }) {
  const t = useT();
  const box = useDialogKeys(onClose);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => { input.current?.focus(); }, []);
  const go = () => {
    const s = parseTime(value);
    if (s == null) { setBad(true); return; }
    onGo(Math.min(s, duration));
  };
  return (
    <div className="scrim win" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="dialog" role="dialog" aria-modal="true" aria-label={t("Go to a time")} ref={box as React.RefObject<HTMLFormElement & HTMLDivElement>} onSubmit={(e) => { e.preventDefault(); go(); }}>
        <h2>{t("Go to a time")}</h2>
        <label className="field">{t("Time in the recording, for example 12:30")}
          <input ref={input} className="input" inputMode="numeric" autoComplete="off" value={value} aria-invalid={bad} aria-describedby={bad ? "goto-err" : undefined}
            onChange={(e) => { setValue(e.target.value); setBad(false); }} placeholder={`0:00 – ${fmt(duration)}`} />
        </label>
        {bad && <p className="alert warn" id="goto-err" role="alert">{t("That is not a time. Type minutes and seconds, like 12:30.")}</p>}
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>{t("Cancel")}</button>
          <button type="submit" className="btn sun">{t("Go")}</button>
        </div>
      </form>
    </div>
  );
}
