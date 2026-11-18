import { ReactNode, useState, useSyncExternalStore } from "react";
import { useT } from "./i18n";
import { markSeen, readSeen } from "./hints";

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const read = () => readSeen().join("\n");

/** Help text that shows in full until the person presses "Got it", then folds behind a "?" button. */
export default function Hint({ id, children }: { id: string; children: ReactNode }) {
  const t = useT();
  const seen = useSyncExternalStore(subscribe, read).split("\n").includes(id);
  const [open, setOpen] = useState(false);
  const regionId = `hint-${id}`;
  if (!seen) {
    return (
      <div className="note pv-hint" id={regionId}>
        {children}
        <button type="button" className="btn quiet small" onClick={() => { markSeen(id); listeners.forEach((l) => l()); }}>{t("Got it")}</button>
      </div>
    );
  }
  return (
    <div className="pv-hint-folded">
      <button type="button" className="linkish pv-hint-q" aria-label={t("Show help")} aria-expanded={open} aria-controls={open ? regionId : undefined} onClick={() => setOpen((o) => !o)}>?</button>
      {open && <div className="note pv-hint" id={regionId}>{children}</div>}
    </div>
  );
}
