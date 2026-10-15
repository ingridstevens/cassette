import { useEffect, useRef, useState } from "react";
import "../styles/shell.css";
import { useT } from "../i18n";
import { ModelStatus, Options, bytes } from "../types";
import { ModelErrorCard } from "./ErrorCard";
import { modelName } from "./modelInfo";
import { HF_TOKEN_PAGE, MODEL_BYTES, Models, modelSize } from "./useModels";

const HF = "https://huggingface.co/";

function Progress({ label, fraction }: { label: string; fraction: number | null }) {
  const pct = fraction == null ? undefined : Math.round(fraction * 100);
  return (
    <div className="prog" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i className={fraction == null ? "indet" : ""} style={fraction == null ? undefined : { width: `${pct}%` }} />
    </div>
  );
}

/** The name we suggest for the Hugging Face token, so nobody has to invent one. Shown and copied as is in every language. */
const TOKEN_NAME = "Local Transcriber";

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

interface Props {
  opts: Options; set(o: Options): void; status: ModelStatus | null; models: Models;
  /** True when a project exists (or the user moved on): show only a slim banner. */
  compact?: boolean; onContinue?(): void; onOpenSettings?(): void;
}

export default function Setup({ opts, set, status, models, compact = false, onContinue, onOpenSettings }: Props) {
  const t = useT();
  const { busy, errInfo, tokenSet, tokenHint, dl, access, checking, checkAccess, importFolder, run, saveToken, cancel } = models;
  const [token, setToken] = useState("");
  // Someone with a saved token is part-way through: open the steps straight away.
  const [open, setOpen] = useState(models.tokenSet);
  const [hasAccount, setHasAccount] = useState(false);
  const [skipCheck, setSkipCheck] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [info, setInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedProfile, setCopiedProfile] = useState(false);
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
  const dialog = useRef<HTMLDivElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const asDialog = compact && expanded;
  useEffect(() => {
    if (!asDialog) return;
    dialog.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [asDialog]);
  if (!status) return null;

  const modelDone = !!status.whisper[opts.model];
  const diarDone = status.diarization;
  const allDone = modelDone && (diarDone || opts.noDiarize);
  if (allDone) return null;

  const dlModel = busy === `download ${opts.model}`;
  const dlDiar = busy === "download diarization";
  const size = modelSize(opts.model);
  const pct = dl?.fraction != null ? Math.round(dl.fraction * 100) : null;

  if (compact && !expanded) {
    return (
      <div className={"setup-slim" + (modelDone ? " info" : "")} role="status">
        <span className="mark" aria-hidden>{modelDone ? "i" : "!"}</span>
        <span><b>{t("Finish setup to transcribe.")}</b> {!modelDone ? t("The transcription model isn't downloaded yet.") : t("Speaker detection isn't set up yet (optional).")}</span>
        <span className="grow" />
        {modelDone && <button type="button" className="btn small quiet" onClick={() => set({ ...opts, noDiarize: true })}>{t("Transcribe without speakers")}</button>}
        <button type="button" ref={reopen} className="btn small" onClick={() => setExpanded(true)}>{t("Continue setup")}</button>
      </div>
    );
  }

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
  const infoPanel = (
    <div className="info-panel" id="spk-info">
      <b>{t("What is speaker detection?")}</b>
      <p>{t("It is also called diarization. The app listens for changes in voice and splits the transcript into turns, one per speaker. It doesn't know who anyone is: speakers are numbered, and you can rename them afterwards, for example to “Anna”.")}</p>
      <p>{t("It works best with clear voices and can struggle when people talk over each other. For a single voice, like a voice memo or a lecture, you don't need it.")}</p>
    </div>
  );
  const cont = () => { set({ ...opts, noDiarize: true }); onContinue?.(); };

  const steps = (
    <>
      {errInfo && busy === "" && <ModelErrorCard models={models} onOpenSettings={onOpenSettings} />}

      <div className="card setup-card">
        <div className="step">
          <div className={"num" + (modelDone ? " ok" : " on")} aria-hidden="true">{modelDone ? "✓" : "1"}</div>
          <div className="grow">
            <h3>{modelDone ? t("Transcription model downloaded") : t("Download the transcription model")}</h3>
            <p className="sub">{t("The part that listens and writes the words down: “{model}”, about {size}. A good balance of speed and accuracy. You can pick another size in Settings.", { model: modelName(opts.model), size: size.replace("≈ ", "") })}</p>
            {!modelDone && !dlModel && (
              <div className="actions"><button type="button" className="btn sun" disabled={!!busy} onClick={() => run("download", opts.model)}>{t("Download now")}</button></div>
            )}
            {dlModel && (
              <>
                <Progress label={t("Model download progress")} fraction={dl?.fraction ?? null} />
                <p className="sub small-row">
                  <span>{pct != null ? t("{pct}% of about {size}. Keep the app open.", { pct, size: size.replace("≈ ", "") }) : t("Starting… Keep the app open.")}</span>
                  <button type="button" className="btn quiet small" onClick={cancel}>{t("Cancel download")}</button>
                </p>
              </>
            )}
            <details className="detail"><summary>{t("Technical details")}</summary>Whisper “{opts.model}” by OpenAI, run with faster-whisper · MIT licence{status.dir ? <> · {t("saved to")} <code>{status.dir}</code></> : null}</details>
          </div>
        </div>

        <div className="step">
          <div className={"num" + (diarDone ? " ok" : "")} aria-hidden="true">{diarDone ? "✓" : "2"}</div>
          <div className="grow">
            {!open ? (
              <>
                <h3>{t("Tell speakers apart")} <span className="opt">{t("(optional)")}</span>
                  <button type="button" className="info-btn" aria-expanded={info} aria-controls="spk-info" aria-label={t("What is speaker detection?")} onClick={() => setInfo(!info)}>i</button></h3>
                <p className="sub">{t("For interviews, or any recording with more than one voice. Each line then says who is talking: Speaker 1, Speaker 2 and so on.")}</p>
                {info && infoPanel}
                <div className="choices">
                  <button type="button" className="choice-card" aria-expanded={false} onClick={() => setOpen(true)}>
                    <b>{t("Set up speaker detection")}</b>
                    <span>{t("Needs a free Hugging Face account. Only the speaker files are downloaded; your recordings are never sent there.")}</span>
                    <em>{t("About 3 minutes")}</em>
                  </button>
                  <button type="button" className="choice-card" onClick={cont}>
                    <b>{t("Continue without it")}</b>
                    <span>{t("You get one transcript that doesn’t say who is talking. Fine for a single voice. You can add it later under Settings, Storage and models.")}</span>
                    <em>{t("Ready now")}</em>
                  </button>
                </div>
                <details className="detail"><summary>{t("Someone else can do this for me")}</summary>
                  <p className="sub">{t("Ask a friend or your IT team to set up speaker detection once on their computer and copy the models folder to you (it is the folder this app shows under Settings, Storage and models). Then choose that folder here. Nothing goes online.")}</p>
                  <div className="actions"><button type="button" className="btn" disabled={!!busy} onClick={() => void importFolder()}>{t("Import a models folder…")}</button></div>
                </details>
              </>
            ) : (
              <>
                <h3>{t("Tell speakers apart")} <span className="opt">{t("(optional)")}</span>
                  <button type="button" className="info-btn" aria-expanded={info} aria-controls="spk-info" aria-label={t("What is speaker detection?")} onClick={() => setInfo(!info)}>i</button></h3>
                <p className="sub">{t("For interviews, or any recording with more than one voice. Each line then says who is talking: Speaker 1, Speaker 2 and so on.")}</p>
                {info && infoPanel}
                {now < 5 && (
                  <div className="sp-prog">
                    <div className="sp-bar" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} className={i < now ? "on" : i === now ? "now" : ""} />)}</div>
                    <span>{minsLeft > 0 ? t("{done} of 4 done · about {mins} min left", { done: now - 1, mins: minsLeft }) : t("{done} of 4 done", { done: now - 1 })}</span>
                  </div>
                )}
                <ol className="sp-steps">
                  <Step n={1} at={now} title={t("Create a free Hugging Face account")} summary={t("Done")}>
                    <p>{t("The speaker model is published on Hugging Face, and its makers require a free account there. Your recordings are never sent.")}</p>
                    <div className="sp-acts">
                      <button type="button" className="btn sun ext" onClick={() => window.api.openExternal(`${HF}join`)}>{t("Create account")}</button>
                      <button type="button" className="btn quiet" onClick={() => setHasAccount(true)}>{t("I already have one")}</button>
                    </div>
                  </Step>
                  <Step n={2} at={now} title={t("Make an access code and paste it here")}
                    summary={<>{t("Saved as {hint}", { hint: tokenHint || "hf_…" })} <button type="button" className="linkish" onClick={() => setReplacing(true)}>{t("Replace")}</button></>}>
                    <p>{t("This code (a “token”) lets the app download the model for you.")}</p>
                    <ol className="sp-how">
                      <li>{t("Open the token page. The Read tab is already chosen.")}</li>
                      <li>{t("Name it “{name}” and click Create token.", { name: TOKEN_NAME })}{" "}
                        <button type="button" className="linkish" onClick={copyName}>{copied ? t("Copied ✓") : t("Copy name")}</button></li>
                      <li>{t("Copy the code. It starts with hf_ and is shown only once.")}</li>
                    </ol>
                    <div className="sp-acts"><button type="button" className="btn ext" onClick={() => window.api.openExternal(HF_TOKEN_PAGE)}>{t("Open token page")}</button></div>
                    <form className="sp-tok" onSubmit={async (e) => { e.preventDefault(); if (!token.trim()) return; await saveToken(token); setToken(""); setReplacing(false); checked.current = true; }}>
                      <label htmlFor="hf-token" className="st-sr">{t("Access code")}</label>
                      <input id="hf-token" className="input" type="password" autoComplete="off" spellCheck={false} placeholder={t("Paste the code (hf_…)")} value={token} onChange={(e) => setToken(e.target.value)} />
                      <button type="submit" className="btn sun" disabled={!token.trim()}>{t("Save")}</button>
                      {replacing && saved && <button type="button" className="btn quiet" onClick={() => { setReplacing(false); setToken(""); }}>{t("Cancel")}</button>}
                    </form>
                    {saved && access && !access.valid && <p className="warn-line" role="alert">{t("Hugging Face didn’t accept this token. Check that you copied all of it (it starts with “hf_”), or make a new one.")}</p>}
                  </Step>
                  <Step n={3} at={now} title={t("Fill in a short form on two model pages")} summary={t("Both accepted")} upcoming={t("2 free forms, about 1 minute")}>
                    <p>{t("Free. The model’s makers ask for a few details first. Both pages have the same short form:")}</p>
                    <ul className="sp-facts">
                      <li><span className="k">{t("You fill in")}</span><span>{t("Company or university, and Website. Both are required.")}</span></li>
                      <li><span className="k">{t("No company?")}</span><span>{t("For company, write Freelance, Independent or Personal use. For website, use your Hugging Face profile:")}{" "}
                        <code>{profileUrl ?? "huggingface.co/your-username"}</code>
                        {profileUrl && <>{" "}<button type="button" className="linkish" onClick={copyProfile}>{copiedProfile ? t("Copied ✓") : t("Copy")}</button></>}</span></li>
                      <li><span className="k">{t("You share")}</span><span>{t("Your Hugging Face email and username go to the model’s makers (pyannote). They may email you about paid services.")}</span></li>
                      <li><span className="k">{t("Then")}</span><span>{t("Click “Agree and access repository” at the bottom of the form.")}</span></li>
                    </ul>
                    <div className="sp-pages">
                      {agreePages.map(([repo, label]) => {
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
                    {saved && access?.valid && access.kind === "fineGrained" && <p className="warn-line" role="alert">{t("This is a Fine-grained token. Make a new one on the “Read” tab instead.")}</p>}
                    <div className="sp-live" role="status">
                      {checking ? <><span className="pulse" aria-hidden />{t("Checking with Hugging Face…")}</>
                        : access?.valid ? <><span className="pulse" aria-hidden />{formsLeft === 1 ? t("1 form left.") : t("{n} forms left.", { n: formsLeft })} {t("The app checks again when you come back to it.")}</>
                        : t("Couldn't reach Hugging Face to check the forms.")}
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
                <div className="sp-foot">
                  <button type="button" className="btn quiet" onClick={() => setOpen(false)}>{t("Do this later")}</button>
                  <span>{t("You can finish this any time under Settings, Storage and models.")}</span>
                </div>
                <details className="detail"><summary>{t("Technical details")}</summary>pyannote speaker-diarization 3.1 and segmentation 3.0 · MIT licence. {t("The token is kept in your computer’s secure storage and used only for this download.")}</details>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // With a recording open, setup covers the main column as its own page, so the two screens don't stack in one column.
  if (asDialog) {
    return (
      <div className="setup-overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title" tabIndex={-1} ref={dialog}>
        <section className="setup-page">
          <div className="setup-overlay-head">
            <button type="button" className="btn quiet small" onClick={() => setExpanded(false)}>{t("← Back to recording")}</button>
            <h1 id="setup-title">{t("Finish setup")}</h1>
          </div>
          {steps}
        </section>
      </div>
    );
  }

  return (
    <section className="setup-page" aria-labelledby="setup-title">
      <div>
        <h1 id="setup-title">{t("Turn a recording into text")}</h1>
        <p className="lead">{t("First, one quick download (about {size}). After that it works without internet, and your recordings never leave this computer.", { size: size.replace("≈ ", "") })}</p>
      </div>
      {steps}
    </section>
  );
}
