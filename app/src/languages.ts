import { currentLang } from "./i18n";

/** The four languages the app is tuned and tested for; they come first in the picker. */
export const MAIN_LANGS = ["de", "en", "fr", "es"];
/** Every language Whisper understands (kept in sync with the engine by a test in engine/tests). */
export const WHISPER_LANGS = ("af am ar as az ba be bg bn bo br bs ca cs cy da de el en es et eu fa fi fo fr gl gu ha haw he hi hr ht hu hy id is it ja jw ka kk km kn ko la lb ln lo lt lv mg mi mk ml mn mr ms mt my ne nl nn no oc pa pl ps pt ro ru sa sd si sk sl sn so sq sr su sv sw ta te tg th tk tl tr tt uk ur uz vi yi yo zh yue").split(" ");

/** Name of a language in the app's own language (German, Deutsch, Allemand, Alemán…), from the system's locale data. */
export function langName(code: string): string {
  try { return new Intl.DisplayNames([currentLang()], { type: "language" }).of(code) ?? code.toUpperCase(); } catch { return code.toUpperCase(); }
}
