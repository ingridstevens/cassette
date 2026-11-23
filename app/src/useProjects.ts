import { useCallback, useEffect, useRef, useState } from "react";
import { recordSpeed } from "./estimate";
import { History, emptyHistory, record, stepBack, stepForward } from "./history";
import { currentLang, t } from "./i18n";
import { SaveState, createSaveTracker } from "./saveTracker";
import { copyName, duplicateProject } from "./projectActions";
import { restoredProject } from "./projectBackup";
import { Located, commitRelink, judgeLocated } from "./relink";
import { readRestorePoint, takeRestorePoint, writeRestorePoint } from "./restorePoint";
import { AddedRecording, hasParts, joinAdded, matchSpeakers, readParts, redoTarget, shiftResult, sourcesOf, timelineLength } from "./sources";
import { DraftLine, FitAsk, JobProgress, MEDIA_EXT, Options, Part, Project, RestorePoint, Result, RunMeta, Segment, baseName, bytes, displayName, stripExt } from "./types";

type Range = [number, number] | null;
const persisted = (p: Project) => ({ id: p.id, path: p.path, name: p.name, addedAt: p.addedAt, openedAt: p.openedAt, editedAt: p.editedAt, result: p.result, names: p.names, opts: p.opts, meta: p.meta, trial: p.trial, previous: p.previous, lastExport: p.lastExport, source: p.source, appended: p.appended });

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

/** The reason a backup or restore failed, in words (the code comes from electron/projectArchive.ts). */
function backupReason(code: string | undefined): string {
  switch (code) {
    case "missing-source": return t("The recording for this project is not available.");
    case "source-changed": return t("The recording changed while it was being copied. Try again.");
    case "unwritable": return t("That place cannot be written to. Choose another folder.");
    case "low-disk": return t("There is not enough free disk space.");
    case "not-backup": return t("That file is not a Cassette project backup.");
    case "damaged": return t("The backup is damaged or incomplete.");
    case "unsupported": return t("The backup was made by a newer version of Cassette. Update Cassette and try again.");
    case "unsafe-path": return t("The backup names a recording path that is not safe.");
    default: return t("Something went wrong.");
  }
}

export function useProjects(opts: Options, log: (level: string, msg: string) => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, JobProgress>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftLine[]>>({});
  const [interrupted, setInterrupted] = useState<Record<string, Interrupted>>({});
  const [loaded, setLoaded] = useState(false);
  const [info, setInfo] = useState("");  // the outcome of the last backup or restore that worked (a failure goes to `notice`)
  const [notice, setNotice] = useState("");  // set once, when the saved project list had to be recovered
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });  // failed while the latest edit is not on disk; cleared by the next save that works
  const optsRef = useRef(opts); optsRef.current = opts;
  const logRef = useRef(log); logRef.current = log;
  const jobs = useRef(new Map<string, { pid: string; range: Range; line?: LineRedo; trial?: boolean; add?: AddedRecording; offset?: number }>());      // engine jobId -> project
  const pending = useRef(new Map<string, { range: Range; line?: LineRedo; trial?: boolean; acceptFit?: boolean; add?: AddedRecording; offset?: number }>());                            // project -> range for its next run
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
      const list = (raw.projects as Project[]).map((p) => ({ ...p, appended: readParts(p.appended), previous: readRestorePoint(p.previous), status: (p.result ? "done" : "idle") as Project["status"] }));
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

  // Projects saved before recordings had an identity get one as soon as their file is found, so a moved file can be checked later. Each project is tried once per run of the app.
  const sourceTried = useRef(new Set<string>());
  useEffect(() => {
    if (!loaded) return;
    for (const p of projects) {
      if (p.source || sourceTried.current.has(p.id)) continue;
      sourceTried.current.add(p.id);
      const at = p.path;
      window.api.fingerprintFile(at).then((src) => { if (src) setProjects((l) => l.map((x) => (x.id === p.id && x.path === at && !x.source ? { ...x, source: src } : x))); }).catch(() => {});
    }
  }, [projects, loaded]);

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

  /** Saves one project and its recording as a single backup file the person chooses. Resolves true when the file was written; says what happened either way. */
  const backup = useCallback(async (id: string): Promise<boolean> => {
    const p = projectsRef.current.find((x) => x.id === id); if (!p) return false;
    setInfo(""); setNotice("");
    if (hasParts(p)) { setNotice(t("“{name}” is made of {count} recordings, and a backup holds only one recording, so no backup was made. Nothing was changed.", { name: p.name, count: sourcesOf(p).length })); return false; }
    let r: Awaited<ReturnType<typeof window.api.backupProject>>;
    try { r = await window.api.backupProject(persisted(p)); } catch { r = { ok: false, code: "failed" }; }
    if (r.ok) { setInfo(t("Backed up “{name}” ({size}) as {file}. It holds the transcript, speakers, checked quotes and the recording, and restores without the original file.", { name: p.name, size: bytes(r.bytes), file: baseName(r.path) })); return true; }
    if (!r.cancelled) setNotice(t("Could not back up “{name}”: {why} Nothing was changed, and any earlier backup is still there.", { name: p.name, why: backupReason(r.code) }));
    return false;
  }, []);

  /** Asks for a backup file and adds what is in it as a new project (never replacing one). Resolves true when a project was added. */
  const restore = useCallback(async (): Promise<boolean> => {
    setInfo(""); setNotice("");
    let r: Awaited<ReturnType<typeof window.api.restoreProject>>;
    try { r = await window.api.restoreProject(); } catch { r = { ok: false, code: "failed" }; }
    if (!r.ok) { if (!r.cancelled) setNotice(t("Could not restore the backup: {why} Nothing was added, and your projects are as they were.", { why: backupReason(r.code) })); return false; }
    const { project, collided } = restoredProject(projectsRef.current, r.project, r.mediaPath, crypto.randomUUID(), Date.now(), t("(restored)"));
    setProjects((l) => [project, ...l]); setActiveId(project.id);
    setInfo(collided
      ? t("Restored as “{name}”. A project with the same identity was already here, so this one is a separate copy and the existing one is unchanged.", { name: project.name })
      : t("Restored “{name}” as a new project. Its recording is now kept in Cassette’s own recordings folder.", { name: project.name }));
    return true;
  }, []);

  /**
   * "Locate recording": the person picks the moved file. A project that knows its recording accepts only a file with the same identity; an older one asks `confirm` first (with a preview).
   * The new place is saved before it is used, and anything that goes wrong (wrong file, cancel, failed save) leaves the project as it was. Resolves true when the project now points at the new file.
   */
  const relink = useCallback(async (id: string, confirm: (c: Located) => Promise<boolean>): Promise<boolean> => {
    const p = projectsRef.current.find((x) => x.id === id); if (!p) return false;
    setInfo(""); setNotice("");
    if (p.status === "queued" || p.status === "running") { setNotice(t("Wait for the transcription to finish, or cancel it, before choosing the recording again.")); return false; }
    let r: Awaited<ReturnType<typeof window.api.locateRecording>>;
    try { r = await window.api.locateRecording(); } catch { r = { ok: false }; }
    if (!r.ok) { if (!r.cancelled) setNotice(t("That file could not be read as a recording. Nothing was changed.")); return false; }
    const c: Located = { path: r.path, name: r.name, source: r.source };
    const verdict = judgeLocated(p, c);
    if (verdict === "different") { setNotice(t("“{file}” is not the recording “{name}” was made from, so nothing was changed. Choose the original file; it may have been renamed or moved.", { file: c.name, name: p.name })); return false; }
    if (verdict === "unverified" && !(await confirm(c))) return false;
    const cur = projectsRef.current.find((x) => x.id === id);
    if (!cur || cur.path !== p.path) { setNotice(t("The project changed while you were choosing, so nothing was changed. Try again.")); return false; }
    if (cur.path === c.path && cur.source) { setInfo(t("That is the recording this project already uses.")); return false; }
    const w = await commitRelink(tracker.current, projectsRef.current, id, c);
    if (!w.ok) { setNotice(t("Cassette could not save the new place of the recording, so nothing was changed: {error}. Free some disk space and try again.", { error: w.error ?? "unknown" })); return false; }
    // only this project's two fields, so an edit made while the write ran is not lost
    setProjects((l) => l.map((x) => (x.id === id ? { ...x, path: c.path, source: c.source } : x)));
    setInfo(t("“{name}” now uses the recording “{file}”. The transcript, speaker names and edits are unchanged.", { name: p.name, file: c.name }));
    return true;
  }, []);

  /** Put back the restore point a re-run took when the run ends without replacing anything (cancelled, failed, or stopped to ask about the model). */
  const releaseCheckpoint = useCallback((id: string) => {
    const h = held.current.get(id); if (!h) return;
    held.current.delete(id);
    patch(id, { previous: h.previous });
  }, [patch]);

  /**
   * "Add a recording": the file is transcribed on its own and joined after the transcript that is there, on one timeline. Nothing that is already there is touched: a restore point is saved first,
   * and a recording that cannot be read or decoded leaves the project as it was (the notice names the recording). Resolves true when the work was started.
   */
  const appendRecording = useCallback(async (id: string, file: string): Promise<boolean> => {
    setInfo(""); setNotice("");
    const p = projectsRef.current.find((x) => x.id === id); if (!p?.result) return false;
    const idle = (x?: Project) => !!x && x.status !== "queued" && x.status !== "running";
    if (!idle(p)) { setNotice(t("Wait for the transcription to finish, or cancel it, before adding a recording.")); return false; }
    if (p.trial) { setNotice(t("This project only has a 3-minute sample. Transcribe the whole recording before adding another one.")); return false; }
    const name = baseName(file);
    if (!MEDIA_EXT.test(file)) { setNotice(t("“{name}” isn't audio or video. Supported: mp3, wav, m4a, flac, ogg, opus, aac, mp4, mov, mkv, webm.", { name })); return false; }
    let src: Part["source"] | null = null;
    try { src = await window.api.fingerprintFile(file); } catch { src = null; }
    if (!src) { setNotice(t("“{name}” could not be read, so nothing was added.", { name })); return false; }
    if (sourcesOf(p).some((x) => x.path === file || (x.source && x.source.size === src!.size && x.source.sample === src!.sample))) { setNotice(t("“{name}” is already part of this project, so it was not added again.", { name })); return false; }
    // where the new recording starts: right after the last one. The first recording's length comes from its waveform, which the player already made.
    let first = p.result.duration;
    if (!hasParts(p)) { try { const w = await window.api.peaks(p.path); if (w && w.duration > 0) first = w.duration; } catch { /* the transcript's length is a good enough answer */ } }
    const cur = projectsRef.current.find((x) => x.id === id);
    if (!cur?.result || !idle(cur) || (cur.appended?.length ?? 0) !== (p.appended?.length ?? 0)) { setNotice(t("The project changed while the recording was being checked, so nothing was added. Try again.")); return false; }
    const prior = cur.previous;
    if (!(await checkpoint(id, t("add a recording")))) return false;
    if (!idle(projectsRef.current.find((x) => x.id === id))) { releaseCheckpoint(id); return false; }
    held.current.set(id, { previous: prior });
    pending.current.set(id, { range: null, acceptFit: true, add: { id: crypto.randomUUID(), path: file, name, offset: hasParts(cur) ? timelineLength(sourcesOf(cur)) : first, source: src } });
    patch(id, { status: "queued", error: undefined, fitAsk: undefined, partial: true, adding: name });
    return true;
  }, [patch, checkpoint, releaseCheckpoint]);

  /** Queue a run. When the project already has a transcript, a restore point is saved first; if that fails nothing is queued and false is returned. */
  const transcribe = useCallback(async (id: string, range: Range = null, line?: LineRedo, trial?: boolean, acceptFit?: boolean): Promise<boolean> => {
    const had = projectsRef.current.find((p) => p.id === id);
    if (had?.result && !range && hasParts(had)) {
      setNotice(t("“{name}” is made of {count} recordings. Transcribing it again from the start would drop the ones added later, so nothing was changed. Redo a line or a selection instead.", { name: had.name, count: sourcesOf(had).length }));
      return false;
    }
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
    else { releaseCheckpoint(id); patch(id, { status: projectsRef.current.find((p) => p.id === id)?.result ? "done" : "idle", partial: undefined, adding: undefined }); }
  }, [patch, releaseCheckpoint]);

  // queue: one engine job at a time
  useEffect(() => {
    if (projects.some((p) => p.status === "running")) return;
    const next = projects.find((p) => p.status === "queued");
    if (!next) return;
    patch(next.id, { status: "running" });
    const cur = pending.current.get(next.id) ?? { range: null };
    const { range: rg = null, line, acceptFit, add } = cur;
    const forced = line ? { language: line.language, noDiarize: true, multilingual: false } : {};
    const translate = (next.opts?.translate ?? optsRef.current.translate) ?? false;
    // an added recording is transcribed on its own; a redo runs on the one recording where it starts, in that recording's own time (its lines are moved onto the timeline when it is done)
    let input = next.path, start = rg?.[0], end = rg?.[1];
    if (add) { input = add.path; start = end = undefined; }
    else if (rg && hasParts(next)) {
      const tg = redoTarget(sourcesOf(next), rg);
      if (!tg) { releaseCheckpoint(next.id); pending.current.delete(next.id); patch(next.id, { status: next.result ? "done" : "idle", partial: undefined, adding: undefined }); return; }
      input = tg.path; [start, end] = tg.local;
      pending.current.set(next.id, { ...cur, range: tg.global, offset: tg.offset });
    }
    window.api.transcribe({ input, ...optsRef.current, ...next.opts, translate, ...forced, acceptFit, start, end, clientId: next.id })
      .catch((e: unknown) => { releaseCheckpoint(next.id); patch(next.id, { status: "error", error: String(e) }); });
  }, [projects, patch, releaseCheckpoint]);

  // engine events -> projects
  useEffect(() => window.api.onEvent((e) => {
    if (e.type === "started" && e.clientId) { const q = pending.current.get(e.clientId); jobs.current.set(e.jobId, { pid: e.clientId, range: q?.range ?? null, line: q?.line, trial: q?.trial, add: q?.add, offset: q?.offset }); return; }
    const job = jobs.current.get(e.jobId);
    if (!job) return;
    const { pid, range, line, trial, add, offset = 0 } = job;
    const partial = !!range || !!add;  // a redo of one part, or an added recording: the transcript stays on screen and nothing is replaced
    const hadResult = () => !!projectsRef.current.find((p) => p.id === pid)?.result;
    const dropDraft = () => setDrafts((m) => { const { [pid]: _, ...rest } = m; return rest; });
    if (e.type === "partial") { if (!partial && !hadResult()) { written.current.set(pid, [...(written.current.get(pid) ?? []), ...(e.segments as DraftLine[])]); schedulePartial(pid); } if (!partial) setDrafts((m) => ({ ...m, [pid]: [...(m[pid] ?? []), ...(e.segments as DraftLine[])] })); }  // a redo of one part keeps the transcript on screen instead
    else if (e.type === "progress") setProgress((m) => ({ ...m, [pid]: { stage: e.stage, fraction: e.fraction, message: e.message } }));
    else if (e.type === "fit") {  // the engine stopped before the slow work: ask whether to use a better model
      jobs.current.delete(e.jobId);
      dropDraft();
      written.current.delete(pid);  // the engine stopped to ask, before writing anything; lines kept from an earlier run stay
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const had = projectsRef.current.find((p) => p.id === pid)?.result;
      const { type: _t, jobId: _j, ...ask } = e;
      releaseCheckpoint(pid);
      patch(pid, { status: had ? "done" : "idle", partial: undefined, adding: undefined, fitAsk: ask as FitAsk });
    } else if (e.type === "error") {
      jobs.current.delete(e.jobId);
      dropDraft();
      if (!partial) keepInterrupted(pid);
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const had = projectsRef.current.find((p) => p.id === pid)?.result;
      releaseCheckpoint(pid);  // the last finished transcript stays as it was, with the restore point it had before
      if (add && !e.cancelled) {  // the recording that failed is named; everything that was there stays as it was
        const n = sourcesOf(projectsRef.current.find((p) => p.id === pid) ?? { path: "", appended: [], result: null }).length + 1;
        const name = projectsRef.current.find((p) => p.id === pid)?.name ?? "";
        setNotice(t("Could not add recording {n}, “{file}”: {why} “{name}” is unchanged, and the recordings already in it still play and edit as before.", { n, file: add.name, why: String(e.message ?? "").slice(0, 240), name }));
        patch(pid, { status: "done", error: undefined, partial: undefined, adding: undefined });
      } else
      patch(pid, e.cancelled ? { status: had ? "done" : "idle", partial: undefined, adding: undefined } : { status: "error", error: String(e.message), partial: undefined, adding: undefined });
    } else if (e.type === "done") {
      jobs.current.delete(e.jobId);
      dropDraft();
      if (!partial) dropInterrupted(pid);  // finished: the saved lines are no longer needed
      held.current.delete(pid);  // the restore point stays: it is what the run replaced
      history.current.delete(pid);  // the engine's transcript replaces the one the steps belong to
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const r: Result = { language: e.language, duration: e.duration, speakers: e.speakers, segments: e.segments };
      const meta: RunMeta = { ...(e.meta ?? {}), finishedAt: Date.now() };
      // a clean full run teaches the estimates how fast this computer is (runs with translation or per-speaker languages are slower for other reasons)
      if (!range && !trial && !meta.mixed && !meta.translated && meta.model) recordSpeed(meta.model, meta.device === "mps" ? "mlx" : "faster", r.duration, meta.secondsTranscribe, meta.secondsSpeakers, meta.speakerDevice === "mps" || meta.speakerDevice === "cuda");
      setProjects((l) => l.map((p) => {
        if (p.id !== pid) return p;
        const joined = add ? joinAdded(p, r, add, e.duration) : null;
        const result: Result = joined?.result ?? (range && p.result ? mergeRange(p.result, offset ? shiftResult(r, offset) : r, range, line) : r);
        // a full re-run replaces the transcript: the old one was kept as the restore point (and written to disk) before the run started; the new one starts without speaker names
        const replaced = !range && !add && !!p.result;
        const keptNames = replaced ? {} : p.names;
        if (optsRef.current.autosave) {
          const names = Object.fromEntries(result.speakers.map((sp) => [sp, displayName(sp, result.speakers, keptNames)]));
          window.api.saveSidecar(p.path, { source: baseName(p.path), language: result.language, duration: result.duration, speakers: names, segments: result.segments.map(({ words, orig, edited, ...s }) => s) })
            .then((r2) => logRef.current(r2.ok ? "info" : "error", r2.ok ? `Saved transcript next to the audio: ${r2.path}` : `Couldn't save next to the audio: ${r2.error}`));
        }
        return { ...p, result, ...(joined?.appended ? { appended: joined.appended } : {}), names: keptNames, meta: add && p.meta ? p.meta : range && p.meta ? { ...p.meta, ...meta } : meta, status: "done", error: undefined, partial: undefined, adding: undefined, trial: trial ? true : range || add ? p.trial : undefined, ...(add ? { editedAt: Date.now() } : {}) };
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
  /** The answer to "which of these speakers is the same person as one you already have?" for the speakers an added recording brought: lines move to the chosen speakers (an edit that can be undone), and the question is not asked again. */
  const matchParts = useCallback((id: string, partId: string, mapping: Record<string, string>) => {
    const cur = projectsRef.current.find((x) => x.id === id); if (!cur?.result) return;
    const m = matchSpeakers(cur.result, cur.names, mapping);
    const appended = (cur.appended ?? []).map((x) => (x.id === partId ? { ...x, matched: true } : x));
    if (m.result === cur.result) { patch(id, { appended }); return; }
    edit(id, { result: m.result, names: m.names, appended }, t("match speakers"));
  }, [patch, edit]);

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
  return { projects, loaded, notice, info, dismissInfo: () => setInfo(""), backup, restore, relink, appendRecording, matchParts, saveError: saveState.status === "failed" ? saveState.error ?? "unknown" : null, retrySave, dismissNotice: () => setNotice(""), activeId, setActiveId: open, edit, undo, redo, progress, drafts, interrupted, discardInterrupted: dropInterrupted, add, addAndTranscribe, remove, rename: (id: string, name: string) => edit(id, { name }), duplicate, patch, transcribe, cancel, editWithCheckpoint,
    transcribeAll: () => projectsRef.current.filter((p) => p.status === "idle" || p.status === "error").forEach((p) => void transcribe(p.id)) };
}
