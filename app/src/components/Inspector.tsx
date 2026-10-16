import { ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { currentLang, useT } from "../i18n";
import { ExtrasField, LanguageField, ModelField, NamesField, TranscriptOnlyField, langMode } from "./TranscribeFields";
import SpeakerCountField from "./SpeakerCountField";
import { Models } from "./useModels";
import { WHISPER_MODELS, modelName } from "./modelInfo";
import { langName } from "../languages";
import { FILE_MANAGER, ModelStatus, Options, PALETTE, Project, baseName, bytes, defaultName, displayName, fmt } from "../types";
import "../styles/project.css";

export type Tab = "speakers" | "highlights" | "ask" | "options" | "info";
export interface Moved { from: string; to: string; idx: number }

const SMALL_MODELS = ["tiny", "base", "small"];
const BIG_MODELS = ["large-v3-turbo", "large-v3", "medium"];
/** Languages Whisper had little training data for: small models mostly produce noise for them. */
const WEAK_LANGS = new Set(["am", "so", "ps", "sw", "ti", "om", "ha", "yo", "sn", "ln", "mg", "lo", "my", "km", "ne", "si", "sd", "tg", "tk", "uz", "ky", "kk", "ur", "pa", "bn", "ta", "te", "ml", "kn", "gu", "mr"]);
/** A nudge to a bigger model when the result probably suffered from a small one: several languages, a hard language, or a doubtful language guess. */
function modelSuggestion(eff: Options, meta: Project["meta"], found: string[], status: ModelStatus | null): { reason: "mixed" | "weak" | "unsure"; model?: string } | null {
  if (!SMALL_MODELS.includes(eff.model)) return null;
  const codes = new Set([...found, ...(eff.language !== "auto" ? [eff.language] : [])]);
  const reason = eff.multilingual === true || meta?.mixed || codes.size > 1 ? "mixed" : [...codes].some((c) => WEAK_LANGS.has(c)) ? "weak" : meta?.languageProb != null && meta.languageProb < 0.7 ? "unsure" : null;
  if (!reason) return null;
  return { reason, model: BIG_MODELS.find((m) => status?.whisper[m]) };
}
const DEVICE: Record<string, string> = { cpu: "CPU", mps: "Apple GPU", cuda: "NVIDIA GPU" };
export const deviceName = (d?: string | null) => (d ? DEVICE[d] ?? d : "");
const GLOBAL_DEFAULTS: Options = { model: "small", language: "auto", numSpeakers: "", vad: false, prompt: "", noDiarize: false, device: "auto", autosave: true, multilingual: false, minSpeakers: "2", maxSpeakers: "4" };

/** The app-wide options (Settings) are kept in localStorage by App; project options are layered on top of them. */
export function globalOpts(): Options {
  try { return { ...GLOBAL_DEFAULTS, ...JSON.parse(localStorage.getItem("opts") || "{}") }; } catch { return GLOBAL_DEFAULTS; }
}

type TFn = ReturnType<typeof useT>;
const secs = (n: number, t: TFn) => { const c = Math.max(1, Math.round(n)); return c === 1 ? t("{count} second", { count: c }) : t("{count} seconds", { count: c }); };
function addedLabel(ts: number, t: TFn) {
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return t("Today, {time}", { time });
  if (d.toDateString() === yest.toDateString()) return t("Yesterday, {time}", { time });
  return `${d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}

interface Props {
  project: Project; tab: Tab; onTab(t: Tab): void; visible: boolean;
  moved: Moved | null; onMoveAll(): void; onUndo(): void;
  canTranscribe: boolean; onAskAgain(): void; onPatch(p: Partial<Project>): void; onOpenSettings?(section?: string): void; models: Models;
  /** The Highlights and Ask tabs (built by the project view, which owns the language-model jobs). */
  highlightsPanel?: ReactNode; askPanel?: ReactNode;
}

export default function Inspector({ project, tab, onTab, visible, moved, onMoveAll, onUndo, canTranscribe, onAskAgain, onPatch, onOpenSettings, models, highlightsPanel, askPanel }: Props) {
  const t = useT();
  const ids = { speakers: useId(), highlights: useId(), ask: useId(), options: useId(), info: useId() };
  const tabs: [Tab, string][] = [["speakers", "Speakers"], ["highlights", "Highlights"], ["ask", "Ask"], ["options", "Options"], ["info", "Info"]];
  const move = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : -1;
    if (n < 0) return;
    e.preventDefault(); onTab(tabs[n][0]); document.getElementById(ids[tabs[n][0]] + "-tab")?.focus();
  };
  return (
    <aside className="inspector pv-inspector" aria-label={t("Inspector")}>
      <div className="tabs" role="tablist" aria-label={t("Inspector sections")}>
        {tabs.map(([id, label], i) => (
          <button key={id} id={ids[id] + "-tab"} role="tab" type="button" aria-selected={tab === id} aria-controls={ids[id]} tabIndex={tab === id ? 0 : -1}
            onClick={() => onTab(id)} onKeyDown={(e) => move(e, i)}>{t(label)}</button>
        ))}
      </div>
      <div className="pv-tab" id={ids[tab]} role="tabpanel" aria-labelledby={ids[tab] + "-tab"}>
        {tab === "speakers" && <Speakers project={project} moved={moved} onMoveAll={onMoveAll} onUndo={onUndo} onPatch={onPatch} />}
        {tab === "highlights" && highlightsPanel}
        {tab === "ask" && askPanel}
        {tab === "options" && <OptionsTab project={project} visible={visible} canTranscribe={canTranscribe} onAskAgain={onAskAgain} onPatch={onPatch} onOpenSettings={onOpenSettings} models={models} />}
        {tab === "info" && <Info project={project} />}
      </div>
    </aside>
  );
}

/** Speakers that still have at least one line, most talkative first. */
export function liveSpeakers(project: Project) {
  const r = project.result;
  if (!r) return [];
  const total = r.segments.reduce((a, s) => a + Math.max(0, s.end - s.start), 0) || 1;
  return r.speakers.map((id) => {
    const own = r.segments.filter((s) => s.speaker === id);
    const t = own.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
    return { id, index: r.speakers.indexOf(id), turns: own.length, pct: Math.round((t / total) * 100), time: t };
  }).filter((s) => s.turns > 0).sort((a, b) => b.time - a.time);
}

function Speakers({ project, moved, onMoveAll, onUndo, onPatch }: Pick<Props, "project" | "moved" | "onMoveAll" | "onUndo" | "onPatch">) {
  const t = useT();
  const { result, names } = project;
  const list = useMemo(() => liveSpeakers(project), [project]);
  if (!result) return <p className="note">{t("Speakers appear here once the recording is transcribed. You can then name them and fix any line that was given to the wrong person.")}</p>;
  const name = (id: string) => displayName(id, result.speakers, names);
  const remaining = moved ? result.segments.filter((s) => s.speaker === moved.from).length : 0;
  return (
    <div className="pv-col">
      <div className="note">{t("Click a name to rename it. Wrong speaker on a line? Click the name above that line to move it to someone else.")}</div>
      {list.map((s) => (
        <div key={s.id} className="card pv-spk">
          <div className="pv-spk-head">
            <span className="sw" style={{ background: PALETTE[s.index % PALETTE.length] }} aria-hidden />
            <input className="pv-namefield" value={names[s.id] ?? ""} placeholder={defaultName(s.id, result.speakers)} aria-label={t("Name for speaker {number}", { number: s.index + 1 })}
              onChange={(e) => onPatch({ names: { ...names, [s.id]: e.target.value } })} />
            <span className="note">{s.turns === 1 ? t("{count} turn", { count: s.turns }) : t("{count} turns", { count: s.turns })}</span>
          </div>
          <div className="pv-bar" aria-hidden><i style={{ width: `${s.pct}%`, background: PALETTE[s.index % PALETTE.length] }} /></div>
          <div className="note">{t("{percent}% of the talking", { percent: s.pct })}</div>
        </div>
      ))}
      {moved && (
        <div className="pv-moved" role="status">
          <b>{t("Moved this line from {from} to {to}.", { from: name(moved.from), to: name(moved.to) })}</b>
          {remaining > 0 && (
            <>
              <p>{remaining === 1 ? t("There is 1 more line labelled {from}. If {from} and {to} are really the same person, you can move it too.", { from: name(moved.from), to: name(moved.to) }) : t("There are {count} more lines labelled {from}. If {from} and {to} are really the same person, you can move them too.", { count: remaining, from: name(moved.from), to: name(moved.to) })}</p>
              <button type="button" className="btn small" onClick={onMoveAll}>{remaining === 1 ? t("Move it to {to}", { to: name(moved.to) }) : t("Move all {count} to {to}", { count: remaining, to: name(moved.to) })}</button>
            </>
          )}
          <button type="button" className="btn quiet small" onClick={onUndo}>{t("Undo")}</button>
        </div>
      )}
      <div className="note">{t("Many speakers? The list scrolls and is sorted by who talks most. If it finds far too many, one person was probably split into several: set the number of speakers under Options and transcribe again.")}</div>
    </div>
  );
}

function OptionsTab({ project, visible, canTranscribe, onAskAgain, onPatch, onOpenSettings, models }: Pick<Props, "project" | "visible" | "canTranscribe" | "onAskAgain" | "onPatch" | "onOpenSettings" | "models">) {
  const t = useT();
  const eff: Options = { ...globalOpts(), ...project.opts };
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { if (visible) window.api.models("status").then((r) => { if (alive.current && r) setStatus(r as unknown as ModelStatus); }).catch(() => {}); }, [visible, models.busy]);
  const set = (p: Partial<Options>) => onPatch({ opts: { ...project.opts, ...p } });
  const meta = project.meta;
  const several = eff.language === "auto" && eff.multilingual === true;
  const foundCodes = project.result && eff.language === "auto" ? (Object.keys(meta?.languages ?? {}).length > 1 ? Object.entries(meta!.languages!).sort((a, b) => b[1] - a[1]).map(([c]) => c) : [project.result.language]) : [];
  const found = foundCodes.map(langName).join(", ");
  const has = !!project.result;
  const suggestion = modelSuggestion(eff, meta, foundCodes, status);
  return (
    <div className="pv-col pv-options">
      <div className="note">{t("These apply to this project the next time you transcribe it.")}</div>
      {suggestion && (
        <div className="pv-moved" role="status">
          <b>{suggestion.reason === "mixed" ? t("Several languages in one recording are hard for a small model.") : suggestion.reason === "weak" ? t("Some of these languages need a bigger model to be written down well.") : t("The language was hard to recognise.")}</b>
          <p>{suggestion.model ? t("{model} is already downloaded and usually gives much better results here. It takes longer.", { model: t(modelName(suggestion.model)) }) : t("A larger model usually gives much better results here. It takes longer and has to be downloaded once.")}</p>
          {suggestion.model
            ? <button type="button" className="btn small" onClick={() => set({ model: suggestion.model! })}>{t("Use {model}", { model: t(modelName(suggestion.model)) })}</button>
            : <button type="button" className="btn small" onClick={() => onOpenSettings?.("Transcription")}>{t("Download in Settings")}</button>}
        </div>
      )}
      <OptionRows eff={eff} set={set} status={status} models={models} found={found} speakers={liveSpeakers(project).length} onOpenSettings={onOpenSettings} />
      <div className="pv-sticky"><button type="button" className="btn sun pv-wide" disabled={!canTranscribe} onClick={onAskAgain}>{has ? t("Transcribe again…") : t("Transcribe")}</button></div>
    </div>
  );
}

type RowKey = "lang" | "model" | "speakers" | "extras" | "names";

/** Each setting as one row that shows its current value; a click opens that row's choices and closes the others, so the tab fits on one screen. */
function OptionRows({ eff, set, status, models, found, speakers, onOpenSettings }: { eff: Options; set(p: Partial<Options>): void; status: ModelStatus | null; models: Models; found: string; speakers: number; onOpenSettings?(section?: string): void }) {
  const t = useT();
  const [open, setOpen] = useState<RowKey | null>(null);
  const id = useId();
  const mode = langMode(eff);
  const range = eff.numSpeakers === "range";
  const n = Number(eff.numSpeakers);
  const translate = eff.translate ?? currentLang() === "en";
  const extras = [translate && (eff.translateTo && eff.translateTo !== "en" ? t("Translation into {language}", { language: langName(eff.translateTo) }) : t("English translation")), eff.verbatim && t("Write hesitations down"), eff.vad && t("Skip silence")].filter(Boolean).join(", ");
  const tag = WHISPER_MODELS.find((m) => m.id === eff.model)?.tag;
  const fields = { eff, set, status, models, found, onOpenSettings, advanced: true, bare: true };
  const rows: [RowKey, string, string, string, ReactNode][] = [
    ["lang", t("Languages"), mode === "one" ? langName(eff.language) : mode === "several" ? t("Several languages") : t("Detect automatically"), mode === "auto" && found ? t("Found: {found}.", { found }) : "", <LanguageField {...fields} />],
    ["model", t("Transcription model"), t(modelName(eff.model)), status && !status.whisper[eff.model] ? t("Not downloaded") : tag ? t(tag) : "", <ModelField {...fields} />],
    ["speakers", t("Speakers"), eff.noDiarize ? t("Transcript only") : range ? t("{min} to {max} speakers", { min: eff.minSpeakers ?? "2", max: eff.maxSpeakers ?? "4" }) : n > 0 ? (n === 1 ? t("{count} speaker", { count: n }) : t("{count} speakers", { count: n })) : t("Detect automatically"),
      !eff.noDiarize && !eff.numSpeakers && speakers > 0 ? t("Found {count} last time", { count: speakers }) : "",
      <><SpeakerCountField eff={eff} set={set} /><TranscriptOnlyField {...fields} /></>],
    ["extras", t("Extras"), extras || t("None"), "", <ExtrasField {...fields} />],
    ["names", t("Names and special words"), eff.prompt.trim() || t("None added"), "", <NamesField {...fields} />],
  ];
  return (
    <div className="pv-rows">
      {rows.map(([key, label, value, hint, body]) => (
        <div key={key} className={"pv-row" + (open === key ? " open" : "")}>
          <button type="button" className="pv-row-head" aria-expanded={open === key} aria-controls={open === key ? `${id}-${key}` : undefined} onClick={() => setOpen(open === key ? null : key)}>
            <span className="pv-row-label">{label}</span>
            <span className="pv-row-value">{value}</span>
            {hint && <span className="pv-row-hint">{hint}</span>}
            <svg className="pv-row-chev" viewBox="0 0 16 16" aria-hidden><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {open === key && <div className="pv-row-body" id={`${id}-${key}`}>{body}</div>}
        </div>
      ))}
    </div>
  );
}

function Info({ project }: { project: Project }) {
  const t = useT();
  const { result, meta, path } = project;
  const [size, setSize] = useState<number | null | undefined>(undefined);
  useEffect(() => { let live = true; window.api.fileSize(path).then((n) => { if (live) setSize(n); }).catch(() => { if (live) setSize(null); }); return () => { live = false; }; }, [path]);
  const g = globalOpts();
  const dir = path.replace(/[\\/][^\\/]*$/, "") || path;
  const live = liveSpeakers(project).length;
  const sep = path.includes("\\") ? "\\" : "/";
  const sidecar = `${dir}${sep}${baseName(path).replace(/\.[^.]+$/, "")}.transcript.json`;
  // [label, value, optional action]: a row with an action renders as a link that shows the file in the file manager
  const rows: [string, string, (() => void)?][] = [[t("Location"), dir, () => window.api.revealPath(path)], [t("File size"), size === undefined ? "…" : size === null ? t("Not found") : bytes(size)], [t("Length"), result ? fmt(result.duration) : "—"]];
  if (result) {
    const mix = Object.entries(meta?.languages ?? {}).sort((a, b) => b[1] - a[1]);
    const lang = mix.length > 1 ? mix.map(([c]) => langName(c)).join(", ") : langName(result.language);
    rows.push([t("Language"), mix.length < 2 && meta?.languageProb != null ? t("{language}, {percent}% sure", { language: lang, percent: Math.round(meta.languageProb * 100) }) : lang]);
    rows.push([t("Speakers"), t("{count} found", { count: live })]);
    rows.push([t("Models"), meta?.model ? `Whisper ${meta.model}${meta.speakerDevice ? " · pyannote 3.1" : ""}` : "—"]);
    rows.push([t("Finding speakers"), meta ? (meta.speakerDevice ? `${deviceName(meta.speakerDevice)}${meta.secondsSpeakers != null ? ` · ${secs(meta.secondsSpeakers, t)}` : ""}` : t("Skipped")) : "—"]);
    const x = meta?.secondsTranscribe ? ` (${t("{factor}× real time", { factor: (result.duration / Math.max(meta.secondsTranscribe, 0.1)).toFixed(0) })})` : "";
    rows.push([t("Transcribing"), meta?.device ? `${deviceName(meta.device)}${meta.secondsTranscribe != null ? ` · ${secs(meta.secondsTranscribe, t)}` : ""}${x}` : "—"]);
    rows.push([t("Saved next to audio"), g.autosave ? `${baseName(path).replace(/\.[^.]+$/, "")}.transcript.json` : t("Off"), g.autosave ? () => window.api.revealPath(sidecar) : undefined]);
  }
  rows.push([t("Added"), addedLabel(project.addedAt, t)]);
  return (
    <div className="pv-info">
      <div className="pv-info-name">{baseName(path)}</div>
      <dl>
        {rows.map(([k, v, act]) => <div key={k} className="pv-info-row"><dt>{k}</dt><dd>{act ? <button type="button" className="pv-info-link" onClick={act} title={t("Show in {app}", { app: FILE_MANAGER })} aria-label={t("{label}: {value}. Show in {app}", { label: k, value: v, app: FILE_MANAGER })}>{v}</button> : v}</dd></div>)}
      </dl>
      <button type="button" className="btn pv-wide" onClick={() => window.api.revealPath(path)}>{t("Show recording in {app}", { app: FILE_MANAGER })}</button>
    </div>
  );
}
