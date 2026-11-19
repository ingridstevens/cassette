/** Which one-time help texts the person has already read ("Got it"). Kept in localStorage, app-wide. */
const KEY = "hintsSeen";

export function readSeen(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export function markSeen(id: string): string[] {
  const next = readSeen().includes(id) ? readSeen() : [...readSeen(), id];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* the hint just shows again next time */ }
  return next;
}

export type Tab = "speakers" | "ai" | "details";
export const TABS: Tab[] = ["speakers", "ai", "details"];
/** Older versions had five tabs (and may have saved one): map any saved id to its new home, falling back to Speakers. */
export function normalizeTab(id: unknown): Tab {
  if (id === "speakers" || id === "ai" || id === "details") return id;
  if (id === "highlights" || id === "summary" || id === "ask") return "ai";
  if (id === "options" || id === "info") return "details";
  return "speakers";
}
export type AiPart = "highlights" | "summary" | "ask";
export const AI_PARTS: AiPart[] = ["highlights", "summary", "ask"];
/** Which AI sub-tab an old saved tab id (or a saved sub-tab) opens: Ask stays Ask, Summary stays Summary, everything else is Highlights. */
export const legacyAiPart = (id: unknown): AiPart => (id === "ask" ? "ask" : id === "summary" ? "summary" : "highlights");
