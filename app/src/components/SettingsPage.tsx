import { useState } from "react";
import { ModelStatus, Options } from "../types";
import { useT } from "../i18n";
import { Models } from "./useModels";
import DisplaySection from "./settings/DisplaySection";
import LanguageSection from "./settings/LanguageSection";
import PerformanceSection from "./settings/PerformanceSection";
import PrivacySection from "./settings/PrivacySection";
import SavingSection from "./settings/SavingSection";
import StorageSection from "./settings/StorageSection";
import "../styles/settings.css";

interface Props { opts: Options; set(o: Options): void; status: ModelStatus | null; models: Models; onBack(): void; initialSection?: string }
export const SETTINGS_SECTIONS = ["Storage and models", "Language", "Display", "Saving", "Privacy", "Performance"] as const;
const SECTIONS = SETTINGS_SECTIONS;
type Section = (typeof SECTIONS)[number];

export default function SettingsPage({ opts, set, status, models, onBack, initialSection }: Props) {
  const t = useT();
  const [section, setSection] = useState<Section>((SECTIONS as readonly string[]).includes(initialSection ?? "") ? (initialSection as Section) : "Storage and models");
  return (
    <div className="st-root">
      <nav className="side" aria-label={t("Settings sections")}>
        <button type="button" className="btn back" onClick={onBack}>
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>{t("Back to projects")}
        </button>
        <div className="group">{t("Settings")}</div>
        {SECTIONS.map((s) => (
          <button key={s} type="button" className={"nav" + (s === section ? " on" : "")} aria-current={s === section ? "page" : undefined} onClick={() => setSection(s)}>
            <span><b>{t(s)}</b></span>
          </button>
        ))}
      </nav>
      <main className="main">
        <header className="tool"><div className="titles"><h1>{t(section)}</h1></div></header>
        <div className="st-scroll">
          <div className={"st-col" + (section === "Storage and models" ? " wide" : "")}>
            {section === "Performance" && <PerformanceSection opts={opts} set={set} status={status} models={models} />}
            {section === "Storage and models" && <StorageSection opts={opts} status={status} models={models} onGoTo={(s) => (SECTIONS as readonly string[]).includes(s) && setSection(s as Section)} />}
            {section === "Saving" && <SavingSection opts={opts} set={set} />}
            {section === "Display" && <DisplaySection opts={opts} set={set} />}
            {section === "Language" && <LanguageSection opts={opts} set={set} />}
            {section === "Privacy" && <PrivacySection models={models} />}
          </div>
        </div>
      </main>
    </div>
  );
}
