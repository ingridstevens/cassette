import { langName } from "./languages";
import { modelName } from "./components/modelInfo";
import { Options } from "./types";

type TFn = (text: string, vars?: Record<string, string | number>) => string;

/** The start sheet's one-line summary of the choices behind "Change settings": "Automatic language · Small model · find speakers". */
export function summaryLine(t: TFn, eff: Options): string {
  const language = eff.multilingual === true ? t("Several languages") : eff.language !== "auto" ? langName(eff.language) : t("Automatic language");
  const speakers = eff.noDiarize ? t("transcript only")
    : eff.numSpeakers === "range" ? t("{from} to {to} speakers", { from: eff.minSpeakers ?? "2", to: eff.maxSpeakers ?? "4" })
    : eff.numSpeakers ? t("{count} speakers", { count: eff.numSpeakers })
    : t("find speakers");
  return [language, t("{model} model", { model: modelName(eff.model) }), speakers, ...(eff.translate ? [t("with translation")] : [])].join(" · ");
}

const KEY = "startSettingsOpen";
/** Whether the start sheet's settings were left open last time. */
export function loadStartOpen(): boolean { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }
export function saveStartOpen(open: boolean): void { try { localStorage.setItem(KEY, open ? "1" : "0"); } catch { /* storage unavailable */ } }
