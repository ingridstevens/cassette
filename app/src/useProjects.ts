import { useCallback, useEffect, useRef, useState } from "react";
import { recordSpeed } from "./estimate";
import { currentLang, t } from "./i18n";
import { DraftLine, FitAsk, JobProgress, MEDIA_EXT, Options, Project, Result, RunMeta, Segment, baseName, displayName, stripExt } from "./types";

type Range = [number, number] | null;
const persisted = (p: Project) => ({ id: p.id, path: p.path, name: p.name, addedAt: p.addedAt, openedAt: p.openedAt, editedAt: p.editedAt, result: p.result, names: p.names, opts: p.opts, meta: p.meta, trial: p.trial, previous: p.previous });

/** Replace the segments overlapping a re-transcribed range, keep the rest. */
/** `line` is set when one line is transcribed again in a chosen language: the new text keeps that line's speaker and gets the language. */
export interface LineRedo { language: string; speaker: string }
function mergeRange(prev: Result, next: Result, [a, b]: [number, number], line?: LineRedo): Result {
  const keep = prev.segments.filter((s) => s.end <= a || s.start >= b);
  const fresh = line ? next.segments.map((s) => ({ ...s, speaker: line.speaker, lang: line.language, words: s.words.map((w) => ({ ...w, speaker: line.speaker })) })) : next.segments;
  const segments: Segment[] = [...keep, ...fresh].sort((x, y) => x.start - y.start);
  return { ...prev, segments, speakers: line ? prev.speakers : Array.from(new Set([...prev.speakers, ...next.speakers])) };
}

export function useProjects(opts: Options, log: (level: string, msg: string) => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, JobProgress>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftLine[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");  // set once, when the saved project list had to be recovered
  const [saveError, setSaveError] = useState<string | null>(null);  // set while the last save failed; cleared by the next one that works
  const optsRef = useRef(opts); optsRef.current = opts;
  const logRef = useRef(log); logRef.current = log;
  const jobs = useRef(new Map<string, { pid: string; range: Range; line?: LineRedo; trial?: boolean }>());      // engine jobId -> project
  const pending = useRef(new Map<string, { range: Range; line?: LineRedo; trial?: boolean; acceptFit?: boolean }>());                            // project -> range for its next run
  const projectsRef = useRef(projects); projectsRef.current = projects;

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
      const list = (raw.projects as Project[]).map((p) => ({ ...p, status: (p.result ? "done" : "idle") as Project["status"] }));
      setProjects(list); setActiveId(list[0]?.id ?? null); setLoaded(true);
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
  // debounced save (only after the first load, so we never overwrite saved projects with an empty list)
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => { window.api.saveProjects(projects.map(persisted)).then((r) => {
      if (!r.ok) logRef.current("error", `Couldn't save the project list: ${r.error}`);
      setSaveError(r.ok ? null : r.error ?? "unknown");
    }).catch((e) => setSaveError(String(e))); }, 400);
    return () => clearTimeout(timer);
  }, [projects, loaded]);

  // flush on close or quit: the debounced save above would not get to run, so a quick edit followed by Cmd+Q was lost
  const loadedRef = useRef(false); loadedRef.current = loaded;
  useEffect(() => {
    const flush = () => { if (loadedRef.current) window.api.saveProjectsSync(projectsRef.current.map(persisted)); };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

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
    for (const p of projects) if (autoStart.current.has(p.path) && p.status === "idle" && !p.result) { autoStart.current.delete(p.path); transcribe(p.id); }
  });

  const jobOf = (pid: string) => [...jobs.current.entries()].find(([, v]) => v.pid === pid)?.[0];

  const remove = useCallback((id: string) => {
    const j = jobOf(id); if (j) window.api.cancel(j);
    pending.current.delete(id);
    setProjects((l) => { const next = l.filter((p) => p.id !== id); setActiveId((a) => (a === id ? next[0]?.id ?? null : a)); return next; });
  }, []);

  const transcribe = useCallback((id: string, range: Range = null, line?: LineRedo, trial?: boolean, acceptFit?: boolean) => {
    pending.current.set(id, { range, line, trial, acceptFit });
    patch(id, { status: "queued", error: undefined, fitAsk: undefined, partial: !!range && !!projectsRef.current.find((p) => p.id === id)?.result });
  }, [patch]);

  const cancel = useCallback((id: string) => {
    const j = jobOf(id);
    if (j) window.api.cancel(j);
    else patch(id, { status: projectsRef.current.find((p) => p.id === id)?.result ? "done" : "idle", partial: undefined });
  }, [patch]);

  // queue: one engine job at a time
  useEffect(() => {
    if (projects.some((p) => p.status === "running")) return;
    const next = projects.find((p) => p.status === "queued");
    if (!next) return;
    patch(next.id, { status: "running" });
    const { range: rg = null, line, acceptFit } = pending.current.get(next.id) ?? {};
    const forced = line ? { language: line.language, noDiarize: true, multilingual: false } : {};
    const translate = (next.opts?.translate ?? optsRef.current.translate) ?? currentLang() === "en";
    window.api.transcribe({ input: next.path, ...optsRef.current, ...next.opts, translate, ...forced, acceptFit, start: rg?.[0], end: rg?.[1], clientId: next.id })
      .catch((e: unknown) => patch(next.id, { status: "error", error: String(e) }));
  }, [projects, patch]);

  // engine events -> projects
  useEffect(() => window.api.onEvent((e) => {
    if (e.type === "started" && e.clientId) { jobs.current.set(e.jobId, { pid: e.clientId, range: pending.current.get(e.clientId)?.range ?? null, line: pending.current.get(e.clientId)?.line, trial: pending.current.get(e.clientId)?.trial }); return; }
    const job = jobs.current.get(e.jobId);
    if (!job) return;
    const { pid, range, line, trial } = job;
    const dropDraft = () => setDrafts((m) => { const { [pid]: _, ...rest } = m; return rest; });
    if (e.type === "partial") { if (!range) setDrafts((m) => ({ ...m, [pid]: [...(m[pid] ?? []), ...(e.segments as DraftLine[])] })); }  // a redo of one part keeps the transcript on screen instead
    else if (e.type === "progress") setProgress((m) => ({ ...m, [pid]: { stage: e.stage, fraction: e.fraction, message: e.message } }));
    else if (e.type === "fit") {  // the engine stopped before the slow work: ask whether to use a better model
      jobs.current.delete(e.jobId);
      dropDraft();
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const had = projectsRef.current.find((p) => p.id === pid)?.result;
      const { type: _t, jobId: _j, ...ask } = e;
      patch(pid, { status: had ? "done" : "idle", partial: undefined, fitAsk: ask as FitAsk });
    } else if (e.type === "error") {
      jobs.current.delete(e.jobId);
      dropDraft();
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const had = projectsRef.current.find((p) => p.id === pid)?.result;
      patch(pid, e.cancelled ? { status: had ? "done" : "idle", partial: undefined } : { status: "error", error: String(e.message), partial: undefined });
    } else if (e.type === "done") {
      jobs.current.delete(e.jobId);
      dropDraft();
      setProgress((m) => { const { [pid]: _, ...rest } = m; return rest; });
      const r: Result = { language: e.language, duration: e.duration, speakers: e.speakers, segments: e.segments };
      const meta: RunMeta = { ...(e.meta ?? {}), finishedAt: Date.now() };
      // a clean full run teaches the estimates how fast this computer is (runs with translation or per-speaker languages are slower for other reasons)
      if (!range && !trial && !meta.mixed && !meta.translated && meta.model) recordSpeed(meta.model, meta.device === "mps" ? "mlx" : "faster", r.duration, meta.secondsTranscribe, meta.secondsSpeakers, meta.speakerDevice === "mps" || meta.speakerDevice === "cuda");
      setProjects((l) => l.map((p) => {
        if (p.id !== pid) return p;
        const result = range && p.result ? mergeRange(p.result, r, range, line) : r;
        // a full re-run replaces the transcript: keep the old one for one step back, and start the new one without speaker names
        const replaced = !range && !!p.result;
        const keptNames = replaced ? {} : p.names;
        if (optsRef.current.autosave) {
          const names = Object.fromEntries(result.speakers.map((sp) => [sp, displayName(sp, result.speakers, keptNames)]));
          window.api.saveSidecar(p.path, { source: baseName(p.path), language: result.language, duration: result.duration, speakers: names, segments: result.segments.map(({ words, orig, edited, ...s }) => s) })
            .then((r2) => logRef.current(r2.ok ? "info" : "error", r2.ok ? `Saved transcript next to the audio: ${r2.path}` : `Couldn't save next to the audio: ${r2.error}`));
        }
        return { ...p, result, names: keptNames, previous: replaced ? { result: p.result!, names: p.names, meta: p.meta } : p.previous, meta: range && p.meta ? { ...p.meta, ...meta } : meta, status: "done", error: undefined, partial: undefined, trial: trial ? true : range ? p.trial : undefined };
      }));
    }
  }), [patch]);

  const open = useCallback((id: string | null) => { setActiveId(id); if (id) patch(id, { openedAt: Date.now() }); }, [patch]);
  const edit = useCallback((id: string, p: Partial<Project>) => patch(id, { ...p, editedAt: Date.now() }), [patch]);
  return { projects, notice, saveError, dismissNotice: () => setNotice(""), activeId, setActiveId: open, edit, progress, drafts, add, addAndTranscribe, remove, rename: (id: string, name: string) => patch(id, { name }), patch, transcribe, cancel,
    transcribeAll: () => projectsRef.current.filter((p) => p.status === "idle" || p.status === "error").forEach((p) => transcribe(p.id)) };
}
