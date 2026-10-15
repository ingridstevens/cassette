import { useSyncExternalStore } from "react";
import type { ModelStatus } from "../types";

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
