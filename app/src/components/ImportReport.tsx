import { useEffect, useRef } from "react";
import { useT } from "../i18n";
import { modelName } from "./modelInfo";
import type { ImportRow } from "./useModels";

/** After "Use a models folder": which models were copied, which are broken in the folder, which were simply not there. Words, not colour alone. */
export default function ImportReport({ rows, onClose }: { rows: ImportRow[]; onClose(): void }) {
  const t = useT();
  const done = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close.current(); } else if (e.key === "Tab") { e.preventDefault(); done.current?.focus(); } };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); before?.focus?.(); };
  }, []);
  const name = (id: string) => (id === "diarization" ? t("Speaker detection") : modelName(id));
  const got = rows.filter((r) => r.state === "imported"), bad = rows.filter((r) => r.state === "incomplete"), none = rows.filter((r) => r.state === "missing");
  return (
    <div className="scrim win" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t("Models folder")} ref={box}>
        <h2>{got.length ? t("Models copied") : t("No models were copied")}</h2>
        {got.length > 0 && <><p><b>{t("Copied from the folder")}</b></p><ul className="rm-list">{got.map((r) => <li key={r.id}>{name(r.id)}</li>)}</ul></>}
        {bad.length > 0 && (<>
          <p><b>{t("Incomplete in the folder")}</b></p>
          <ul className="rm-list">{bad.map((r) => <li key={r.id}>{name(r.id)}</li>)}</ul>
          <p className="alert warn" role="alert">{t("These look cut short, for example a copy that stopped halfway. Ask whoever shared the folder to copy it again; nothing was changed for them.")}</p>
        </>)}
        {none.length > 0 && <p>{t("Not in the folder: {list}. That is fine if you do not need them; you can download them later.", { list: none.map((r) => name(r.id)).join(", ") })}</p>}
        <div className="row"><button type="button" className="btn sun" ref={done} onClick={onClose}>{t("Done")}</button></div>
      </div>
    </div>
  );
}
