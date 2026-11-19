import { ReactNode, useEffect, useRef } from "react";

interface Props { title: string; children: ReactNode; keepLabel: string; okLabel: string; onKeep(): void; onOk(): void; /** An optional middle choice, such as "Delete and use another model". */ altLabel?: string; onAlt?(): void; /** Class for the confirm button; the default is the red "danger" style. */ okClass?: string }

/** Confirm dialog: focus moves in (to the safe button), Tab stays inside, Escape or a click outside closes it. */
export default function Dialog({ title, children, keepLabel, okLabel, onKeep, onOk, altLabel, onAlt, okClass }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const close = useRef(onKeep);
  close.current = onKeep;
  useEffect(() => { keep.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab") return;
      const els = box.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input, [tabindex]");
      if (!els || !els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onKeep(); }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title} ref={box}>
        <h2>{title}</h2>
        {children}
        <div className="row">
          <button type="button" className="btn" ref={keep} onClick={onKeep}>{keepLabel}</button>
          {altLabel && onAlt && <button type="button" className="btn sun" onClick={onAlt}>{altLabel}</button>}
          <button type="button" className={okClass ?? "btn danger"} onClick={onOk}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** Remembers which element opened a dialog so focus can go back to it when the dialog closes. */
export function useReturnFocus() {
  const from = useRef<HTMLElement | null>(null);
  return {
    remember: () => { from.current = document.activeElement as HTMLElement | null; },
    restore: () => { const el = from.current; from.current = null; setTimeout(() => { if (el && el.isConnected) el.focus(); }, 0); },
  };
}
