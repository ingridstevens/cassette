import { DragEvent, useCallback, useEffect, useRef, useState } from "react";
import Activity, { Live, LogLine } from "./components/Activity";
import ProjectSidebar from "./components/ProjectSidebar";
import ProjectView from "./components/ProjectView";
import RecordPage from "./components/RecordPage";
import SettingsPage from "./components/SettingsPage";
import RemoveDialog from "./components/RemoveDialog";
import ImportReport from "./components/ImportReport";
import RetentionDialog from "./components/RetentionDialog";
import { dueForRetention } from "./retention";
import Setup from "./components/Setup";
import { useModels } from "./components/useModels";
import "./styles/shell.css";
import { setLanguage, t, useT } from "./i18n";
import { setLlm } from "./components/llmChoice";
import { IS_MAC, ModelStatus, Options, applyLook, displayName } from "./types";
import { useProjects } from "./useProjects";

const DEFAULTS: Options = { model: "small", language: "auto", numSpeakers: "", vad: false, prompt: "", noDiarize: false, device: "auto", autosave: true };
const loadOpts = (): Options => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("opts") || "{}") }; } catch { return DEFAULTS; } };
function stageLabel(stage: string): string {
  if (stage === "decode") return t("Decoding audio");
  if (stage === "diarize") return t("Finding speakers");
  if (stage === "transcribe") return t("Transcribing");
  if (stage === "merge") return t("Assigning speakers");
  if (stage === "highlights") return t("Finding highlights");
  if (stage === "summarize") return t("Writing the summary");
  if (stage === "clips") return t("Cutting audio clips");
  return stage;
}

export default function App() {
  const t = useT();
  const [opts, setOpts] = useState<Options>(loadOpts);
  // First launch on a computer with little memory: start with the Base size instead of Small (the user can change it in Settings).
  const firstRun = useRef((() => { try { return localStorage.getItem("opts") === null; } catch { return false; } })());
  useEffect(() => {
    if (!firstRun.current) return;
    firstRun.current = false;
    window.api.paths().then((p) => { if (p?.system?.memGB && p.system.memGB < 6) setOpts((o) => ({ ...o, model: "base" })); }).catch(() => {});
  }, []);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [dragging, setDragging] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [stopSignal, setStopSignal] = useState(0);
  const [page, setPage] = useState<"main" | "settings" | "record">("main");
  const [dismissed, setDismissed] = useState(false);
  const [addError, setAddError] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [live, setLive] = useState<Live | null>(null);
  const addLog = useCallback((level: string, message: string) => setLines((l) => [...l.slice(-499), { t: Date.now(), level, message }]), []);

  const refresh = useCallback(() => { window.api.models("status").then((r) => r && setStatus(r as unknown as ModelStatus)); }, []);
  useEffect(refresh, [refresh]);
  // Models can also be downloaded from a project (the Highlights tab keeps its own status), so Settings re-reads what is on disk.
  useEffect(() => { if (page === "settings") refresh(); }, [page, refresh]);
  const models = useModels(refresh);
  const P = useProjects(opts, addLog);
  useEffect(() => { try { localStorage.setItem("opts", JSON.stringify(opts)); } catch { /* storage unavailable */ } applyLook(opts); setLanguage(opts.appLanguage); }, [opts]);
  // "Match my computer": follow the system when it switches between light and dark.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq || (opts.colorScheme && opts.colorScheme !== "system")) return;
    const follow = () => applyLook(opts);
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, [opts]);

  // Activity feed: log lines + live status of any engine job (including model downloads)
  useEffect(() => window.api.onEvent((e) => {
    const label = e.source === "models" ? t("Downloading model") : stageLabel(e.stage);
    if (e.type === "log") addLog(e.level === "stderr" ? "stderr" : e.level === "error" ? "error" : "info", e.message);
    else if (e.type === "progress") setLive((p) => ({ label, fraction: e.fraction, message: e.message, since: p && p.label === label ? p.since : Date.now() }));
    else if (e.type === "error") { setLive(null); addLog("error", e.cancelled ? "Cancelled" : e.message); }
    else if ((e.type === "done" || e.type === "fit") && e.jobId !== undefined) setLive(null);
    else if (e.type === "started") addLog("info", "Started transcription");
  }), [addLog]);

  // Speaker names just became available (here or in Settings): stop skipping them.
  const prevDiar = useRef<boolean | null>(null);
  useEffect(() => {
    if (!status) return;
    if (prevDiar.current === false && status.diarization) setOpts((o) => (o.noDiarize ? { ...o, noDiarize: false } : o));
    prevDiar.current = status.diarization;
  }, [status]);

  // Cmd/Ctrl + , opens Settings
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "," && (IS_MAC ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey) { e.preventDefault(); setPage("settings"); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const addFiles = useCallback((paths: string[]) => { if (paths.length) { setAddError(P.add(paths)); setPage("main"); } }, [P]);
  const pick = async () => addFiles(await window.api.pickFiles());
  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files).map((f) => window.api.pathForFile(f)).filter(Boolean));
  }

  const needsDiar = !opts.noDiarize && status && !status.diarization;
  const needsModel = status && !status.whisper[opts.model];
  const blocker = needsModel ? t("Finish setup to transcribe.") : needsDiar ? t("Finish setup, or skip speaker detection.") : "";
  const setupDone = !!status && !blocker;
  const queue = P.projects.filter((p) => p.status === "queued");
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);
  const openSettings = (section?: string) => { setSettingsSection(section); setPage("settings"); };
  const noProjects = P.projects.length === 0;
  const [removing, setRemoving] = useState<string | null>(null);
  const removingProject = P.projects.find((p) => p.id === removing);
  // Old projects: ask once per session, after the saved projects have loaded, and never delete without a yes.
  const [retention, setRetention] = useState<string[] | null>(null);
  const askedRetention = useRef(false);
  useEffect(() => {
    if (askedRetention.current || P.projects.length === 0) return;
    askedRetention.current = true;
    const due = dueForRetention(P.projects, opts.retentionDays);
    if (due.length) setRetention(due.map((p) => p.id));
  }, [P.projects.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const retentionProjects = retention ? P.projects.filter((p) => retention.includes(p.id)) : [];

  // First thing a keyboard or screen-reader user can tab to: skip the sidebar and the toolbar, and land on the first line of the transcript.
  const skipToTranscript = (e: React.MouseEvent) => {
    e.preventDefault();
    const first = document.querySelector<HTMLElement>(".pview:not([hidden]) [data-turn] .pv-time");
    first?.focus(); first?.scrollIntoView({ block: "center" });
  };

  return (
    <>
      {page === "main" && <a href="#transcript" className="skip-link" onClick={skipToTranscript}>{t("Skip to the transcript")}</a>}
      <div className={"shell" + (dragging ? " dragging" : "")} hidden={page === "settings"} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={onDrop}>
        <ProjectSidebar projects={P.projects} activeId={P.activeId} progress={P.progress} blocker={blocker}
          onSelect={(id) => { P.setActiveId(id); setPage("main"); }} onAdd={pick} onRecord={() => setPage("record")} onRemove={(id) => setRemoving(id)} onRename={P.rename} onTranscribeAll={P.transcribeAll} doneCount={P.projects.filter((p) => p.result).length} onExportAll={() => window.api.exportTranscript({ projects: P.projects.filter((p) => p.result).map((p) => ({ name: p.name, segments: p.result!.segments.map(({ words: _w, orig: _o, ...s }) => s), speakers: Object.fromEntries(p.result!.speakers.map((s) => [s, displayName(s, p.result!.speakers, p.names)])) })) }, "combined-csv", "all-projects")} onOpenSettings={() => openSettings()} playingId={playingId}
          activity={<Activity lines={lines} live={live} setupNeeded={!!blocker} onClear={() => setLines([])} />} />
        <section className="main">
          <div className="main-body">
            {page === "record" && <RecordPage opts={opts} blocker={blocker} onBack={() => setPage("main")} onSaved={(r) => { setAddError(P.addAndTranscribe([r.path])); setPage("main"); }} />}
            {page !== "record" && <Setup opts={opts} set={setOpts} status={status} models={models} compact={!noProjects || dismissed} onContinue={() => setDismissed(true)} onOpenSettings={() => openSettings("Transcription")} />}

            {page !== "record" && noProjects && setupDone && (
              <div className="empty-wrap">
                <div className={"dropzone card" + (dragging ? " over" : "")}>
                  <div className="orb"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5V14H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3.5L15 18h-3" /></svg></div>
                  <h2>{t("Drop recordings here")}</h2>
                  <p className="lead">{t("Interviews, meetings, calls. The app writes down what everyone says and who said it. Best with German, English, French and Spanish; about 100 other languages work too. Nothing leaves this computer.")}</p>
                  <button type="button" className="btn sun big" onClick={pick}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{t("Choose files…")}</button>
                  <p className="note">{t("Works with mp3, wav, m4a, flac, mp4, mov and more. You can add several at once.")}</p>
                  {addError && <p className="alert err" role="alert">{addError}</p>}
                </div>
              </div>
            )}
            {page !== "record" && noProjects && !setupDone && dismissed && (
              <div className="empty-wrap">
                <div className="dropzone card">
                  <div className="orb"><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5V14H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3.5L15 18h-3" /></svg></div>
                  <h2>{t("Drop recordings here")}</h2>
                  <p className="lead">{t("You can add recordings now. Transcribing becomes available once the download is done.")}</p>
                  <button type="button" className="btn sun big" onClick={pick}>{t("Choose files…")}</button>
                  {addError && <p className="alert err" role="alert">{addError}</p>}
                </div>
              </div>
            )}
            {P.saveError && <p className="alert err main-err" role="alert">{t("Your changes could not be saved: {error}. Free some disk space, then keep working; Cassette tries again with every change.", { error: P.saveError })}</p>}
            {P.notice && <p className="alert err main-err" role="alert">{P.notice} <button type="button" className="link-btn" onClick={P.dismissNotice}>{t("Dismiss")}</button></p>}
            {addError && !noProjects && <p className="alert err main-err" role="alert">{addError}</p>}

            {P.projects.map((p) => (
              <ProjectView key={p.id} project={p} progress={P.progress[p.id]} draft={P.drafts[p.id]} blocker={blocker} visible={page === "main" && p.id === P.activeId}
                waiting={queue.findIndex((q) => q.id === p.id)}
                nowPlayingId={playingId} stopSignal={stopSignal} onOpenSettings={openSettings} models={models}
                onPlayingChange={(pl) => setPlayingId((cur) => (pl ? p.id : cur === p.id ? null : cur))}
                onTranscribe={(rg, line, trial, acceptFit) => P.transcribe(p.id, rg, line, trial, acceptFit)}
                othersWaiting={P.projects.filter((x) => x.id !== p.id && !x.result && x.status === "idle").length}
                onApplyToOthers={(o) => P.projects.filter((x) => x.id !== p.id && !x.result && x.status === "idle").forEach((x) => P.patch(x.id, { opts: { ...x.opts, ...o } }))}
                onRemember={(o) => setOpts({ ...opts, ...o })} onCancel={() => P.cancel(p.id)} onPatch={(patch) => P.patch(p.id, patch)} />
            ))}
          </div>
          {dragging && <div className="drop-veil" aria-hidden>{t("Drop to add recordings")}</div>}
        </section>
      </div>
      {retention && retentionProjects.length > 0 && opts.retentionDays && <RetentionDialog projects={retentionProjects} days={opts.retentionDays} onClose={() => setRetention(null)} onDelete={(ids) => { ids.forEach((id) => P.remove(id)); setRetention(null); }} />}
      {models.importReport && <ImportReport rows={models.importReport} onClose={models.closeImportReport} />}
      {removingProject && <RemoveDialog project={removingProject} onClose={() => setRemoving(null)} onDone={() => { P.remove(removingProject.id); setRemoving(null); }} />}
      {page === "settings" && <SettingsPage key={settingsSection ?? "default"} initialSection={settingsSection} opts={opts} set={setOpts} status={status} models={models} onBack={() => setPage("main")} onReset={() => { setOpts({ ...DEFAULTS }); setLlm(""); }} />}
      {playingId && (page === "settings" || P.activeId !== playingId) && (() => {
        const playing = P.projects.find((x) => x.id === playingId);
        return playing ? (
          <div className="nowplaying" role="region" aria-label={t("Now playing")}>
            <span className="eq" aria-hidden><i /><i /><i /></span>
            <button type="button" className="np-name" onClick={() => { P.setActiveId(playing.id); setPage("main"); }} title={t("Go to this recording")}>{t("Playing:")} <b>{playing.name}</b></button>
            <button type="button" className="btn small" onClick={() => setStopSignal((n) => n + 1)} aria-label={t("Pause {name}", { name: playing.name })}>{t("Pause")}</button>
          </div>
        ) : null;
      })()}
    </>
  );
}
