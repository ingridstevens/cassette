import { useEffect, useRef, useState } from "react";
import { ModelStatus, Options } from "../types";
import { useT } from "../i18n";
import { Models } from "./useModels";
import AboutSection from "./settings/AboutSection";
import AdvancedSection from "./settings/AdvancedSection";
import OverviewSection from "./settings/OverviewSection";
import PrivacySection from "./settings/PrivacySection";
import SavingSection from "./settings/SavingSection";
import SpeakersSection from "./settings/SpeakersSection";
import SummariesSection from "./settings/SummariesSection";
import TextLanguageSection from "./settings/TextLanguageSection";
import TranscriptionSection from "./settings/TranscriptionSection";
import "../styles/settings.css";

interface Props { opts: Options; set(o: Options): void; status: ModelStatus | null; models: Models; onBack(): void; onReset(): void; initialSection?: string }
export const SETTINGS_SECTIONS = ["Overview", "Transcription", "Speakers", "Summaries and translation", "Saving and export", "Text and language", "Privacy", "Advanced", "About"] as const;
type Section = (typeof SETTINGS_SECTIONS)[number];
/** Names from before the redesign still open the right page. */
const LEGACY: Record<string, Section> = { "Storage and models": "Transcription", "Models for each job": "Transcription", Language: "Text and language", Display: "Text and language", Saving: "Saving and export", Performance: "Advanced" };
const GROUPS: [string, Section[]][] = [["Jobs", ["Overview", "Transcription", "Speakers", "Summaries and translation"]], ["App", ["Saving and export", "Text and language", "Privacy", "Advanced"]]];

export default function SettingsPage({ opts, set, status, models, onBack, onReset, initialSection }: Props) {
  const t = useT();
  const start = (SETTINGS_SECTIONS as readonly string[]).includes(initialSection ?? "") ? (initialSection as Section) : initialSection ? LEGACY[initialSection] ?? "Overview" : "Overview";
  const [section, setSection] = useState<Section>(start);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [live, setLive] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => { if (moved.current) title.current?.focus(); moved.current = true; }, [section]);

  /** Show a message under the page and read it out. A message with `undo` gets an Undo button. */
  const say = (msg: string, undo?: () => void) => { setToast({ msg, undo }); setLive(""); window.setTimeout(() => setLive(msg), 50); };
  const go = (s: string) => { const next = (SETTINGS_SECTIONS as readonly string[]).includes(s) ? (s as Section) : LEGACY[s]; if (!next) return; setToast(null); setQ(""); setSection(next); };

  const index: [string, Section][] = [
    [t("Model in use"), "Transcription"], [t("Engine: Whisper, Parakeet, Moonshine"), "Transcription"], [t("Delete a model"), "Transcription"], [t("Use a models folder"), "Transcription"], [t("Language of recordings"), "Transcription"],
    [t("Speaker detection and Hugging Face token"), "Speakers"], [t("Summary model"), "Summaries and translation"], [t("Translation model"), "Summaries and translation"],
    [t("Backup copy"), "Saving and export"], [t("Text size"), "Text and language"], [t("Language of the app"), "Text and language"], [t("Light or dark"), "Text and language"], [t("High contrast"), "Text and language"], [t("Colour mood"), "Text and language"], [t("Keyboard shortcuts"), "Text and language"],
    [t("Every network call"), "Privacy"], [t("What is stored where"), "Privacy"], [t("Hugging Face token"), "Privacy"], [t("Activity log"), "Privacy"],
    [t("Processor (CPU or Apple GPU)"), "Advanced"], [t("Language checker"), "Advanced"], [t("Models folder"), "Advanced"], [t("Copy diagnostics"), "Advanced"], [t("Reset all settings"), "Advanced"], [t("Version and licence"), "About"],
  ];
  const needle = q.trim().toLowerCase();
  const hits = needle ? index.filter(([l, s]) => (l + " " + t(s)).toLowerCase().includes(needle)) : [];

  const props = { opts, set, status, models, onGoTo: go, say, onReset };
  const navBtn = (s: Section) => (
    <li key={s}><button type="button" className="nav" aria-current={s === section ? "page" : undefined} onClick={() => go(s)}><span><b>{t(s)}</b></span></button></li>
  );
  return (
    <div className="st-root">
      <nav className="side" aria-label={t("Settings sections")}>
        <button type="button" className="btn back" onClick={onBack}>
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>{t("Back to projects")}
        </button>
        <div className="st-search">
          <label htmlFor="st-q" className="st-sr">{t("Search settings")}</label>
          <input id="st-q" className="input" type="search" placeholder={t("Search settings")} value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) go(hits[0][1]); }} />
        </div>
        {needle ? (
          <>
            <h2 className="group" id="st-g-res">{t("Results")}</h2>
            {hits.length ? <ul className="st-navl" aria-labelledby="st-g-res">{hits.map(([l, s]) => <li key={l}><button type="button" className="nav hit" onClick={() => go(s)}><span><b>{l}</b><small>{t(s)}</small></span></button></li>)}</ul>
              : <p className="note st-noresult" role="status">{t("Nothing matches “{text}”.", { text: q })}</p>}
          </>
        ) : GROUPS.map(([g, items], i) => (
          <div key={g}><h2 className="group" id={"st-g-" + i}>{t(g)}</h2><ul className="st-navl" aria-labelledby={"st-g-" + i}>{items.map(navBtn)}</ul></div>
        ))}
        <ul className="st-navl st-foot">
          <li><button type="button" className="nav" aria-current={section === "About" ? "page" : undefined} onClick={() => go("About")}><span><b>{t("Version {version} · About", { version: __APP_VERSION__ })}</b></span></button></li>
        </ul>
      </nav>
      <main className="main">
        <header className="tool"><div className="titles"><h1 ref={title} tabIndex={-1}>{t(section)}</h1></div></header>
        <div className="st-scroll">
          <div className="st-col">
            {section === "Overview" && <OverviewSection {...props} />}
            {section === "Transcription" && <TranscriptionSection {...props} />}
            {section === "Speakers" && <SpeakersSection {...props} />}
            {section === "Summaries and translation" && <SummariesSection {...props} />}
            {section === "Saving and export" && <SavingSection opts={opts} set={set} />}
            {section === "Text and language" && <TextLanguageSection {...props} />}
            {section === "Privacy" && <PrivacySection models={models} />}
            {section === "Advanced" && <AdvancedSection {...props} />}
            {section === "About" && <AboutSection />}
            {toast && (
              <div className="st-toast">
                <span>{toast.msg}</span>
                {toast.undo && <button type="button" className="btn small" onClick={() => { toast.undo!(); setToast(null); say(t("Undone.")); }}>{t("Undo")}</button>}
                <button type="button" className="btn small quiet" onClick={() => setToast(null)}>{t("Dismiss")}</button>
              </div>
            )}
          </div>
        </div>
      </main>
      <div className="st-sr" role="status" aria-live="polite" aria-atomic="true">{live}</div>
    </div>
  );
}
