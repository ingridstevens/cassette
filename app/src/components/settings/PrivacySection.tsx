import { useEffect, useRef, useState } from "react";
import { HF_TOKEN_PAGE, Models } from "../useModels";
import { useT } from "../../i18n";
import Dialog, { useReturnFocus } from "./Dialog";

interface Props { models: Models }

export default function PrivacySection({ models }: Props) {
  const t = useT();
  // The hook has no way to clear its token state, so this section keeps its own copy and re-reads it from the main process.
  const [hint, setHint] = useState<string | null>(models.tokenSet ? models.tokenHint : null);
  const [replacing, setReplacing] = useState(false);
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const back = useReturnFocus();
  const reread = () => window.api.token().then((t) => setHint(t || null));
  useEffect(() => { reread(); }, []);
  useEffect(() => { if (replacing) input.current?.focus(); }, [replacing]);

  const open = () => { back.remember(); setValue(""); setErr(""); setReplacing(true); };
  const cancel = () => { setReplacing(false); setValue(""); back.restore(); };
  const save = async () => {
    if (!value.trim()) { setErr(t("Paste your token first.")); input.current?.focus(); return; }
    setSaving(true); setErr("");
    try { await models.saveToken(value); await reread(); setReplacing(false); setValue(""); back.restore(); }
    catch { setErr(t("Couldn't save the token. Try again.")); }
    setSaving(false);
  };
  const remove = async () => {
    setConfirm(false);
    try { await models.clearToken(); } catch { /* re-read below shows the truth */ }
    await reread(); back.restore();
  };

  return (
    <>
      <div className="card st-card">
        <h2>{t("Your recordings stay on this computer")}</h2>
        <p className="st-lead">{t("Audio and transcripts are not uploaded anywhere. The app has no account and sends no usage data. It goes online only to download models, and to check your Hugging Face token when you set up speaker detection.")}</p>
        <div className="st-facts">
          <div className="st-inset"><b>{t("Stays on this computer")}</b>{t("Your recordings, transcripts, speaker names and the project list.")}</div>
          <div className="st-inset"><b>{t("Uses the internet")}</b>{t("Model downloads from huggingface.co, once. After that the app works offline.")}</div>
        </div>
      </div>

      <div className="card st-card">
        <div className="st-row">
          <div className="grow"><h2>{t("Hugging Face token")}</h2>
            <p className="st-lead">{t("Saved in this computer's secure storage and used only to download the speaker model. Only the last 4 characters are shown, so the full token never appears on screen again. Removing it doesn't delete models you already have.")}</p></div>
          <div className="st-token">
            {replacing ? (
              <>
                <label className="field">{t("New token")}
                  <input ref={input} className="input" type="password" placeholder="hf_…" autoComplete="off" spellCheck={false} value={value}
                    onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }} /></label>
                {err && <span className="err-line" role="alert">{err}</span>}
                <span className="btns"><button type="button" className="btn quiet small" onClick={() => window.api.openExternal(HF_TOKEN_PAGE)}>{t("Open token page")}</button>
                  <button type="button" className="btn quiet small" onClick={cancel}>{t("Cancel")}</button>
                  <button type="button" className="btn sun small" disabled={saving} onClick={save}>{t("Save new token")}</button></span>
              </>
            ) : hint ? (
              <>
                <span className="input st-mask" role="img" aria-label={t("Saved token, hidden except the last 4 characters")}>{hint}</span>
                <span className="btns"><button type="button" className="btn small" onClick={open}>{t("Replace")}</button>
                  <button type="button" className="btn quiet small danger" onClick={() => { back.remember(); setConfirm(true); }}>{t("Remove")}</button></span>
              </>
            ) : (
              <>
                <span className="note">{t("No token saved.")}</span>
                <span className="btns"><button type="button" className="btn quiet small" onClick={() => window.api.openExternal(HF_TOKEN_PAGE)}>{t("Open token page")}</button>
                  <button type="button" className="btn small" onClick={open}>{t("Add a token")}</button></span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card st-card">
        <div className="st-row">
          <div className="grow"><h2>{t("Activity log")}</h2>
            <p className="st-lead">{t("A text file of what the app did, for troubleshooting. It lists file names and folders, which can themselves be sensitive, but never the text of a transcript. Share it only with people you trust.")}</p></div>
          <button type="button" className="btn" onClick={() => window.api.reveal("log")}>{t("Show log file")}</button>
        </div>
      </div>

      {confirm && (
        <Dialog title={t("Remove the saved token?")} keepLabel={t("Keep token")} okLabel={t("Remove token")} onKeep={() => { setConfirm(false); back.restore(); }} onOk={remove}>
          <p>{t("The app forgets your Hugging Face token. Models you have already downloaded keep working. To download the speaker model again later, you'd create a new token.")}</p>
        </Dialog>
      )}
    </>
  );
}
