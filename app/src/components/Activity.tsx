import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/shell.css";
import { currentLang, t, useT } from "../i18n";

export interface LogLine { t: number; level: string; message: string }
export interface Live { label: string; fraction: number | null; message: string; since: number }

const langName = (c: string) => (c === "de" ? t("German") : c === "en" ? t("English") : c === "fr" ? t("French") : c === "es" ? t("Spanish") : c);
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const secs = (ms: number) => (ms < 60000 ? `${Math.floor(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`);

/** Turn an engine log line into a sentence a person would want to read, or null if it is only technical detail. */
function friendly(l: LogLine): { text: string; kind: "ok" | "error" | "warn" } | null {
  const m = l.message; let r: RegExpMatchArray | null;
  if (l.level === "error") return { text: m, kind: "error" };
  if (l.level === "warn") return { text: m, kind: "warn" };
  if ((r = m.match(/Speaker model loaded \(device=(\w+)/))) return { text: r[1] === "mps" ? t("Speaker detection ran on the Apple GPU.") : r[1] === "cuda" ? t("Speaker detection ran on the NVIDIA GPU.") : t("Speaker detection ran on the CPU."), kind: "ok" };
  if ((r = m.match(/Found (\d+) speaker\(s\).*\(([\d.]+)s\)/))) return { text: r[1] === "1" ? t("Found 1 speaker in {sec} seconds.", { sec: r[2] }) : t("Found {n} speakers in {sec} seconds.", { n: r[1], sec: r[2] }), kind: "ok" };
  if ((r = m.match(/Language: (\w+) .*(auto-detected|forced)/))) return { text: r[2] === "forced" ? t("Language: {language} (your choice).", { language: langName(r[1]) }) : t("Language: {language} (detected automatically).", { language: langName(r[1]) }), kind: "ok" };
  if ((r = m.match(/Transcribed (\d+) words in ([\d.]+)s/))) return { text: t("Wrote down {n} words in {sec} seconds.", { n: r[1], sec: r[2] }), kind: "ok" };
  if ((r = m.match(/Saved transcript next to the audio: (.+)$/))) return { text: t("Saved the transcript next to the audio: {file}", { file: r[1].split(/[\\/]/).pop() ?? "" }), kind: "ok" };
  if ((r = m.match(/Finished (.+?)\./))) return { text: t("Downloaded {file}. It now works offline.", { file: r[1].split("/").pop() ?? "" }), kind: "ok" };
  if (/Speaker detection is OFF/.test(m)) return { text: t("Speaker detection was off, so this is a plain transcript."), kind: "ok" };
  if (/^Cancelled$/.test(m)) return { text: t("Cancelled."), kind: "warn" };
  return null;
}

interface Props { lines: LogLine[]; live: Live | null; /** True while a download is still missing: the pill must not claim "Ready". */ setupNeeded?: boolean; onClear(): void; /** Opens Settings, Privacy from the popover. */ onOpenPrivacy?(): void }

export default function Activity({ lines, live, setupNeeded = false, onClear, onOpenPrivacy }: Props) {
  const t = useT();
  const lang = currentLang();
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const box = useRef<HTMLDivElement>(null);
  const pillBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!live) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [live]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); pillBtn.current?.focus(); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", esc); };
  }, [open]);

  const events = useMemo(() => lines.flatMap((l) => { const f = friendly(l); return f ? [{ ...f, t: l.t }] : []; }).reverse(), [lines, lang]);
  const hasError = events.length > 0 && events[0].kind === "error";
  const pct = live?.fraction != null ? ` · ${Math.round(live.fraction * 100)}%` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.map((l) => `${clock(l.t)} [${l.level}] ${l.message}`).join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="act" ref={box}>
      <button type="button" ref={pillBtn} className={"pill" + (live ? " live" : hasError ? " bad" : "")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}
        title={t("The app works offline and your files never leave this computer. Click to see recent activity.")}>
        <span className="dot" aria-hidden />
        <span className="pill-label">{live ? <>{live.label}{pct}</> : hasError ? t("Something went wrong") : setupNeeded ? t("Setup unfinished") : t("Ready · nothing leaves this computer")}</span>
        <svg className="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="ac-pop" role="dialog" aria-label={t("Activity")}>
          <h4>
            <span className="grow">{t("Activity")}</span>
            <button type="button" className="btn quiet small" onClick={onClear} aria-label={t("Clear the activity list")} disabled={lines.length === 0}>{t("Clear list")}</button>
            <button type="button" className="btn icon quiet small" onClick={() => { setOpen(false); pillBtn.current?.focus(); }} aria-label={t("Close activity")}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </h4>
          <p className="muted small" style={{ margin: "0 0 8px" }}>{t("Works offline. Your files and transcripts stay on this computer.")}{onOpenPrivacy && <> <button type="button" className="linkish" onClick={() => { setOpen(false); onOpenPrivacy(); }}>{t("What is stored where")}</button></>}</p>
          <div className="ac-events">
            {live && <div className="ac-ev now"><i className="g" /><div className="grow"><p><b>{live.label}</b>{live.message ? `. ${live.message}` : ""}</p>
              {live.fraction != null && <div className="prog thin" role="progressbar" aria-label={live.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(live.fraction * 100)}><i style={{ width: `${Math.round(live.fraction * 100)}%` }} /></div>}
              <small>{t("Running for {time}", { time: secs(now - live.since) })}</small></div></div>}
            {events.length === 0 && !live && <div className="ac-ev"><p className="muted">{t("Nothing to show. New activity appears here.")}</p></div>}
            {events.map((e, i) => <div key={i} className={"ac-ev " + e.kind}><i className="g" /><div><p>{e.text}</p><small>{clock(e.t)}</small></div></div>)}
          </div>
          {tech && <div className="ac-tech" tabIndex={0} role="region" aria-label={t("Technical details")}>{lines.length === 0 ? t("No technical output yet.") : lines.map((l, i) => <div key={i} className={l.level}><time>{clock(l.t)}</time> {l.message}</div>)}</div>}
          <div className="ac-foot">
            <button type="button" className="btn quiet small" aria-expanded={tech} onClick={() => setTech(!tech)}>
              <svg className="i chev-r" style={{ transform: tech ? "rotate(90deg)" : undefined }} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>{t("Technical details")}
            </button>
            <span className="grow" />
            <button type="button" className="btn small" onClick={copy} disabled={lines.length === 0}>{copied ? t("Copied") : t("Copy list")}</button>
            <button type="button" className="btn small" onClick={() => window.api.reveal("log")}>{t("Open log file")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
