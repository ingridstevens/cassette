/** The export formats the Export menu knows: id, label and hint (English; the menu translates them). */
/** Grouped by what the export is for. */
export const GROUPS: { title: string; formats: readonly (readonly [string, string, string])[] }[] = [
  { title: "Read and share", formats: [
    ["docx", "Word document", ".docx · speakers in bold, with times"],
    ["txt", "Plain text", ".txt · [time] Speaker: text"],
    ["md", "Markdown", ".md"],
    ["copy-md", "Copy as Markdown", "To the clipboard, to paste into a note app · follows the Text style settings"],
    ["print", "Print / PDF", ".pdf · the transcript only, ready to print"],
    ["print-large", "Large-print PDF", ".pdf · 150% text size, for easier reading"],
    ["redacted", "Anonymised text", ".txt · speaker names replaced by P01, P02…; other names in the text are not found"],
    ["text", "Text style…", "Keep or remove “um”, mark pauses, show or hide times"],
  ] },
  { title: "Subtitles and video", formats: [
    ["srt", "Subtitles (.srt)", "Line length, speaker names, time shift"],
    ["vtt", "Web subtitles (.vtt)", "For web video"],
    ["chapters", "Chapters (text)", "0:00 Title per line · YouTube and podcasts"],
    ["edl", "Markers (DaVinci Resolve .edl)", "Chapters or speaker turns as timeline markers"],
    ["episode", "Episode folder", "Chapters, a clip per highlight and Resolve markers, in one new folder"],
  ] },
  { title: "Data", formats: [
    ["csv", "Spreadsheet", ".csv · start and end times, speaker, text"],
    ["json", "Everything (JSON)", ".json · all lines, words and speakers"],
    ["changes", "Original vs. edited", ".txt · every line you changed, before and after"],
  ] },
  { title: "Highlights and minutes", formats: [
    ["minutes", "Meeting minutes (Word)", ".docx · summary, attendees, decisions, key quotes, record"],
    ["highlights", "Highlights (Word)", ".docx · quotes with speaker, time and reason"],
    ["quotes", "Highlights and marked lines (text)", ".txt · your highlights and marked lines as quotes"],
  ] },
];

/** The formats the Export menu shows up front until the person chooses their own (Settings, Saving and export). Everything else sits behind "More formats". */
export const DEFAULT_SHOWN: readonly string[] = ["docx", "txt", "print", "print-large", "srt", "minutes"];
export const ALL = GROUPS.flatMap((g) => g.formats);
/** Formats that can be chosen as the default in Settings (the text-style dialog only saves settings, it exports nothing). */
export const EXPORT_CHOICES = ALL.filter(([f]) => f !== "text" && f !== "copy-md");

import { EASY_FORMATS } from "./easy";

/**
 * The formats the person chose to see up front in the Export menu (#192), as a clean list in the menu's own order.
 * Missing, malformed or old saved values give the default set; unknown or repeated ids are dropped; an empty list is kept
 * (the menu then shows only "More formats…", which always reaches everything).
 */
export function normaliseShown(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SHOWN];
  const want = new Set(raw.filter((x): x is string => typeof x === "string"));
  return ALL.map(([f]) => f).filter((f) => want.has(f));
}

/** True when the saved choice is the default set (so Settings can disable "Reset to the default set"). */
export const isDefaultShown = (raw: unknown): boolean => {
  const a = normaliseShown(raw), d = normaliseShown(DEFAULT_SHOWN);
  return a.length === d.length && a.every((f, i) => f === d[i]);
};

/** Ticks or unticks one format and returns the new list in menu order. */
export const toggleShown = (raw: unknown, format: string, on: boolean): string[] =>
  normaliseShown([...normaliseShown(raw).filter((f) => f !== format), ...(on ? [format] : [])]);

/** What the menu lists up front: Easy mode's fixed two items (the setting never changes them), else the chosen formats. Everything not listed is under "More formats…". */
export const shownFormats = (raw: unknown, easy: boolean): string[] => (easy ? [...EASY_FORMATS] : normaliseShown(raw));
