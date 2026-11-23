import type { Highlight, Join, Part, Project, Result, Segment, Word } from "./types";
import { baseName } from "./types";

/**
 * Recordings of one project, in order, on one timeline. Transcript lines, highlights and the playhead all use that timeline; each recording
 * knows where it starts (`offset`). A project with a single recording (every project saved before recordings could be added) is one source at offset 0.
 * The first recording is the project's own `path` and `source` (so "Locate recording" keeps working); added ones are in `appended`.
 */
export function sourcesOf(p: Pick<Project, "path" | "source" | "appended" | "result">): Part[] {
  const more = p.appended ?? [];
  const first: Part = { id: "s1", path: p.path, name: baseName(p.path), offset: 0, duration: more[0]?.offset ?? p.result?.duration ?? 0, source: p.source };
  return [first, ...more];
}

/** The project has more than one recording. */
export const hasParts = (p: Pick<Project, "appended">): boolean => (p.appended?.length ?? 0) > 0;

/** Length of the whole timeline. */
export const timelineLength = (parts: Part[]): number => { const l = parts[parts.length - 1]; return l ? l.offset + l.duration : 0; };

/** Which recording a moment on the timeline is in, and where in that recording. The join belongs to the later recording. Out-of-range moments stay inside the nearest one. */
export function locate(parts: Part[], t: number): { index: number; local: number } {
  let index = 0;
  for (let i = 0; i < parts.length; i++) if (parts[i].offset <= t) index = i;
  const p = parts[index];
  const local = Math.max(0, t - p.offset);
  return { index, local: p.duration > 0 && index < parts.length - 1 ? Math.min(local, p.duration) : local };
}

/** A stretch of the timeline as a stretch of one recording (for saving a clip or translating a line). A stretch that runs over the join is cut at the end of the recording it starts in. Null when nothing is left. */
export function clipOf(parts: Part[], start: number, end: number): { path: string; start: number; end: number; index: number } | null {
  const { index, local } = locate(parts, start);
  const p = parts[index];
  const last = index === parts.length - 1;
  const stop = last ? end - p.offset : Math.min(end - p.offset, p.duration);
  return stop > local ? { path: p.path, start: local, end: stop, index } : null;
}

const shiftWord = (w: Word, by: number): Word => ({ ...w, start: w.start + by, end: w.end + by });
/** Move every time in a transcript by `by` seconds. */
export function shiftResult(r: Result, by: number): Result {
  if (!by) return r;
  const segments: Segment[] = r.segments.map((s) => ({
    ...s, start: s.start + by, end: s.end + by, words: s.words.map((w) => shiftWord(w, by)),
    ...(s.orig ? { orig: { ...s.orig, words: s.orig.words.map((w) => shiftWord(w, by)) } } : {}),
  }));
  const highlights: Highlight[] | undefined = r.highlights?.map((h) => ({ ...h, start: h.start + by, end: h.end + by }));
  return { ...r, segments, ...(highlights ? { highlights } : {}) };
}

/** Speaker ids the engine gives are SPEAKER_00, SPEAKER_01 ... for each recording on its own. The lowest ones nobody uses yet. */
function freeSpeakerIds(taken: string[], count: number): string[] {
  const used = new Set(taken), out: string[] = [];
  for (let n = 0; out.length < count; n++) { const id = `SPEAKER_${String(n).padStart(2, "0")}`; if (!used.has(id)) out.push(id); }
  return out;
}

/**
 * The transcript of an added recording (times from its own start) joined after what is already there. Existing lines, edits, checked words, highlights and names are not touched.
 * The new recording's speakers get ids nobody uses (a different phone may well be a different person even when both are "SPEAKER_00"); `added` says which, in the order of `next.speakers`.
 * Lines in another language than the project's are tagged with theirs.
 */
export function appendResult(prev: Result, next: Result, offset: number, duration: number): { result: Result; added: string[] } {
  const ids = freeSpeakerIds(prev.speakers, next.speakers.length);
  const rename = new Map(next.speakers.map((s, i) => [s, ids[i]]));
  const to = (s: string) => rename.get(s) ?? s;
  const shifted = shiftResult(next, offset);
  const segments: Segment[] = shifted.segments.map((s) => ({
    ...s, speaker: to(s.speaker), words: s.words.map((w) => ({ ...w, speaker: to(w.speaker) })),
    ...(next.language && next.language !== prev.language && !s.lang ? { lang: next.language } : {}),
  }));
  const speakers = Array.from(new Set([...prev.speakers, ...ids, ...segments.map((s) => s.speaker)]));
  return { result: { ...prev, segments: [...prev.segments, ...segments], speakers, duration: offset + duration }, added: ids };
}

/**
 * "Match speakers across parts": every line of speaker `from` (in the whole transcript) moves to speaker `to`, and `from` disappears from the speaker list and the names.
 * `mapping` maps each speaker of the added recording to a speaker that was there before; speakers it leaves out stay as new speakers.
 */
export function matchSpeakers(result: Result, names: Record<string, string>, mapping: Record<string, string>): { result: Result; names: Record<string, string> } {
  const moves = Object.entries(mapping).filter(([from, to]) => from !== to && result.speakers.includes(from) && result.speakers.includes(to));
  if (!moves.length) return { result, names };
  const map = new Map(moves);
  const to = (s: string) => map.get(s) ?? s;
  const segments = result.segments.map((s) => (map.has(s.speaker) || s.words.some((w) => map.has(w.speaker)) ? { ...s, speaker: to(s.speaker), words: s.words.map((w) => (map.has(w.speaker) ? { ...w, speaker: to(w.speaker) } : w)) } : s));
  const highlights = result.highlights?.map((h) => (map.has(h.speaker) ? { ...h, speaker: to(h.speaker) } : h));
  const gone = new Set(map.keys());
  const kept = Object.fromEntries(Object.entries(names).filter(([id]) => !gone.has(id)));
  return { result: { ...result, segments, speakers: result.speakers.filter((s) => !gone.has(s)), ...(highlights ? { highlights } : {}) }, names: kept };
}

/**
 * A redo of part of the transcript (a line or a selection) runs on the one recording where it starts: `local` is the stretch in that recording,
 * `global` the same stretch on the timeline (cut at the end of the recording when it ran over the join), `offset` what to add to the engine's times.
 */
export function redoTarget(parts: Part[], range: [number, number]): { path: string; offset: number; local: [number, number]; global: [number, number] } | null {
  const c = clipOf(parts, range[0], range[1]);
  if (!c) return null;
  const offset = parts[c.index].offset;
  return { path: c.path, offset, local: [c.start, c.end], global: [offset + c.start, offset + c.end] };
}

/** A boundary note as read from disk: only a known kind, and a length that is a positive number where one is needed. Anything else is no note. */
export function readJoin(raw: unknown): Join | undefined {
  const o = raw as { kind?: unknown; seconds?: unknown } | null;
  if (!o || typeof o !== "object") return undefined;
  if (o.kind === "unknown") return { kind: "unknown" };
  if ((o.kind === "gap" || o.kind === "overlap") && typeof o.seconds === "number" && Number.isFinite(o.seconds) && o.seconds > 0) return { kind: o.kind, seconds: o.seconds };
  return undefined;
}

/** One place on the timeline where a recording ends and the next begins. `at` is where the later recording starts. */
export interface Boundary { index: number; at: number; before: Part; after: Part; join?: Join }
/** Every boundary between recordings, in order (none for a project with one recording). */
export const boundaries = (parts: Part[]): Boundary[] => parts.slice(1).map((after, i) => ({ index: i + 1, at: after.offset, before: parts[i], after, join: after.join }));

/**
 * Which transcript line each boundary is shown above: the first line that starts at or after the point where the later recording begins.
 * A boundary with no line after it (the later recording had no speech) is not in the map.
 */
export function boundaryRows(segments: Pick<Segment, "start">[], parts: Part[]): Map<number, Boundary[]> {
  const out = new Map<number, Boundary[]>();
  for (const b of boundaries(parts)) {
    const row = segments.findIndex((s) => s.start >= b.at);
    if (row >= 0) out.set(row, [...(out.get(row) ?? []), b]);
  }
  return out;
}

/** The recordings with the boundary note before recording `id` set (or taken away with undefined). Everything else is the same. */
export const withJoin = (appended: Part[], id: string, join: Join | undefined): Part[] => appended.map((x) => { if (x.id !== id) return x; const { join: _j, ...rest } = x; return join ? { ...rest, join } : rest; });

/** Added recordings as read from projects.json (or a restore point or backup): the entries that are usable, in order. A damaged entry is left out rather than breaking the project. Undefined when none is left. */
export function readParts(raw: unknown): Part[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Part[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id || typeof o.path !== "string" || !o.path || typeof o.offset !== "number" || !(o.offset >= 0) || typeof o.duration !== "number" || !(o.duration >= 0)) continue;
    const src = o.source as Record<string, unknown> | undefined;
    out.push({
      id: o.id, path: o.path, name: typeof o.name === "string" && o.name ? o.name : baseName(o.path), offset: o.offset, duration: o.duration,
      ...(src && typeof src.size === "number" && typeof src.sample === "string" ? { source: { size: src.size, sample: src.sample } } : {}),
      ...(Array.isArray(o.speakers) ? { speakers: o.speakers.filter((v): v is string => typeof v === "string") } : {}),
      ...(o.matched === true ? { matched: true } : {}),
      ...(readJoin(o.join) ? { join: readJoin(o.join) } : {}),
    });
  }
  return out.length ? out : undefined;
}

/** A recording being added, as the queue holds it while its transcript is made. */
export interface AddedRecording { id: string; path: string; name: string; offset: number; source?: Part["source"] }

/**
 * What changes in a project when the transcript of an added recording is ready: the lines join the end of the transcript and the recording joins the list. Nothing else is touched
 * (names, edits, checked words, highlights, the summary, the restore point). `duration` is the new recording's own length.
 */
export function joinAdded(p: Pick<Project, "result" | "appended">, next: Result, add: AddedRecording, duration: number): Pick<Project, "result" | "appended"> | null {
  if (!p.result) return null;
  const { result, added } = appendResult(p.result, next, add.offset, duration);
  return { result, appended: [...(p.appended ?? []), { id: add.id, path: add.path, name: add.name, offset: add.offset, duration, source: add.source, speakers: added }] };
}
