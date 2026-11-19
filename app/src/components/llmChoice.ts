import { useSyncExternalStore } from "react";
import { bytes, type ModelStatus } from "../types";

/** Which language model highlights and summaries use. Settings and the Highlights tab both change it, so it lives here and both follow it. */
const KEY = "llmModel";
const listeners = new Set<() => void>();
let current = (() => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } })();

export function setLlm(id: string) {
  current = id;
  try { localStorage.setItem(KEY, id); } catch { /* the choice is a convenience */ }
  listeners.forEach((l) => l());
}

/** The model in use: the one chosen, if it is still offered. Otherwise the recommended one when it is downloaded or nothing is,
 * else the first downloaded one, so someone who already has a model keeps using it after an update changes the recommendation. */
export function useLlm(llm: ModelStatus["llm"]): string {
  const id = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
  const offered = (llm?.catalog ?? []).map((m) => m.id), have = offered.filter((m) => llm?.models?.[m]), rec = llm?.default ?? "";
  if (id && offered.includes(id)) return id;
  return have.includes(rec) || !have.length ? rec : have[0];
}

/** One line for a language model in a picker: name, disk size and whether it is downloaded, from the same status the Settings list reads.
 * `t` is the translator; the strings are the ones the Settings list already uses. Memory need is left out: the repo has no measured figure for these models. */
export function llmOptionText(t: (s: string, v?: Record<string, string | number>) => string, label: string, have: boolean, size: number | undefined): string {
  const disk = size ? bytes(size).replace(".0 GB", " GB") : "";
  return [label, disk && t("≈ {size}", { size: disk }), have ? t("Downloaded") : t("Not downloaded")].filter(Boolean).join(" · ");
}
