import { useState } from "react";
import { bytes } from "../../types";
import { useT } from "../../i18n";
import Hint from "../../Hint";
import type { ModelStatus } from "../../types";
import { modelLabel, needsRepair, summarize, VerifyRow } from "../../verifyModels";
import type { Models } from "../useModels";
import { MODEL_BYTES } from "../useModels";
import Dialog, { useReturnFocus } from "./Dialog";
import { Status } from "./ModelList";

/** "Verify models": checks every downloaded model on this computer (no network), lists OK / damaged / other version, and offers a confirmed repair. */
export default function VerifyModels({ models, status, say }: { models: Models; status: ModelStatus | null; say(msg: string): void }) {
  const t = useT();
  const [ask, setAsk] = useState<VerifyRow | null>(null);
  const back = useReturnFocus();
  const close = () => { setAsk(null); back.restore(); };
  const rows = models.verified, busy = !!models.busy, checking = models.busy === "verify";
  const sum = rows ? summarize(rows) : null;
  const shown = rows?.filter((r) => r.state !== "missing") ?? [];
  const size = (id: string) => (id.startsWith("llm-") ? status?.llm?.bytes?.[id.slice(4)] : undefined) ?? MODEL_BYTES[id] ?? MODEL_BYTES[id.replace(/^mlx-/, "")] ?? 5e8;
  const run = async () => {
    const rs = await models.verify();
    if (!rs) return;
    const s = summarize(rs);
    say(s.problems ? t("{n} to repair.", { n: s.problems }) : t("All downloaded models are OK."));
  };
  const repair = async (r: VerifyRow) => {
    close();
    const ok = await models.run("repair", r.id, size(r.id));
    if (!ok) return;
    const rs = await models.verify(r.id);
    say(rs?.[0]?.state === "ok" ? t("Repaired {name}.", { name: modelLabel(r.id, status, t) }) : t("{name} still does not check out.", { name: modelLabel(r.id, status, t) }));
  };
  const pct = models.dl?.fraction != null ? Math.round(models.dl.fraction * 100) : null;
  return (
    <>
      <div className="st-row st-setting"><div className="grow"><b>{t("Verify models")}</b>
        <p className="note">{t("Checks every downloaded model on this computer. It reads the files only; nothing is sent anywhere.")}</p></div>
        {checking ? <button type="button" className="btn small" onClick={models.cancel}>{t("Cancel")}</button>
          : <button type="button" className="btn small" disabled={busy} onClick={() => void run()}>{t("Verify")}</button>}
      </div>
      {checking && <p className="note" role="status"><progress max={100} value={pct ?? undefined} aria-label={t("Checking models")} /> {t("Checking {name}…", { name: models.dl?.message ? modelLabel(models.dl.message, status, t) : "" })}</p>}
      <Hint id="verify-models">
        <p>{t("OK means the folder is the version this app pins and every file matches the checksum stored with it when it was downloaded, so damaged, cut-short or swapped files are found. For the two speaker checkpoints it is also compared with a checksum built into this app. It does not prove a file is what the model's authors published. Moonshine models are not covered.")}</p>
      </Hint>
      {rows && (
        <>
          <p className="note" role="status">{sum!.problems ? t("{n} to repair.", { n: sum!.problems }) : t("All downloaded models are OK.")} {sum!.notDownloaded > 0 && t("{n} not downloaded (not listed).", { n: sum!.notDownloaded })}</p>
          <ul className="mlist" aria-label={t("Model check results")}>
            {shown.map((r) => {
              const name = modelLabel(r.id, status, t);
              return (
                <li key={r.id} className="mr">
                  <div className="mr-main"><h4>{name}</h4>
                    <p className="note">{r.state === "other_version" ? t("This copy is a different version from the one this app pins. Repair replaces it with the pinned version.")
                      : r.state === "damaged" ? t("A file is changed, cut short or missing.")
                      : r.how === "pinned" ? t("Matches the checksum stored with it and the one built into this app.")
                      : r.how === "recorded" ? t("Matches the checksum stored with it.") : t("The files are there, but some have no checksum to compare with.")}</p></div>
                  <div className="mr-state">{r.state === "ok" ? <Status kind="ok">{t("OK")}</Status> : r.state === "damaged" ? <Status kind="warn">{t("Damaged")}</Status> : <Status kind="warn">{t("Other version")}</Status>}</div>
                  <div className="mr-act">{needsRepair(r) && <button type="button" className="btn small" disabled={busy} onClick={() => { back.remember(); setAsk(r); }} aria-label={t("Repair {name}", { name })}>{t("Repair…")}</button>}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {ask && (
        <Dialog title={t("Repair {name}?", { name: modelLabel(ask.id, status, t) })} keepLabel={t("Not now")} okLabel={t("Repair")} onKeep={close} onOk={() => void repair(ask)}>
          <p>{ask.state === "damaged" ? t("Only the files that failed the check are removed, then they are downloaded again from huggingface.co at the pinned version.") : t("The copy of this model in your models folder is replaced by the pinned version, downloaded from huggingface.co.")} {t("This download is up to {size}. Other models, your projects and transcripts are not touched.", { size: bytes(size(ask.id)) })}</p>
        </Dialog>
      )}
    </>
  );
}
