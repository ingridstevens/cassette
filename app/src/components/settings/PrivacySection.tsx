import { useEffect, useRef, useState } from "react";
import { IS_MAC, IS_WIN, Options } from "../../types";
import { HF_TOKEN_PAGE, Models } from "../useModels";
import { useT } from "../../i18n";
import Dialog, { useReturnFocus } from "./Dialog";
import { SwitchRow } from "./shared";
import { bytes } from "../../types";

interface Props { models: Models; opts: Options; set(o: Options): void }

/** A file path that can wrap after a slash instead of in the middle of a word. */
const Path = ({ p }: { p: string }) => <code>{p.split("/").map((part, i, all) => <span key={i}>{part}{i < all.length - 1 ? <>/<wbr /></> : null}</span>)}</code>;

export default function PrivacySection({ models, opts, set }: Props) {
  const t = useT();
  // The hook has no way to clear its token state, so this section keeps its own copy and re-reads it from the main process.
  const [hint, setHint] = useState<string | null>(models.tokenSet ? models.tokenHint : null);
  const [replacing, setReplacing] = useState(false);
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [log, setLog] = useState<{ on: boolean; bytes: number; hideNames: boolean } | null>(null);
  const [clearAsk, setClearAsk] = useState(false);
  const [logMsg, setLogMsg] = useState("");
  const refreshLog = () => window.api.logState().then(setLog).catch(() => {});
  useEffect(() => { void refreshLog(); }, []);
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
          <div className="grow"><h2>{t("Old projects")}</h2>
            <p className="st-lead">{t("Choose how long to keep projects. The app never deletes anything by itself: when projects are older than this it lists them when you open the app and asks. You see what goes and what stays, and get a receipt.")}</p></div>
          <label className="field" style={{ width: 200 }}>{t("Ask about projects older than")}
            <select className="input" value={String(opts.retentionDays ?? 0)} onChange={(e) => { const d = Number(e.target.value); set({ ...opts, retentionDays: d || undefined }); }}>
              <option value="0">{t("Never ask")}</option>
              {[30, 90, 180, 365].map((d) => <option key={d} value={d}>{t("{days} days", { days: d })}</option>)}
            </select></label>
        </div>
      </div>

      <div className="card st-card" role="region" aria-labelledby="pv-net">
        <h2 id="pv-net">{t("Every network call")}</h2>
        <div className="tbl-wrap"><table className="st-table st-net"><caption className="st-sr">{t("Every network call")}</caption>
          <thead><tr><th scope="col">{t("Where")}</th><th scope="col">{t("When")}</th><th scope="col">{t("What is sent")}</th><th scope="col">{t("Where in the code")}</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>huggingface.co</code></th><td>{t("You press Download on a model")}</td><td>{t("The model name. Your token, if you saved one.")}</td><td><Path p="engine/src/engine/models.py" /> <small>_fetch</small></td></tr>
            <tr><th scope="row"><code>huggingface.co</code></th><td>{t("You save a token, or the app checks it")}</td><td>{t("The token, to see if it is valid and which model pages you accepted.")}</td><td><Path p="engine/src/engine/models.py" /> <small>check_access</small></td></tr>
            <tr><th scope="row"><code>download.moonshine.ai</code></th><td>{t("You press Download on a Moonshine model")}</td><td>{t("The language.")}</td><td><Path p="engine/src/engine/asr_moonshine.py" /></td></tr>
            <tr><th scope="row"><code>huggingface.co</code></th><td>{t("You press Open the token page or Open the two model pages")}</td><td>{t("Nothing: your browser opens the page. The app opens only huggingface.co pages.")}</td><td><Path p="app/electron/main.ts" /> <small>open-external</small></td></tr>
          </tbody></table></div>
        <p className="note">{t("Every network call is listed here. Nothing else leaves this computer. This comes from reading the app's code, not from an independent audit.")}</p>
        <p className="note">{t("A test in the project (engine/tests/test_network_surface.py) fails if code that can reach the network appears in a new place or a new web address is written into the app. It is a tripwire, not an audit.")}</p>
      </div>

      <div className="card st-card" role="region" aria-labelledby="pv-store">
        <h2 id="pv-store">{t("What is stored where")}</h2>
        <div className="tbl-wrap"><table className="st-table"><caption className="st-sr">{t("What is stored where")}</caption>
          <thead><tr><th scope="col">{t("What")}</th><th scope="col">{t("Where")}</th><th scope="col" className="act"><span className="st-sr">{t("Action")}</span></th></tr></thead>
          <tbody>
            <tr><th scope="row">{t("Your recordings")}</th><td>{t("Where you keep them. Never moved or changed.")}</td><td className="act" /></tr>
            <tr><th scope="row">{t("Projects, transcripts, speaker names")}</th><td>{t("The app folder")}</td><td className="act"><button type="button" className="btn small" aria-label={t("Show the app folder")} onClick={() => window.api.reveal("data")}>{t("Show")}</button></td></tr>
            <tr><th scope="row">{t("Backup copies")}</th><td>{t("Next to each recording, if the switch in Saving and export is on")}</td><td className="act" /></tr>
            <tr><th scope="row">{t("Models")}</th><td>{t("The models folder")}</td><td className="act"><button type="button" className="btn small" aria-label={t("Show the models folder")} onClick={() => window.api.reveal("models")}>{t("Show")}</button></td></tr>
            <tr><th scope="row">{t("Hugging Face token")}</th><td>{hint ? t("Encrypted by your computer's secure storage. Last 4 characters: {hint}", { hint: hint.slice(-4) }) : t("No token is saved.")}</td><td className="act" /></tr>
            <tr><th scope="row">{t("Activity log")}</th><td>{t("File names and folders. It never contains the text of a transcript.")}</td><td className="act"><button type="button" className="btn small" aria-label={t("Show the activity log")} onClick={() => window.api.reveal("log")}>{t("Show")}</button></td></tr>
          </tbody></table></div>
        <p className="note">{t("The app does not encrypt these files. Turn on {name} so they are protected when the computer is off.", { name: IS_MAC ? "FileVault" : IS_WIN ? "BitLocker" : t("disk encryption") })}</p>
      </div>

      <div className="card st-card">
        <div className="st-row">
          <div className="grow">
            <h2 className="st-tok-h">{t("Hugging Face token")}
              {hint
                ? <span className="st-chip on"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{t("Saved")}</span>
                : <span className="st-chip">{t("Not saved")}</span>}
            </h2>
            <p className="st-lead">{hint
              ? t("A token is saved in this computer's secure storage and used only to download the speaker model. Only the last 4 characters are shown, so the full token never appears on screen again. Removing it doesn't delete models you already have.")
              : t("No token is saved. You only need one to download the speaker-detection model. A token you add is kept in this computer's secure storage and is never shown in full again.")}</p></div>
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
                <span className="st-mask-label">{t("Saved token")}</span>
                <span className="input st-mask" role="img" aria-label={t("Saved token, hidden except the last 4 characters")}>{hint}</span>
                <span className="btns"><button type="button" className="btn small" onClick={open}>{t("Replace")}</button>
                  <button type="button" className="btn quiet small danger" onClick={() => { back.remember(); setConfirm(true); }}>{t("Remove")}</button></span>
              </>
            ) : (
              <>
                <span className="input st-mask st-empty">{t("No token saved")}</span>
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
        {log && (
          <>
            <SwitchRow id="log-on" title={t("Keep an activity log")} help={t("Off: nothing more is written to the log. Existing entries stay until you clear them. Without a log it is harder to find out what went wrong.")} on={log.on}
              onChange={async (on) => { await window.api.setLog(on); setLogMsg(on ? t("The activity log is on.") : t("The activity log is off.")); void refreshLog(); }} />
            <SwitchRow id="log-hide" title={t("Hide file and folder names in the log")} help={t("New entries show [file] or [path] instead of the paths and audio or video file names the app recognises. Best effort: a name inside ordinary text may remain, so check the log before you share it. Entries already written are not changed.")} on={log.hideNames}
              onChange={async (hide) => { await window.api.hideLogNames(hide); setLogMsg(hide ? t("File names are hidden in new log entries.") : t("File names are shown in new log entries.")); void refreshLog(); }} />
            <div className="st-row st-setting"><div className="grow"><b>{t("Clear the log file")}</b><p className="note">{log.bytes === 0 ? t("The log file is empty.") : t("Empties the file ({size} now). The activity list in the app is not affected.", { size: bytes(log.bytes) })}</p></div>
              <button type="button" className="btn small" disabled={log.bytes === 0} onClick={() => { back.remember(); setClearAsk(true); }}>{t("Clear log…")}</button></div>
            <p className="st-sr" role="status">{logMsg}</p>
          </>
        )}
      </div>

      {clearAsk && (
        <Dialog title={t("Clear the activity log?")} keepLabel={t("Keep the log")} okLabel={t("Clear log")} onKeep={() => { setClearAsk(false); back.restore(); }}
          onOk={async () => { await window.api.clearLog(); setClearAsk(false); setLogMsg(t("The activity log was cleared.")); void refreshLog(); back.restore(); }}>
          <p>{t("The log file is emptied. This cannot be undone. Models, projects and recordings are not touched.")}</p>
        </Dialog>
      )}

      {confirm && (
        <Dialog title={t("Remove the saved token?")} keepLabel={t("Keep token")} okLabel={t("Remove token")} onKeep={() => { setConfirm(false); back.restore(); }} onOk={remove}>
          <p>{t("The app forgets your Hugging Face token. Models you have already downloaded keep working. To download the speaker model again later, you'd create a new token.")}</p>
        </Dialog>
      )}
    </>
  );
}
