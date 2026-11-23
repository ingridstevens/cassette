import { useCallback, useEffect, useRef, useState } from "react";
import { recordSpeed } from "./estimate";
import { History, emptyHistory, record, stepBack, stepForward } from "./history";
import { currentLang, t } from "./i18n";
import { SaveState, createSaveTracker } from "./saveTracker";
import { copyName, duplicateProject } from "./projectActions";
import { readRestorePoint, takeRestorePoint, writeRestorePoint } from "./restorePoint";
import { DraftLine, FitAsk, JobProgress, MEDIA_EXT, Options, Project, RestorePoint, Result, RunMeta, Segment, baseName, displayName, stripExt } from "./types";

type Range = [number, number] | null;
const persisted = (p: Project) => ({ id: p.id, path: p.path, name: p.name, addedAt: p.addedAt, openedAt: p.openedAt, editedAt: p.editedAt, result: p.result, names: p.names, opts: p.opts, meta: p.meta, trial: p.trial, previous: p.previous, lastExport: p.lastExport });

/** Replace the segments overlapping a re-transcribed range, keep the rest. */
/** `line` is set when one line is transcribed again in a chosen language: the new text keeps that line's speaker and gets the language. */
export interface LineRedo { language: string; speaker: string }
export function mergeRange(prev: Result, next: Result, [a, b]: [number, number], line?: LineRedo): Result {
  const keep = prev.segments.filter((s) => s.end <= a || s.start >= b);
  const fresh = line ? next.segments.map((s) => ({ ...s, speaker: line.speaker, lang: line.language, words: s.words.map((w) => ({ ...w, speaker: line.speaker })) })) : next.segments;
  const segments: Segment[] = [...keep, ...fresh].sort((x, y) => x.start - y.start);
  return { ...prev, segments, speakers: line ? prev.speakers : Array.from(new Set([...prev.speakers, ...next.speakers])) };
}

/** What a run that did not finish left behind: the lines it had written, kept in the data folder. Never saved in projects.json. */
export interface Interrupted { lines: DraftLine[]; savedAt: number; audioChanged: boolean }
/** How often the lines written so far are saved while a run goes on (a crash loses at most this much). */
export const PARTIAL_SAVE_MS = 5000;

export function useProjects(opts: Options, log: (level: string, msg: string) => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, JobProgress>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftLine[]>>({});
  const [interrupted, setInterrupted] = useState<Record<string, Interrupted>>({});
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");  // set once, when the saved project list had to be recovered
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });  // failed while the latest edit is not on disk; cleared by the next save that works
  const optsRef = useRef(opts); optsRef.current = opts;
  const logRef = useRef(log); logRef.current = log;
  const jobs = useRef(new Map<string, { pid: string; range: Range; line?: LineRedo; trial?: boolean }>());      // engine jobId -> project
  const pending = useRef(new Map<string, { range: Range; line?: LineRedo; trial?: boolean; acceptFit?: boolean }>());                            // project -> range for its next run
  const projectsRef = useRef(projects); projectsRef.current = projects;
  const written = useRef(new Map<string, DraftLine[]>());  // project -> lines of the full run in progress (the engine's partial events, in order)
  const saveTimer = useRef(new Map<string, number>());
  const held = useRef(new Map<string, { previous: RestorePoint | undefined }>());  // project -> the restore point it had before a re-run took its own (put back when the run is cancelled or fails)
  const history = useRef(new Map<string, History>());  // project -> undo and redo steps for transcript edits (kept while the app runs)

  const patch = useCallback((id: string, p: Partial<Project>) => setProjects((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x))), []);

  // load once
  useEffect(() => {
    window.api.loadProjects().then((raw) => {
      if (raw.recoveredFrom || raw.corruptCopy) {
        const time = raw.recoveredAt ? new Date(raw.recoveredAt).toLocaleString(currentLang()) : "";
        setNotice(raw.recoveredFrom && time
          ? t("Your project list was damaged. Cassette restored the copy from {time}. The damaged file is kept in the data folder.", { time })
          : raw.recoveredFrom ? t("Your project list was damaged. Cassette restored an earlier copy. The damaged file is kept in the data folder.")
          : t("Your project list was damaged and no earlier copy could be restored. The damaged file is kept in the data folder."));
      }
      const list = (raw.projects as Project[]).map((p) => ({ ...p, previous: readRestorePoint(p.previous), status: (p.result ? "done" : "idle") as Project["status"] }));
      setProjects(list); setActiveId(list[0]?.id ?? null); setLoaded(true);
      // Runs that did not finish (stopped, failed, or cut off by a crash or sleep): their saved lines come back as an "interrupted" state. Everything else in the folder is deleted.
      window.api.loadPartials(list.filter((p) => !p.result).map((p) => p.id)).then((found) => {
        const m: Record<string, Interrupted> = {};
        for (const [id, f] of Object.entries(found ?? {})) m[id] = { lines: f.lines, savedAt: f.savedAt, audioChanged: f.audioChanged };
        if (Object.keys(m).length) setInterrupted(m);
      }).catch(() => {});
      // Recordings a crash cut short: they are now WAV files, so add them as projects (the saved list is already loaded, so nothing is overwritten).
      window.api.liveRecover().then((rec) => {
        const fresh = (rec ?? []).filter((path) => !list.some((p) => p.path === path));
        if (!fresh.length) return;
        const projs: Project[] = fresh.map((path) => ({ id: crypto.randomUUID(), path, name: stripExt(baseName(path)), addedAt: Date.now(), result: null, names: {}, status: "idle" }));
        setProjects((l) => [...projs, ...l]); setActiveId(projs[0].id);
        const msg = t("Recovered {count} recording(s) that were interrupted.", { count: projs.length });
        setNotice((n) => (n ? `${n} ${msg}` : msg));
      }).catch(() => {});
    }).catch(() => setLoaded(true));
  }, []);
  // One tracker for every save of the project list: the debounced save, the Retry button and the close-time flush all go through it (see saveTracker.ts).
  const tracker = useRef<ReturnType<typeof createSaveTracker<Project[]>>>(null as never);
  tracker.current ??= createSaveTracker<Project[]>(
    (list) => window.api.saveProjects(list.map(persisted)).then((r) => { if (!r.ok) logRef.current("error", `Couldn't save the project list: ${r.error}`); return r; }),
    (list) => window.api.saveProjectsSync(list.map(persisted)),
    setSaveState);
  // debounced save (only after the first load, so we never overwrite saved projects with an empty list)
  useEffect(() => {
    if (!loaded) return;
    tracker.current.submit(projects);
    const timer = setTimeout(() => { void tracker.current.drain(); }, 400);
    return () => clearTimeout(timer);
  }, [projects, loaded]);
  const retrySave = useCallback(() => { void tracker.current.retry(); }, []);

  /** Keeps the project as it is now as its restore point and waits until that is on disk. False (with a notice) when it could not be written: the caller must then not start the operation. */
  const checkpoint = useCallback(async (id: string, label: string): Promise<boolean> => {
    const cur = projectsRef.current.find((x) => x.id === id);
    const point = cur?.result ? takeRestorePoint(cur, label, Date.now()) : null;
    if (!point) return true;
    const r = await writeRestorePoint(tracker.current, projectsRef.current, id, point);
    // keep only the one project's field from the result, so an edit made while the write ran is not lost
    setProjects((l) => l.map((x) => (x.id === id ? { ...x, previous: r.ok ? point : cur!.previous } : x)));
    if (!r.ok) setNotice(t("Cassette could not save a restore point first, so nothing was changed: {error}. Free some disk space and try again.", { error: r.error ?? "unknown" }));
    return r.ok;
  }, []);

  // flush on close or quit: the debounced save above would not get to run, so a quick edit followed by Cmd+Q was lost
  const loadedRef = useRef(false); loadedRef.current = loaded;

  /** Writes the lines of the run in progress to the data folder. Only for a full run of a project with no finished transcript, so a transcript is never touched. */
  const savePartialNow = useCallback((id: string, sync = false) => {
    const t0 = saveTimer.current.get(id); if (t0 !== undefined) { clearTimeout(t0); saveTimer.current.delete(id); }
    const lines = written.current.get(id); const p = projectsRef.current.find((x) => x.id === id);
    if (!lines?.length || !p || p.result) return;
    const eff = { ...optsRef.current, ...p.opts };
    const d = { lines, audio: p.path, model: String(eff.model ?? ""), language: String(eff.language ?? "") };
    if (sync) { window.api.savePartialSync(id, d); return; }
    window.api.savePartial(id, d).catch(() => {});
  }, []);
  const schedulePartial = useCallback((id: string) => {
    if (saveTimer.current.has(id)) return;
    saveTimer.current.set(id, window.setTimeout(() => savePartialNow(id), PARTIAL_SAVE_MS));
  }, [savePartialNow]);
  /** The run ended without a transcript (stopped or failed): keep its lines and show them as interrupted. */
  const keepInterrupted = useCallback((id: string) => {
    const lines = written.current.get(id);
    if (lines?.length && projectsRef.current.some((p) => p.id === id)) { savePartialNow(id); setInterrupted((m) => ({ ...m, [id]: { lines, savedAt: Date.now(), audioChanged: false } })); }
    written.current.delete(id);
  }, [savePartialNow]);
  /** The run finished, or the saved lines are no longer wanted: delete them everywhere. */
  const dropInterrupted = useCallback((id: string) => {
    const t0 = saveTimer.current.get(id); if (t0 !== undefined) { clearTimeout(t0); saveTimer.current.delete(id); }
    written.current.delete(id);
    setInterrupted((m) => { if (!(id in m)) return m; const { [id]: _, ...rest } = m; return rest; });
    window.api.dropPartial(id).catch(() => {});
  }, []);

  useEffect(() => {
    const flush = (e: BeforeUnloadEvent) => {
      if (!loadedRef.current) return;
      const saved = tracker.current.flushSync();
      for (const id of [...written.current.keys()]) savePartialNow(id, true);  // quitting or reloading: keep what a run had written so far
      // The edit did not reach the disk: cancel the close so the window stays open and the user can press Retry save. (Electron keeps the window open when beforeunload is cancelled.)
      if (!saved) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [savePartialNow]);

  const add = useCallback((paths: string[]): string => {
    const bad = paths.filter((p) => !MEDIA_EXT.test(p));
    const good = paths.filter((p) => MEDIA_EXT.test(p));
    const existing = projectsRef.current;
    const fresh: Project[] = [];
    let focus: string | null = null;
    for (const path of good) {
      const dupe = existing.find((p) => p.path === path) ?? fresh.find((p) => p.path === path);
      if (dupe) { focus ??= dupe.id; continue; }
      const id = crypto.randomUUID();
      fresh.push({ id, path, name: stripExt(baseName(path)), addedAt: Date.now(), result: null, names: {}, status: "idle" });
      focus ??= id;
    }
    if (fresh.length) setProjects((l) => [...fresh, ...l]);
    if (focus) setActiveId(focus);
    if (!bad.length) return "";
    const name = baseName(bad[0]);
    return bad.length > 1
      ? t("“{name}” and {count} more aren't audio or video. Supported: mp3, wav, m4a, flac, ogg, opus, aac, mp4, mov, mkv, webm.", { name, count: bad.length - 1 })
      : t("“{name}” isn't audio or video. Supported: mp3, wav, m4a, flac, ogg, opus, aac, mp4, mov, mkv, webm.", { name });
  }, []);

  /** Add recordings and start transcribing each one as soon as it is in the list (the Record page uses this after saving). */
  const autoStart = useRef(new Set<string>());
  const addAndTranscribe = useCallback((paths: string[]) => { paths.forEach((p) => autoStart.current.add(p)); return add(paths); }, [add]);
  useEffect(() => {
    for (const p of projects) if (autoStart.current.has(p.path) && p.status === "idle" && !p.result) { autoStart.current.delete(p.path); void transcribe(p.id); }
  });

  const jobOf = (pid: string) => [...jobs.current.entries()].find(([, v]) => v.pid === pid)?.[0];

  const remove = useCallback((id: string) => {
    const j = jobOf(id); if (j) window.api.cancel(j);
    pending.current.delete(id); held.current.delete(id); history.current.delete(id); dropInterrupted(id);
    setProjects((l) => { const next = l.filter((p) => p.id !== id); setActiveId((a) => (a === id ? next[0]?.id ?? null : a)); return next; });
  }, [dropInterrupted]);

  /** Copies a project's app data (not the recording) right after the original; returns the copy's name, or null if the original is gone. */
  const duplicate = useCallback((id: string): string | null => {
    const src = projectsRef.current.find((p) => p.id === id); if (!src) return null;
    const name = copyName(src.name, projectsRef.current.map((p) => p.name), t("copy"));
    const copy = duplicateProject(src, crypto.randomUUID(), name, Date.now());
    setProjects((l) => { const i = l.findIndex((p) => p.id === id); return i < 0 ? l : [...l.slice(0, i + 1), copy, ...l.slice(i + 1)]; });
    return name;
  }, []);

  /** Put back the restore point a re-run took when the run ends without replacing anything (cancelled, failed, or stopped to ask about the model). */
  const releaseCheckpoint = useCallback((id: string) => {
    const h = held.current.get(id); if (!h) return;
    held.current.delete(id);
    patch(id, { previous: h.previous });
  }, [patch]);

  /** Queue a run. When the project already has a transcript, a restore point is saved first; if that fails nothing is queued and false is returned. */
  const transcribe = useCallback(async (id: string, range: Range = null, line?: LineRedo, trial?: boolean, acceptFit?: boolean): Promise<boolean> => {
    const had = projectsRef.current.find((p) => p.id === id);
    if (had?.result) {
      const prior = had.previous;
      const label = line ? t("redo a line") : range ? t("redo part of the transcript") : t("transcribe again");
      if (!(await checkpoint(id, label))) return false;
      held.current.set(id, { previous: prior });
    }
    pending.current.set(id, { range, line, trial, acceptFit });
    patch(id, { status: "queued", error: undefined, fitAsk: undefined, partial: !!range && !!had?.result });
    return true;
  }, [patch, checkpoint]);

  const cancel = useCallback((id: string) => {
    const j = jobOf(id);
    if (j) window.api.cancel(j);
    else { releaseCheckpoint(id); patch(id, { status: projectsRef.current.find((p) => p.id === id)?.result ? "done" : "idle", partial: undefined }); }
  }, [patch, releaseCheckpoint]);

  // queue: one engine job at a time
  useEffect(() => {
    if (projects.some((p) => p.status === "running")) return;
    const next = projects.find((p) => p.status === "queued");
    if (!next) return;
    patch(next.id, { status: "running" });
    const { range: rg = null, line, acceptFit } = pending.current.get(next.id) ?? {};
    const forced = line ? { language: line.language, noDiarize: true, multilingual: false } : {};
    const translate = (next.opts?.translate ?? optsRef.current.translate) ?? false;
    window.api.transcribe({ input: next.path, ...optsRef.current, ...next.opts, translate, ...forced, acceptFit, start: rg?.[0], end: rg?.[1], clientId: next.id })
      .catch((e: unknown) => { releaseCheckpoint(next.id); patch(next.id, { status: "error", error: String(e) }); });
  }, [projects, patch, releaseCheckpoint]);

  // engine events -> projects
  useEffect(() => window.api.onEvent((e) => {
    if (e.type === "started" && e.clientId) { jobs.current.set(e.jobId, { pid: e.clientId, range: pending.current.get(e.clientId)?.range ?? null, line: pending.current.get(e.clientId)?.line, trial: pending.current.get(e.clientId)?.trial }); return; }
    const job = jobs.current.get(e.jobId);
    if (!job) return;
    const { pid, range, line, trial } = job;
    const hadResult = () => !!projectsRef.current.find((p) => p.id === pid)?.result;
    const dropDraft = () => setDrafts((m) => { const { [pid]: _, ...rest } = m; return rest; });
    if (e.type === "partial") { if (!range && !hadResult()) { written.current.set(pid, [...(written.current.get(pid) ?? []), ...(e.segments as DraftLine[])]); schedulePartial(pid); } if (!range) setDrafts((m) => ({ ...m, [pid]: [...(m[pid] ?? []), ...(e.segments as DraftLine[])] })); }  // a redo of one part keeps the transcript on screen instead
    else if (e.type === "progress") setProgress((m) => ({ ...m, [pid]: { stage: e.stage, fraction: e.fraction, message: e.message } }));
    else if (e.type === "fit") {  // the engine stopped before the slow work: ask whether to use a better model
      jobs.current.delete(e.jobId);
      dropDraft();
      written.current.delete(pid);  // the engine stopped to ask, before writing anything; lines kept from an earlier run stay
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const had = projectsRef.current.find((p) => p.id === pid)?.result;
      const { type: _t, jobId: _j, ...ask } = e;
      releaseCheckpoint(pid);
      patch(pid, { status: had ? "done" : "idle", partial: undefined, fitAsk: ask as FitAsk });
    } else if (e.type === "error") {
      jobs.current.delete(e.jobId);
      dropDraft();
      if (!range) keepInterrupted(pid);
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const had = projectsRef.current.find((p) => p.id === pid)?.result;
      releaseCheckpoint(pid);  // the last finished transcript stays as it was, with the restore point it had before
      patch(pid, e.cancelled ? { status: had ? "done" : "idle", partial: undefined } : { status: "error", error: String(e.message), partial: undefined });
    } else if (e.type === "done") {
      jobs.current.delete(e.jobId);
      dropDraft();
      if (!range) dropInterrupted(pid);  // finished: the saved lines are no longer needed
      held.current.delete(pid);  // the restore point stays: it is what the run replaced
      history.current.delete(pid);  // the engine's transcript replaces the one the steps belong to
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const r: Result = { language: e.language, duration: e.duration, speakers: e.speakers, segments: e.segments };
      const meta: RunMeta = { ...(e.meta ?? {}), finishedAt: Date.now() };
      // a clean full run teaches the estimates how fast this computer is (runs with translation or per-speaker languages are slower for other reasons)
      if (!range && !trial && !meta.mixed && !meta.translated && meta.model) recordSpeed(meta.model, meta.device === "mps" ? "mlx" : "faster", r.duration, meta.secondsTranscribe, meta.secondsSpeakers, meta.speakerDevice === "mps" || meta.speakerDevice === "cuda");
      setProjects((l) => l.map((p) => {
        if (p.id !== pid) return p;
        const result = range && p.result ? mergeRange(p.result, r, range, line) : r;
        // a full re-run replaces the transcript: the old one was kept as the restore point (and written to disk) before the run started; the new one starts without speaker names
        const replaced = !range && !!p.result;
        const keptNames = replaced ? {} : p.names;
        if (optsRef.current.autosave) {
          const names = Object.fromEntries(result.speakers.map((sp) => [sp, displayName(sp, result.speakers, keptNames)]));
          window.api.saveSidecar(p.path, { source: baseName(p.path), language: result.language, duration: result.duration, speakers: names, segments: result.segments.map(({ words, orig, edited, ...s }) => s) })
            .then((r2) => logRef.current(r2.ok ? "info" : "error", r2.ok ? `Saved transcript next to the audio: ${r2.path}` : `Couldn't save next to the audio: ${r2.error}`));
        }
        return { ...p, result, names: keptNames, meta: range && p.meta ? { ...p.meta, ...meta } : meta, status: "done", error: undefined, partial: undefined, trial: trial ? true : range ? p.trial : undefined };
      }));
    }
  }), [patch, schedulePartial, keepInterrupted, dropInterrupted, releaseCheckpoint]);

  const open = useCallback((id: string | null) => { setActiveId(id); if (id) patch(id, { openedAt: Date.now() }); }, [patch]);
  /** Every user edit goes through here. An edit of the transcript or the speaker names can be undone; `label` says what it was, `merge` folds quick repeats (typing a name) into one step. */
  const edit = useCallback((id: string, p: Partial<Project>, label?: string, merge?: boolean) => {
    const cur = projectsRef.current.find((x) => x.id === id);
    if (cur?.result && ("result" in p || "names" in p)) history.current.set(id, record(history.current.get(id) ?? emptyHistory(), { result: cur.result, names: cur.names }, label, Date.now(), merge));
    patch(id, { ...p, editedAt: Date.now() });
  }, [patch]);
  /** An edit that touches many lines: a restore point is written first, and the edit is made only once it is saved (and only if the transcript is still the one the edit was worked out from). */
  const editWithCheckpoint = useCallback(async (id: string, p: Partial<Project>, label: string): Promise<boolean> => {
    const cur = projectsRef.current.find((x) => x.id === id);
    if (!cur?.result) { edit(id, p, label); return true; }
    if (!(await checkpoint(id, label))) return false;
    const now = projectsRef.current.find((x) => x.id === id);
    if (!now || now.result !== cur.result || now.names !== cur.names) { setNotice(t("The transcript changed while the restore point was being saved, so nothing was changed. Try again.")); return false; }
    edit(id, p, label);
    return true;
  }, [edit, checkpoint]);
  const step = useCallback((id: string, f: typeof stepBack): string | null => {
    const cur = projectsRef.current.find((x) => x.id === id);
    const h = history.current.get(id);
    if (!cur?.result || !h) return null;
    const r = f(h, { result: cur.result, names: cur.names });
    if (!r) return null;
    history.current.set(id, r.h);
    patch(id, { result: r.snap.result, names: r.snap.names, editedAt: Date.now() });
    return r.snap.label ?? "";
  }, [patch]);
  /** Each returns the label of the edit it undid or redid (empty when it had none), or null when there was nothing to do. */
  const undo = useCallback((id: string) => step(id, stepBack), [step]);
  const redo = useCallback((id: string) => step(id, stepForward), [step]);
  return { projects, loaded, notice, saveError: saveState.status === "failed" ? saveState.error ?? "unknown" : null, retrySave, dismissNotice: () => setNotice(""), activeId, setActiveId: open, edit, undo, redo, progress, drafts, interrupted, discardInterrupted: dropInterrupted, add, addAndTranscribe, remove, rename: (id: string, name: string) => edit(id, { name }), duplicate, patch, transcribe, cancel, editWithCheckpoint,
    transcribeAll: () => projectsRef.current.filter((p) => p.status === "idle" || p.status === "error").forEach((p) => void transcribe(p.id)) };
}
