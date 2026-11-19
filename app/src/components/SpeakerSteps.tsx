import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { bytes } from "../types";
import { HF_TOKEN_PAGE, MODEL_BYTES, Models } from "./useModels";

const HF = "https://huggingface.co/";

export function Progress({ label, fraction }: { label: string; fraction: number | null }) {
  const pct = fraction == null ? undefined : Math.round(fraction * 100);
  return (
    <div className="prog" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i className={fraction == null ? "indet" : ""} style={fraction == null ? undefined : { width: `${pct}%` }} />
    </div>
  );
}

/** The name we suggest for the Hugging Face token, so nobody has to invent one. Shown and copied as is in every language. */
const TOKEN_NAME = "Cassette";

/** One step of the speaker setup: done steps shrink to a one-line summary, only the current step shows its instructions, later steps wait. */
function Step({ n, at, title, summary, upcoming, children }: { n: number; at: number; title: string; summary?: React.ReactNode; upcoming?: string; children: React.ReactNode }) {
  const t = useT();
  const state = n < at ? "done" : n === at ? "now" : "later";
  return (
    <li className={"sp-step " + state} aria-current={state === "now" ? "step" : undefined}>
      <span className="sp-dot" aria-hidden="true">{state === "done" ? "✓" : n}</span>
      <div className="sp-title">
        <b>{title}</b>
        {state === "now" && <span className="sp-now">{t("Do this now")}</span>}
        {state === "done" && summary && <span className="sp-meta">{summary}</span>}
        {state === "later" && upcoming && <span className="sp-meta muted">{upcoming}</span>}
        <span className="st-sr">{state === "done" ? t("Done") : state === "now" ? t("Current step") : t("Later")}</span>
      </div>
      {state === "now" && <div className="sp-task">{children}</div>}
    </li>
  );
}

/** The four guided steps for speaker detection (account, token, two forms, download). Used by the first-run setup and by Settings, so both walk people through it the same way. */
export default function SpeakerSteps({ models, diarDone }: { models: Models; diarDone: boolean }) {
  const t = useT();
  const { busy, tokenSet, tokenHint, dl, access, checking, checkAccess, run, saveToken, cancel } = models;
  const [token, setToken] = useState("");
  const [hasAccount, setHasAccount] = useState(false);
  const [skipCheck, setSkipCheck] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedProfile, setCopiedProfile] = useState(false);
  const open = true;
  // The token check tells us whose token it is, so the profile address the form asks for can be copied as is.
  const profileUrl = access?.valid && access.username ? `https://huggingface.co/${access.username}` : null;
  const copyProfile = async () => { if (!profileUrl) return; try { await navigator.clipboard.writeText(profileUrl); setCopiedProfile(true); window.setTimeout(() => setCopiedProfile(false), 2000); } catch { /* the address is on screen to type */ } };
  const copyName = async () => { try { await navigator.clipboard.writeText(TOKEN_NAME); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable: the name is on screen to type */ } };
  // A token saved earlier (or in Settings) hasn't been checked in this session yet: check it when the steps open.
  const checked = useRef(false);
  useEffect(() => {
    if (open && tokenSet && !access && !checking && !checked.current) { checked.current = true; void checkAccess(); }
  }, [open, tokenSet, access, checking, checkAccess]);
  // Coming back from the browser after clicking "Agree": check again so the ticks and the download button catch up.
  const pending = !!access?.valid && Object.values(access.repos).some((ok) => !ok);
  useEffect(() => {
    if (!open || !pending) return;
    const again = () => { if (!checking) void checkAccess(); };
    window.addEventListener("focus", again);
    return () => window.removeEventListener("focus", again);
  }, [open, pending, checking, checkAccess]);
  const dlDiar = busy === "download diarization";
  const pct = dl?.fraction != null ? Math.round(dl.fraction * 100) : null;
  // The pages the user must click "Agree" on. A check that finds another gated page not yet accepted adds it here, so step 2 is the one place to act.
  const agreePages: [string, string][] = [["pyannote/speaker-diarization-3.1", "speaker-diarization 3.1"], ["pyannote/segmentation-3.0", "segmentation 3.0"],
    ...Object.entries(access?.repos ?? {}).filter(([r, ok]) => !ok && !r.endsWith("speaker-diarization-3.1") && !r.endsWith("segmentation-3.0")).map(([r]): [string, string] => [r, r.split("/")[1]])];
  const saved = tokenSet;
  // A saved token that Hugging Face hasn't rejected means the account (step 1) and the token (steps 3 and 4) are done.
  const tokenOk = saved && !(access && !access.valid);
  const agreeDone = !!access?.valid && agreePages.every(([r]) => access.repos[r]);
  const accountDone = hasAccount || tokenOk;
  const tokenDone = tokenOk && !replacing;
  // The forms count as done once Hugging Face confirms both, or when it can't be reached and the user chose to try the download anyway.
  const formsDone = agreeDone || (skipCheck && !access && !checking);
  const now = !accountDone ? 1 : !tokenDone ? 2 : !formsDone ? 3 : diarDone ? 5 : 4;
  const minsLeft = [!accountDone, !tokenDone, !formsDone].filter(Boolean).length + (now <= 4 ? 1 : 0);
  const formsLeft = agreePages.filter(([r]) => !(access?.valid && access.repos[r])).length;
  const diarSize = bytes(MODEL_BYTES.diarization);
  return (
    <>
                {now < 5 && (
                  <div className="sp-prog">
                    <div className="sp-bar" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} className={i < now ? "on" : i === now ? "now" : ""} />)}</div>
                    <span>{minsLeft > 0 ? t("{done} of 4 done · about {mins} min left", { done: now - 1, mins: minsLeft }) : t("{done} of 4 done", { done: now - 1 })}</span>
                  </div>
                )}
                <ol className="sp-steps">
                  <Step n={1} at={now} title={t("Create a free account (about 2 minutes)")} summary={t("Done")}>
                    <p>{t("To put names on speakers, the app needs a free account on the website that hosts the speaker model. Your recordings are never sent.")}</p>
                    <div className="sp-acts">
                      <button type="button" className="btn sun ext" onClick={() => window.api.openExternal(`${HF}join`)}>{t("Create account")}</button>
                      <button type="button" className="btn quiet" onClick={() => setHasAccount(true)}>{t("I already have one")}</button>
                    </div>
                  </Step>
                  <Step n={2} at={now} title={t("Make an access code and paste it here")}
                    summary={<>{t("Saved as {hint}", { hint: tokenHint || "hf_…" })} <button type="button" className="linkish" onClick={() => setReplacing(true)}>{t("Replace")}</button></>}>
                    <p>{t("This code lets the app download the speaker model for you.")}</p>
                    <ol className="sp-how">
                      <li>{t("Open the page for access codes. The Read tab is already chosen.")}</li>
                      <li>{t("Name it “{name}” and click Create token.", { name: TOKEN_NAME })}{" "}
                        <button type="button" className="linkish" onClick={copyName}>{copied ? t("Copied ✓") : t("Copy name")}</button></li>
                      <li>{t("Copy the code. It starts with hf_ and is shown only once.")}</li>
                    </ol>
                    <div className="sp-acts"><button type="button" className="btn ext" onClick={() => window.api.openExternal(HF_TOKEN_PAGE)}>{t("Open the code page")}</button></div>
                    <form className="sp-tok" onSubmit={async (e) => { e.preventDefault(); if (!token.trim()) return; await saveToken(token); setToken(""); setReplacing(false); checked.current = true; }}>
                      <label htmlFor="hf-token" className="st-sr">{t("Access code")}</label>
                      <input id="hf-token" className="input" type="password" autoComplete="off" spellCheck={false} placeholder={t("Paste the code (hf_…)")} value={token} onChange={(e) => setToken(e.target.value)} />
                      <button type="submit" className="btn sun" disabled={!token.trim()}>{t("Save")}</button>
                      {replacing && saved && <button type="button" className="btn quiet" onClick={() => { setReplacing(false); setToken(""); }}>{t("Cancel")}</button>}
                    </form>
                    {saved && access && !access.valid && <p className="warn-line" role="alert">{t("That code wasn’t accepted. Check that you copied all of it (it starts with “hf_”), or make a new one.")}</p>}
                  </Step>
                  <Step n={3} at={now} title={t("Fill in a short form on two pages")} summary={t("Both accepted")} upcoming={t("2 free forms, about 1 minute")}>
                    <p>{t("Free. The model’s makers ask for a few details first. Both pages have the same short form:")}</p>
                    <ul className="sp-facts">
                      <li><span className="k">{t("You fill in")}</span><span>{t("Company or university, and Website. Both are required.")}</span></li>
                      <li><span className="k">{t("No company?")}</span><span>{t("For company, write Freelance, Independent or Personal use. For website, use your profile address on that site:")}{" "}
                        <code>{profileUrl ?? "huggingface.co/your-username"}</code>
                        {profileUrl && <>{" "}<button type="button" className="linkish" onClick={copyProfile}>{copiedProfile ? t("Copied ✓") : t("Copy")}</button></>}</span></li>
                      <li><span className="k">{t("You share")}</span><span>{t("Your account email and username go to the model’s makers. They may email you about paid services.")}</span></li>
                      <li><span className="k">{t("Then")}</span><span>{t("Click “Agree and access repository” at the bottom of the form.")}</span></li>
                    </ul>
                    <div className="sp-pages">
                      {agreePages.map(([repo, tech]) => {
                        const label = repo.endsWith("speaker-diarization-3.1") ? t("Speaker model") : repo.endsWith("segmentation-3.0") ? t("Voice-change helper") : tech;
                        const ok = !!access?.valid && !!access.repos[repo];
                        return (
                          <div key={repo} className="sp-page">
                            <code>{label}</code>
                            {ok ? <span className="chip ok">{t("✓ Accepted")}</span> : access?.valid ? <span className="chip wait">{t("Form not sent yet")}</span> : <span className="chip">{t("Not checked yet")}</span>}
                            {!ok && <button type="button" className="btn ext" onClick={() => window.api.openExternal(`${HF}${repo}`)}>{t("Open form")}</button>}
                          </div>
                        );
                      })}
                    </div>
                    {saved && access?.valid && access.kind === "fineGrained" && <p className="warn-line" role="alert">{t("This code is the wrong kind. Make a new one on the “Read” tab instead.")}</p>}
                    <div className="sp-live" role="status">
                      {checking ? <><span className="pulse" aria-hidden />{t("Checking your account…")}</>
                        : access?.valid ? <><span className="pulse" aria-hidden />{formsLeft === 1 ? t("1 form left.") : t("{n} forms left.", { n: formsLeft })} {t("The app checks again when you come back to it.")}</>
                        : t("Couldn't go online to check the forms.")}
                      {!checking && <button type="button" className="linkish" onClick={() => void checkAccess()}>{t("Check now")}</button>}
                      {!checking && !access && <button type="button" className="linkish" onClick={() => setSkipCheck(true)}>{t("Download anyway")}</button>}
                    </div>
                    <p className="sp-fine">{t("Your recordings are never shared. Rather not share your details? Skip speaker detection; transcripts still work.")}</p>
                  </Step>
                  <Step n={4} at={now} title={t("Download the speaker detection model")} upcoming={t("About {size}", { size: diarSize })}>
                    {!dlDiar ? (
                      <>
                        <p>{t("About {size}, once. After that it works offline.", { size: diarSize })}</p>
                        <div className="sp-acts"><button type="button" className="btn sun" disabled={!!busy} onClick={() => run("download", "diarization")}>{t("Download model ({size})", { size: diarSize })}</button></div>
                      </>
                    ) : (
                      <>
                        <Progress label={t("Speaker model download progress")} fraction={dl?.fraction ?? null} />
                        <p className="sp-live"><span>{pct != null ? t("{pct}% of about {size}. Keep the app open.", { pct, size: diarSize }) : t("Starting… Keep the app open.")}</span>
                          <button type="button" className="linkish" onClick={cancel}>{t("Cancel")}</button></p>
                      </>
                    )}
                  </Step>
                </ol>
                <details className="detail"><summary>{t("Details for IT")}</summary>
                  <p>{t("Speaker detection (diarization) uses two gated models published on Hugging Face by pyannote. You need a free Hugging Face account and must accept each model’s terms on its page.")}</p>
                  <ul>{agreePages.map(([repo]) => <li key={repo}><code>{repo}</code></li>)}</ul>
                  <p>{t("The access code is a Hugging Face user access token with the Read role (a “Fine-grained” token does not work). It starts with hf_ and is shown only once. Suggested name: “{name}”.", { name: TOKEN_NAME })}</p>
                  <p>{t("Accepting the terms shares your Hugging Face email and username with pyannote. The app checks the token with huggingface.co (it also learns your username, to show your profile address) and downloads the pinned model files once. Recordings are never sent.")}</p>
                  <p>pyannote speaker-diarization 3.1 and segmentation 3.0 · MIT licence. {t("The token is kept in your computer’s secure storage and used only for this download.")}</p>
                </details>
    </>
  );
}
