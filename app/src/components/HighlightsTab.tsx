import { sourceTime } from "../sourceLinks";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { Highlight, ModelStatus, PALETTE, Project, Summary, SummaryItem, bytes, displayName, fmt } from "../types";
import { scrollToTurn } from "../windowing";
import { setLlm, useLlm } from "./llmChoice";
import Hint from "../Hint";
import { useModels } from "./useModels";
import "../styles/project.css";

export type LlmJob = { kind: "highlights" | "summarize" | "ask"; fraction: number | null; message: string };
const FORMAT_KEY = "clipFormat";
const chosenFormat = () => { try { const f = localStorage.getItem(FORMAT_KEY); return f === "wav" || f === "m4a" ? f : "mp3"; } catch { return "mp3"; } };

interface Props {
  project: Project; visible: boolean;
  job: LlmJob | null; error: string;
  onSuggest(model: string): void; onSummarize(model: string): void; onStop(): void;
  onKeep(id: string): void; onRemove(id: string): void; onKeepAll(): void; onDismissAll(): void;
  onPlay(start: number, end: number): void; onSeek(start: number): void;
  onSaveClips(format: string): void; onSaveOne(h: Highlight): void; onEditSummary(text: string): void; onClearSummary(): void;
}

/** Grows the box to its text. A hidden tab measures 0, so it is measured again when the tab is shown. */
const fit = (el: HTMLTextAreaElement | null) => { if (el && el.offsetParent) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; } };

export default function HighlightsTab({ project, visible, job, error, onSuggest, onSummarize, onStop, onKeep, onRemove, onKeepAll, onDismissAll, onPlay, onSeek, onSaveClips, onSaveOne, onEditSummary, onClearSummary }: Props) {
  const t = useT();
  const { result, names } = project;
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [format, setFormat] = useState(chosenFormat);
  const [copied, setCopied] = useState(false);
  const alive = useRef(true);
  const sumBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { if (visible) fit(sumBox.current); }, [visible, project.result?.summary]);
  const refresh = useCallback(() => { window.api.models("status").then((r) => { if (alive.current && r) setStatus(r as unknown as ModelStatus); }).catch(() => {}); }, []);
  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);
  const models = useModels(refresh);
  const model = useLlm(status?.llm);
  if (!result) return <p className="note">{t("Highlights appear here once the recording is transcribed.")}</p>;

  const llm = status?.llm;
  const catalog = llm?.catalog ?? [];
  const have = !!llm?.models?.[model];
  const size = llm?.bytes?.[model];
  const all = result.highlights ?? [];
  const kept = all.filter((h) => !h.suggested), suggested = all.filter((h) => h.suggested);
  const running = !!job;
  const downloading = models.busy === `download llm-${model}`;
  const pct = models.dl?.fraction != null ? Math.round(models.dl.fraction * 100) : null;
  const summary: Summary | undefined = result.summary;
  const chooseFormat = (f: string) => { setFormat(f); try { localStorage.setItem(FORMAT_KEY, f); } catch { /* same */ } };
  const show = (start: number) => {
    const i = result.segments.findIndex((s) => start < s.end);
    void scrollToTurn(Math.max(0, i));
    onSeek(start);
  };
  // A decision or action item links to the line the model named. Summaries saved before that carry no line: those are matched by words (a clear match only).
  const itemText = (d: string | SummaryItem) => (typeof d === "string" ? d : d.text);
  const timeOf = (d: string | SummaryItem) => {
    const line = typeof d === "string" ? undefined : d.line;
    const seg = typeof line === "number" ? result.segments[line] : undefined;
    if (seg) return <><button type="button" className="pv-time" onClick={() => { void scrollToTurn(line as number); onSeek(seg.start); }} aria-label={t("Show the line at {time}", { time: fmt(seg.start) })}>▶ {fmt(seg.start)}</button>{" "}</>;
    if (line === undefined || (typeof line === "number" && !seg)) {
      const at = sourceTime(itemText(d), result.segments);
      if (at != null) return <><button type="button" className="pv-time" onClick={() => show(at)} aria-label={t("Show the line at {time}", { time: fmt(at) })}>{fmt(at)}</button>{" "}</>;
    }
    return <><span className="pv-flag pv-lang">{t("No source line")}</span>{" "}</>;
  };
  const who = (h: Highlight) => displayName(h.speaker, result.speakers, names);
  const progress = (label: string) => (
    <div className="pv-hl-job" role="status">
      <div className="prog st-prog" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job?.fraction != null ? Math.round(job.fraction * 100) : undefined}>
        <i className={job?.fraction == null ? "indet" : ""} style={job?.fraction == null ? undefined : { width: `${Math.round(job.fraction * 100)}%` }} />
      </div>
      <span className="note">{label}</span>
      <button type="button" className="btn quiet small" onClick={onStop}>{t("Stop")}</button>
    </div>
  );
  const copySummary = async () => {
    if (!summary) return;
    const text = [summary.summary, ...(summary.topics.length ? ["", ...summary.topics.map((x) => `${fmt(x.start)} ${x.title}`)] : []), ...(summary.decisions.length ? ["", ...summary.decisions.map((d) => `• ${itemText(d)}`)] : []),
      ...(summary.actions.length ? ["", ...summary.actions.map((a) => `☐ ${a.text}${a.owner ? ` (${a.owner})` : ""}`)] : [])].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };

  /** The one-time download of the language model, or a note when this build cannot run one. */
  const setup = !llm?.available ? (
    status ? <p className="note">{t("The language model is not part of this version of the app, so suggestions and summaries are not available. Highlighting by hand works.")}</p> : null
  ) : !have && (
    <div className="pv-hl-setup">
      <p className="note">{t("Suggestions and summaries are written by a language model that runs on this computer. Nothing is sent anywhere. It needs a one-time download of {size}.", { size: bytes(size ?? 0) })}</p>
      {downloading ? (
        <div className="pv-hl-job" role="status">
          <div className="prog st-prog" role="progressbar" aria-label={t("Language model download progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}><i className={pct == null ? "indet" : ""} style={pct == null ? undefined : { width: `${pct}%` }} /></div>
          <span className="note">{models.dl?.message || t("Downloading…")}</span>
          <button type="button" className="btn quiet small" onClick={models.cancel}>{t("Cancel")}</button>
        </div>
      ) : (
        <button type="button" className="btn small" disabled={!!models.busy} onClick={() => models.run("download", `llm-${model}`, size)}>{t("Download the language model ({size})", { size: bytes(size ?? 0) })}</button>
      )}
      {models.errInfo && <div className="alert err" role="alert"><span><b>{models.errInfo.title}</b> {models.errInfo.body}</span></div>}
    </div>
  );

  return (
    <div className="pv-col pv-hl">
      <section aria-labelledby="hl-title">
        <div className="pv-hl-titlerow"><h3 id="hl-title">{t("Highlights")}</h3><span className="note">{t("{count} kept", { count: kept.length })}</span></div>
        <Hint id="highlights">{t("Select words in the transcript and choose “Highlight this passage”, or let the language model suggest some. Use them for soundbites, quotes and show notes.")}</Hint>
        {llm?.available && (
          <label className="field">{t("Language model")}
            <select className="input" value={model} onChange={(e) => setLlm(e.target.value)} disabled={running}>
              {catalog.map(({ id, label }) => <option key={id} value={id}>{label}{llm.models?.[id] ? " ✓" : ` (${bytes(llm.bytes?.[id] ?? 0)})`}</option>)}
            </select>
          </label>
        )}
        {setup}
        {llm?.available && have && (running && job?.kind === "highlights" ? progress(t("Reading the transcript…")) : (
          <button type="button" className="btn sun small pv-hl-go" disabled={running} onClick={() => onSuggest(model)}>{suggested.length ? t("Suggest again") : t("Suggest highlights")}</button>
        ))}
        {error && !running && <div className="alert err" role="alert"><span>{error}</span></div>}

        {suggested.length > 0 && (
          <div className="pv-hl-bulk" role="group" aria-label={t("Suggestions")}>
            <b>{suggested.length === 1 ? t("1 suggestion to check") : t("{count} suggestions to check", { count: suggested.length })}</b>
            <button type="button" className="btn small" onClick={onKeepAll}>{t("Keep all")}</button>
            <button type="button" className="btn quiet small" onClick={onDismissAll}>{t("Dismiss all")}</button>
          </div>
        )}
        {all.length === 0 ? <p className="note pv-hl-empty">{t("No highlights yet.")}</p> : (
          <ul className="pv-hl-list">
            {all.map((h) => (
              <li key={h.id} className={"card pv-hl-item" + (h.suggested ? " sug" : "")}>
                <div className="pv-hl-head">
                  <span className="sw" style={{ background: PALETTE[Math.max(0, result.speakers.indexOf(h.speaker)) % PALETTE.length] }} aria-hidden />
                  <b>{who(h)}</b>
                  <button type="button" className="pv-time" onClick={() => show(h.start)} title={t("Show in the transcript")} aria-label={t("Show the highlight at {time} in the transcript", { time: fmt(h.start) })}>{fmt(h.start)}</button>
                  {h.suggested && <span className="pv-flag pv-lang" title={t("Suggested by the language model")}>{t("Suggested")}</span>}
                </div>
                <p className="pv-hl-text">“{h.text}”</p>
                {h.reason && <p className="note">{h.reason}</p>}
                <div className="pv-hl-acts">
                  {/* One primary per state (Keep / Play); every other action shares the plain outlined style. */}
                  {h.suggested ? (
                    <button type="button" className="btn sun small" onClick={() => onKeep(h.id)}>{t("Keep")}</button>
                  ) : (
                    <button type="button" className="btn sun small" onClick={() => onPlay(h.start, h.end)} aria-label={t("Play the highlight at {time}", { time: fmt(h.start) })}>{t("Play")}</button>
                  )}
                  {h.suggested && <button type="button" className="btn small" onClick={() => onPlay(h.start, h.end)} aria-label={t("Play the highlight at {time}", { time: fmt(h.start) })}>{t("Play")}</button>}
                  {h.suggested ? (
                    <button type="button" className="btn small" onClick={() => onRemove(h.id)}>{t("Dismiss")}</button>
                  ) : (
                    <>
                      <button type="button" className="btn small" onClick={() => onSaveOne(h)} aria-label={t("Save the highlight at {time} as an audio clip", { time: fmt(h.start) })} title={t("Save only this highlight as an audio file")}>{t("Save clip")}</button>
                      <button type="button" className="btn small" onClick={() => onRemove(h.id)} aria-label={t("Remove the highlight at {time}", { time: fmt(h.start) })}>{t("Remove")}</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {kept.length > 0 && (
          <div className="pv-hl-clips">
            <label className="field">{t("Audio clips as")}
              <select className="input" value={format} onChange={(e) => chooseFormat(e.target.value)}>
                <option value="mp3">MP3</option><option value="m4a">M4A</option><option value="wav">WAV</option>
              </select>
            </label>
            <button type="button" className="btn small" onClick={() => onSaveClips(format)} title={t("Save every kept highlight as its own audio file in a folder you choose")}>{kept.length === 1 ? t("Save 1 audio clip…") : t("Save {count} audio clips…", { count: kept.length })}</button>
            <p className="note">{t("The text of the highlights is in Export, under “Highlights and marked lines”.")}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="sum-title" className="pv-sum">
        <div className="pv-hl-titlerow"><h3 id="sum-title">{t("Summary")}</h3></div>
        <Hint id="summary">{t("A short summary with topics, decisions and tasks. It goes into the meeting minutes when you export them.")}</Hint>
        {llm?.available && have && (running && job?.kind === "summarize" ? progress(t("Writing the summary…")) : (
          <button type="button" className={"btn small pv-hl-go" + (summary ? "" : " sun")} disabled={running} onClick={() => onSummarize(model)}>{summary ? t("Write it again") : t("Write a summary")}</button>
        ))}
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
