import type { Part, Segment, Word } from "./types";
import { isUnsure } from "./types";

/** Export formats that carry the recording cues (unsure wording, unconfirmed speaker, checked lines, gaps, the untranscribed rest). Subtitles, data and the anonymised export stay as they were. */
export const CUED_FORMATS = new Set(["txt", "docx", "quotes"]);

/** Words of a line the model doubted and nobody has confirmed (as written, without surrounding spaces). */
export const unsureOf = (words: Word[]): string[] => words.filter(isUnsure).map((w) => w.word.trim()).filter(Boolean);

/**
 * Speakers nobody has vouched for: the ones an added recording brought in whose matching question is still open, and who still have no name of their own.
 * Matching them to someone (which removes them) or naming them settles it.
 */
export function unconfirmedSpeakers(appended: Part[] | undefined, speakers: string[], names: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const p of appended ?? []) {
    if (p.matched) continue;
    for (const id of p.speakers ?? []) if (speakers.includes(id) && !names[id]?.trim()) out.add(id);
  }
  return [...out];
}

/** The boundary notes of a project as the engine wants them: where the later recording starts on the timeline, and what is known. A boundary with no note says nothing. */
export const boundaryCues = (parts: Part[]): { at: number; kind: "gap" | "unknown" | "overlap"; seconds?: number }[] =>
  parts.flatMap((p, i) => (i > 0 && p.join ? [{ at: p.offset, kind: p.join.kind, ...("seconds" in p.join ? { seconds: p.join.seconds } : {}) }] : []));

/** The stretch nobody transcribed. Only a 3-minute sample leaves one: everything after what it covers. */
export const untranscribedFrom = (trial: boolean | undefined, duration: number): { start: number }[] => (trial ? [{ start: duration }] : []);

/**
 * What the Copy quote button adds after the line: the cues of that line in the words the exports use ("wording unsure: …", "speaker unconfirmed", "checked by a person").
 * A line a person checked says only that; `words` limits the unsure words to the ones inside the quote.
 */
export function quoteCues(t: (s: string, v?: Record<string, string | number>) => string, seg: Segment, unconfirmed: readonly string[], words: readonly Word[] = seg.words): string {
  if (seg.heard) return ` [${t("checked by a person")}]`;
  const labels: string[] = [];
  const unsure = unsureOf(words as Word[]);
  if (unsure.length) labels.push(t("wording unsure: {words}", { words: unsure.join(", ") }));
  if (unconfirmed.includes(seg.speaker)) labels.push(t("speaker unconfirmed"));
  return labels.length ? ` [${labels.join(", ")}]` : "";
}
