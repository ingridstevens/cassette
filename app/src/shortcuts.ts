import { MOD_KEY } from "./types";

type TFn = (s: string, v?: Record<string, string | number>) => string;

/** Every keyboard shortcut, in the order they are shown (Settings, Text and language, and the list that opens with the ? key). */
export const shortcutList = (t: TFn): [string, string][] => [
  ["Space / K", t("Play or pause")],
  ["J / L", t("Back or forward 10 seconds")],
  ["N / Shift+N", t("Next or previous line from a different speaker")],
  ["O / Shift+O", t("Next or previous overlap, where two people talk at once")],
  ["M / Shift+M", t("Next or previous marked line")],
  ["C / Shift+C", t("Next or previous chapter")],
  ["G", t("Go to a time in the recording")],
  [`${MOD_KEY}F`, t("Find in the transcript")],
  [`${MOD_KEY}E`, t("Open the Export menu")],
  [`${MOD_KEY},`, t("Open Settings")],
  ["Enter", t("Save an edit")],
  ["Esc", t("Close a menu or dialog, or cancel an edit")],
  ["?", t("Show this list of shortcuts")],
];

export { parseTime } from "./parseTime";
