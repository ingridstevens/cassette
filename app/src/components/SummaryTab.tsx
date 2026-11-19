import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { Project, Summary, SummaryItem, fmt } from "../types";
import { sourceTime } from "../sourceLinks";
import { revealTurn } from "../windowing";
import Hint from "../Hint";
import { JobProgress, LlmSetup, useLlmSetup } from "./LlmSetup";
import type { LlmJob } from "./HighlightsTab";
import "../styles/project.css";

interface Props {
  project: Project; visible: boolean; job: LlmJob | null; error: string;
  onSummarize(model: string): void; onStop(): void; onSeek(start: number): void; onEditSummary(text: string): void; onClearSummary(): void;
}

/** Grows the box to its text. A hidden tab measures 0, so it is measured again when the tab is shown. */
const fit = (el: HTMLTextAreaElement | null) => { if (el && el.offsetParent) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; } };

export default function SummaryTab({ project, visible, job, error, onSummarize, onStop, onSeek, onEditSummary, onClearSummary }: Props) {
  const t = useT();
  const { result } = project;
  const [copied, setCopied] = useState(false);
  const sumBox = useRef<HTMLTextAreaElement>(null);
  const setup = useLlmSetup(visible);
  const { model, llm, have } = setup;
  useEffect(() => { if (visible) fit(sumBox.current); }, [visible, project.result?.summary]);
  if (!result) return <p className="note">{t("The summary appears here once the recording is transcribed.")}</p>;

  const running = !!job;
  const summary: Summary | undefined = result.summary;
  const show = (start: number) => {
    const i = result.segments.findIndex((s) => start < s.end);
    void revealTurn(Math.max(0, i));
    onSeek(start);
  };
  // A decision or action item links to the line the model named. Summaries saved before that carry no line: those are matched by words (a clear match only).
  const itemText = (d: string | SummaryItem) => (typeof d === "string" ? d : d.text);
  const timeOf = (d: string | SummaryItem) => {
    const line = typeof d === "string" ? undefined : d.line;
    const seg = typeof line === "number" ? result.segments[line] : undefined;
    if (seg) return <><button type="button" className="pv-time" onClick={() => { void revealTurn(line as number); onSeek(seg.start); }} aria-label={t("Show the line at {time}", { time: fmt(seg.start) })}>▶ {fmt(seg.start)}</button>{" "}</>;
    if (line === undefined || (typeof line === "number" && !seg)) {
      const at = sourceTime(itemText(d), result.segments);
      if (at != null) return <><button type="button" className="pv-time" onClick={() => show(at)} aria-label={t("Show the line at {time}", { time: fmt(at) })}>{fmt(at)}</button>{" "}</>;
    }
    return <><span className="pv-flag pv-lang">{t("No source line")}</span>{" "}</>;
  };
  const copySummary = async () => {
    if (!summary) return;
    const text = [summary.summary, ...(summary.topics.length ? ["", ...summary.topics.map((x) => `${fmt(x.start)} ${x.title}`)] : []), ...(summary.decisions.length ? ["", ...summary.decisions.map((d) => `• ${itemText(d)}`)] : []),
      ...(summary.actions.length ? ["", ...summary.actions.map((a) => `☐ ${a.text}${a.owner ? ` (${a.owner})` : ""}`)] : [])].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="pv-col pv-hl">
      <section aria-labelledby="sum-title">
        <div className="pv-hl-titlerow"><h3 id="sum-title">{t("Summary")}</h3></div>
        <Hint id="summary">{t("A short summary with topics, decisions and tasks. It goes into the meeting minutes when you export them.")}</Hint>
        <LlmSetup s={setup} running={running} />
        {llm?.available && have && (running && job?.kind === "summarize" ? <JobProgress job={job} label={t("Writing the summary…")} onStop={onStop} /> : (
          <button type="button" className={"btn small pv-hl-go" + (summary ? "" : " sun")} disabled={running} onClick={() => onSummarize(model)}>{summary ? t("Write it again") : t("Write a summary")}</button>
        ))}
        {error && !running && <div className="alert err" role="alert"><span>{error}</span></div>}
        {summary && (
          <div className="pv-sum-body">
            <label className="field">{t("Summary")}
              <textarea className="input" rows={3} defaultValue={summary.summary} key={summary.at ?? 0} ref={(el) => { sumBox.current = el; fit(el); }} onInput={(e) => fit(e.currentTarget)} onBlur={(e) => { if (e.target.value !== summary.summary) onEditSummary(e.target.value); }} />
            </label>
            {summary.topics.length > 0 && (
              <>
                <h4>{t("Topics")}</h4>
                <ul className="pv-sum-list">{summary.topics.map((x, i) => <li key={i}><button type="button" className="pv-time" onClick={() => show(x.start)} aria-label={t("Play from {time}", { time: fmt(x.start) })}>{fmt(x.start)}</button> {x.title}</li>)}</ul>
              </>
            )}
            {summary.decisions.length > 0 && (<><h4>{t("Decisions")}</h4><ul className="pv-sum-list">{summary.decisions.map((d, i) => <li key={i}>{timeOf(d)}{itemText(d)}</li>)}</ul></>)}
            {summary.actions.length > 0 && (<><h4>{t("Action items")}</h4><ul className="pv-sum-list">{summary.actions.map((a, i) => <li key={i}>{timeOf(a)}{a.text}{a.owner ? <span className="note"> · {a.owner}</span> : null}</li>)}</ul></>)}
            <p className="note">{t("Written by a language model on this computer. Check it before you share it.")}</p>
            {(summary.decisions.length > 0 || summary.actions.length > 0) && <p className="note">{t("A time next to a decision or action item is the closest matching line. Check that it says what the summary says.")}</p>}
            <div className="pv-hl-acts">
              <button type="button" className="btn small" onClick={copySummary}>{copied ? t("Copied ✓") : t("Copy")}</button>
              <button type="button" className="btn quiet small" onClick={onClearSummary}>{t("Remove")}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
