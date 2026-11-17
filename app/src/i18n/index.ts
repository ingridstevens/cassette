import { useSyncExternalStore } from "react";

/** App languages. The recording language (what people speak) is a separate, per-project setting. */
export type Lang = "en" | "de" | "fr" | "es" | "ar" | "fa";
/** Languages written right to left: the whole window mirrors. */
const RTL: Lang[] = ["ar", "fa"];
export type LangPref = "system" | Lang;
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" }, { id: "de", label: "Deutsch" }, { id: "fr", label: "Français" }, { id: "es", label: "Español" },
  { id: "ar", label: "العربية" }, { id: "fa", label: "فارسی" },
];

type Dict = Record<string, string>;
/** Each file in ./dict default-exports { de, fr, es }: English text -> translation. English is the key, so a missing entry falls back to English. */
const files = import.meta.glob<{ default: Partial<Record<Exclude<Lang, "en">, Dict>> }>("./dict/*.ts", { eager: true });
const dicts: Record<Exclude<Lang, "en">, Dict> = { de: {}, fr: {}, es: {}, ar: {}, fa: {} };
for (const f of Object.values(files)) for (const l of ["de", "fr", "es", "ar", "fa"] as const) Object.assign(dicts[l], f.default[l]);

/** "Match my computer": the first language the system prefers that the app has, otherwise English. */
export function systemLang(): Lang {
  const prefs = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) { const base = String(p).toLowerCase().split("-")[0]; if (LANGS.some((l) => l.id === base)) return base as Lang; }
  return "en";
}
export const resolveLang = (pref?: LangPref): Lang => (!pref || pref === "system" ? systemLang() : pref);

let current: Lang = "en";
const listeners = new Set<() => void>();
export function setLanguage(pref?: LangPref) {
  const next = resolveLang(pref);
  if (typeof document !== "undefined") { document.documentElement.lang = next; document.documentElement.dir = RTL.includes(next) ? "rtl" : "ltr"; }
  if (next === current) return;
  current = next; listeners.forEach((l) => l());
}
export const currentLang = () => current;

/** Translate an English UI string. `{name}` placeholders are filled from `vars`. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = (current === "en" ? undefined : dicts[current][text]) ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/** Subscribes the component to language changes and returns `t`. Call it in every component that shows text. */
export function useT() {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => current);
  return t;
}
/** BCP 47 tag for Intl formatting (dates, numbers). */
export const locale = () => current;
