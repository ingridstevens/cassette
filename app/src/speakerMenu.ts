import type { Result } from "./types";

/** The speaker filter in the "Who said this line?" menu only shows up from this many speakers on. */
export const FILTER_AT = 6;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The speakers whose shown name contains the typed text (case and accents ignored). Empty text keeps all of them. */
export function filterSpeakers(speakers: string[], label: (id: string) => string, query: string): string[] {
  const q = fold(query);
  return q ? speakers.filter((sp) => fold(label(sp)).includes(q)) : speakers;
}

/** The next free engine-style id (SPEAKER_03), also skipping ids that only have a name. */
export function nextSpeakerId(speakers: string[], names: Record<string, string>): string {
  let max = -1;
  for (const id of [...speakers, ...Object.keys(names)]) { const m = /^SPEAKER_(\d+)$/.exec(id); if (m) max = Math.max(max, Number(m[1])); }
  return `SPEAKER_${String(max + 1).padStart(2, "0")}`;
}

/**
 * Gives one line to a speaker typed by name. A name that already belongs to a speaker (any case) uses that speaker, so
 * nobody ends up twice. Otherwise a new speaker is added with that name (empty: the usual "Speaker N"). Result and names
 * change together so the caller can record it as one undo step.
 */
export function assignToNamed(result: Result, names: Record<string, string>, index: number, typed: string, label: (id: string) => string):
  { result: Result; names: Record<string, string>; id: string; created: boolean } | null {
  const seg = result.segments[index];
  if (!seg) return null;
  const name = typed.trim();
  const same = name ? result.speakers.find((sp) => label(sp).trim().toLowerCase() === name.toLowerCase()) : undefined;
  const created = !same;
  const id = same ?? nextSpeakerId(result.speakers, names);
  const segments = result.segments.map((s, k) => (k === index ? { ...s, speaker: id, words: s.words.map((w) => ({ ...w, speaker: id })) } : s));
  return {
    result: { ...result, speakers: created ? [...result.speakers, id] : result.speakers, segments },
    names: created && name ? { ...names, [id]: name } : names, id, created,
  };
}
