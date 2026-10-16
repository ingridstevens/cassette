import { ReactNode, useState } from "react";
import { bytes } from "../../types";
import { useT } from "../../i18n";
import type { Models } from "../useModels";
import Dialog, { useReturnFocus } from "./Dialog";

/** One downloadable thing (a model) as the list shows it. `run` is the name the engine knows it by. */
export interface Entry {
  id: string; run: string; name: string; purpose?: ReactNode; badge?: string; note?: string; size: number; have: boolean; inUse: boolean;
  /** Why it cannot be used here (shown instead of the buttons). */ whyNot?: string; onUse?(): void; /** Puts back what was in use before onUse ran (offered as Undo). */ undo?(): void; downloadSize?: number;
  /** After deleting the one in use: another model to switch to (offered as "Delete and use …"). */ alt?: { label: string; apply(): void };
}
const gb = (n: number) => bytes(n).replace(".0 GB", " GB");

/** Status in words with a symbol, never colour alone. */
export function Status({ kind, children }: { kind: "ok" | "warn" | "off" | "use"; children: ReactNode }) {
  const sym = { ok: "✓", warn: "!", off: "○", use: "●" }[kind];
  return <span className={"st-st " + kind}><span aria-hidden="true">{sym}</span> {kind === "use" ? <b>{children}</b> : children}</span>;
}

/**
 * One list pattern for every model: name and purpose, size, state in words, then Use / Download / Delete.
 * Using a model is a button press (arrow keys never switch it); deleting asks first.
 */
export default function ModelList({ entries, models, label, say }: { entries: Entry[]; models: Models; label: string; say(msg: string, undo?: () => void): void }) {
  const t = useT();
  const [ask, setAsk] = useState<Entry | null>(null);
  const back = useReturnFocus();
  const close = () => { setAsk(null); back.restore(); };
  const pct = models.dl?.fraction != null ? Math.round(models.dl.fraction * 100) : null;
  const del = async (e: Entry, withAlt: boolean) => {
    close();
    if (withAlt && e.alt) e.alt.apply();
    const ok = await models.run("delete", e.run);
    if (ok) say(withAlt && e.alt ? t("Deleted {name}. Now using {other}.", { name: e.name, other: e.alt.label }) : t("Deleted {name}.", { name: e.name }));
  };
  return (
    <>
      <ul className="mlist" aria-label={label}>
        {entries.map((e) => {
          const going = models.busy === `download ${e.run}`, busy = !!models.busy;
          const size = e.have ? gb(e.size) : t("≈ {size}", { size: gb(e.downloadSize ?? e.size) });
          return (
            <li key={e.id} className={"mr" + (e.inUse && e.have ? " sel" : "")}>
              <div className="mr-main">
                <h4>{e.name}{e.badge && <span className="badge">{e.badge}</span>}</h4>
                {e.purpose && <p className="note">{e.purpose}</p>}
                {e.note && <p className="note warn-t">{e.note}</p>}
              </div>
              <div className="mr-size">{size}</div>
              <div className="mr-state">
                {going ? <span className="st-st"><progress max={100} value={pct ?? undefined} aria-label={t("Downloading {name}", { name: e.name })} /> {pct != null ? `${pct}%` : t("Starting…")}</span>
                  : e.whyNot ? <Status kind="warn">{e.whyNot}</Status>
                  : !e.have ? <Status kind="off">{t("Not downloaded")}</Status>
                  : e.inUse ? <Status kind="use">{t("In use")}</Status> : <Status kind="ok">{t("Downloaded")}</Status>}
              </div>
              <div className="mr-act">
                {going ? <button type="button" className="btn small" onClick={models.cancel} aria-label={t("Cancel the download of {name}", { name: e.name })}>{t("Cancel")}</button>
                  : e.whyNot && !e.have ? null
                  : !e.have ? <button type="button" className="btn small" disabled={busy} onClick={() => void models.run("download", e.run, e.downloadSize)} aria-label={t("Download {name}, {size}", { name: e.name, size: gb(e.downloadSize ?? e.size) })}>{t("Download")}</button>
                  : <>
                    {!e.inUse && e.onUse && <button type="button" className="btn small sun" disabled={busy} onClick={() => { const on = e.onUse!; on(); say(t("Now using {name}. This is the default for new projects.", { name: e.name }), e.undo); }} aria-label={t("Use {name}", { name: e.name })}>{t("Use")}</button>}
                    <button type="button" className="btn small quiet" disabled={busy} onClick={() => { back.remember(); setAsk(e); }} aria-label={t("Delete {name}, {size}", { name: e.name, size })}>{t("Delete")}</button>
                  </>}
              </div>
            </li>
          );
        })}
      </ul>
      {ask && (
        <Dialog title={t("Delete {name}?", { name: ask.name })} keepLabel={t("Keep it")} okLabel={ask.inUse && !ask.alt ? t("Delete anyway") : ask.alt ? t("Delete only") : t("Delete")}
          altLabel={ask.inUse && ask.alt ? t("Delete and use {other}", { other: ask.alt.label }) : undefined} onAlt={ask.alt ? () => void del(ask, true) : undefined}
          onKeep={close} onOk={() => void del(ask, false)}>
          <p>{ask.inUse ? t("It is the one in use.") + " " : ""}{ask.inUse && !ask.alt ? t("After deleting it you cannot do this job until you download another model.") : t("You can download it again later ({size}).", { size: gb(ask.size) })} {t("Your projects and transcripts are not touched.")}</p>
        </Dialog>
      )}
    </>
  );
}
