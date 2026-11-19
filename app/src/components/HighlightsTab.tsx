import { useState } from "react";
import { useT } from "../i18n";
import { Highlight, PALETTE, Project, displayName, fmt } from "../types";
import { revealTurn } from "../windowing";
import { JobProgress, LlmSetup, useLlmSetup } from "./LlmSetup";
import Hint from "../Hint";
import "../styles/project.css";

export type LlmJob = { kind: "highlights" | "summarize" | "ask"; fraction: number | null; message: string };
const FORMAT_KEY = "clipFormat";
const chosenFormat = () => { try { const f = localStorage.getItem(FORMAT_KEY); return f === "wav" || f === "m4a" ? f : "mp3"; } catch { return "mp3"; } };

interface Props {
  project: Project; visible: boolean;
  /** The highlight range being played right now (null when nothing plays) and the playhead time. */
  clip: { start: number; end: number } | null; time: number;
  job: LlmJob | null; error: string;
  onSuggest(model: string): void; onStop(): void;
  onKeep(id: string): void; onRemove(id: string): void; onKeepAll(): void; onDismissAll(): void;
  onPlay(start: number, end: number): void; onPause(): void; onSeek(start: number): void;
  /** The highlight whose ends are shown as drag handles on the waveform (null = none), and moving one of its ends by a word or a fine step. */
  trimId: string | null; onTrim(id: string | null): void; onAdjust(id: string, edge: "start" | "end", by: "word" | "fine", dir: -1 | 1): void;
  onSaveClips(format: string): void; onSaveOne(h: Highlight): void;
}

export default function HighlightsTab({ project, visible, clip, time, job, error, onSuggest, onStop, onKeep, onRemove, onKeepAll, onDismissAll, onPlay, onPause, onSeek, trimId, onTrim, onAdjust, onSaveClips, onSaveOne }: Props) {
  const t = useT();
  const { result, names } = project;
  const [format, setFormat] = useState(chosenFormat);
  const setup = useLlmSetup(visible);
  const { model, llm, have } = setup;
  if (!result) return <p className="note">{t("Highlights appear here once the recording is transcribed.")}</p>;

  const all = result.highlights ?? [];
  const kept = all.filter((h) => !h.suggested), suggested = all.filter((h) => h.suggested);
  const running = !!job;
  const chooseFormat = (f: string) => { setFormat(f); try { localStorage.setItem(FORMAT_KEY, f); } catch { /* same */ } };
  const show = (start: number) => {
    const i = result.segments.findIndex((s) => start < s.end);
    void revealTurn(Math.max(0, i));
    onSeek(start);
  };
  const who = (h: Highlight) => displayName(h.speaker, result.speakers, names);

  return (
    <div className="pv-col pv-hl">
      <section aria-labelledby="hl-title">
        <div className="pv-hl-titlerow"><h3 id="hl-title">{t("Highlights")}</h3><span className="note">{t("{count} kept", { count: kept.length })}</span></div>
        <Hint id="highlights">{t("Select words in the transcript and choose “Highlight this passage”, or let the language model suggest some. Use them for soundbites, quotes and show notes.")}</Hint>
        <LlmSetup s={setup} running={running} />
        {llm?.available && have && (running && job?.kind === "highlights" ? <JobProgress job={job} label={t("Reading the transcript…")} onStop={onStop} /> : (
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
            {all.map((h) => {
              // Playing: this card's range is the one being played and the playhead is still inside it (the pause timer may lag a moment).
              const on = !!clip && clip.start === h.start && clip.end === h.end && time <= h.end + 0.6;
              const frac = on ? Math.min(1, Math.max(0, (time - h.start) / Math.max(0.1, h.end - h.start))) : 0;
              const playBtn = (cls: string) => on ? (
                <button type="button" className={cls} onClick={onPause} aria-label={t("Pause the highlight at {time}", { time: fmt(h.start) })}>{t("Pause")}</button>
              ) : (
                <button type="button" className={cls} onClick={() => onPlay(h.start, h.end)} aria-label={t("Play the highlight at {time}", { time: fmt(h.start) })}>{t("Play")}</button>
              );
              return (
              <li key={h.id} className={"card pv-hl-item" + (h.suggested ? " sug" : "") + (on ? " playing" : "")} onClick={(e) => { // a click on the card itself (not a button, field or selected text) shows its passage
                if (!(e.target as HTMLElement).closest("button, a, input, select, textarea") && !window.getSelection()?.toString()) show(h.start);
              }}>
                {on && <span className="pv-hl-fill" aria-hidden style={{ width: `${Math.round(frac * 100)}%` }} />}
                {on && <span className="pv-sr" role="status" aria-live="polite">{t("Playing the highlight at {time}", { time: fmt(h.start) })}</span>}
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
                    playBtn("btn sun small")
                  )}
                  {h.suggested && playBtn("btn small")}
                  <button type="button" className="btn small" aria-pressed={trimId === h.id} onClick={() => onTrim(trimId === h.id ? null : h.id)} title={t("Show handles on the waveform, or use the buttons, to start and end this highlight earlier or later")}>{t("Trim")}</button>
                  {h.suggested ? (
                    <button type="button" className="btn small" onClick={() => onRemove(h.id)}>{t("Dismiss")}</button>
                  ) : (
                    <>
                      <button type="button" className="btn small" onClick={() => onSaveOne(h)} aria-label={t("Save the highlight at {time} as an audio clip", { time: fmt(h.start) })} title={t("Save only this highlight as an audio file")}>{t("Save clip")}</button>
                      <button type="button" className="btn small" onClick={() => onRemove(h.id)} aria-label={t("Remove the highlight at {time}", { time: fmt(h.start) })}>{t("Remove")}</button>
                    </>
                  )}
                </div>
                {trimId === h.id && (
                  <div className="pv-hl-trim" role="group" aria-label={t("Trim the highlight at {time}", { time: fmt(h.start) })}>
                    <p className="note">{t("Drag the handles on the waveform, or use the buttons. Shift-click moves by a tenth of a second.")}</p>
                    {(["start", "end"] as const).map((edge) => (
                      <div key={edge} className="pv-hl-trimrow">
                        <span>{edge === "start" ? t("Start") : t("End")} <span dir="ltr">{fmt(edge === "start" ? h.start : h.end)}</span></span>
                        {([-1, 1] as const).map((dir) => (
                          <button key={dir} type="button" className="btn small" onClick={(e) => onAdjust(h.id, edge, e.shiftKey ? "fine" : "word", dir)}
                            aria-label={edge === "start" ? (dir < 0 ? t("Start one word earlier") : t("Start one word later")) : (dir < 0 ? t("End one word earlier") : t("End one word later"))}>{dir < 0 ? t("Earlier") : t("Later")}</button>
                        ))}
                        {([-1, 1] as const).map((dir) => (
                          <button key={"f" + dir} type="button" className="btn quiet small" onClick={() => onAdjust(h.id, edge, "fine", dir)}
                            aria-label={edge === "start" ? (dir < 0 ? t("Start 0.1 seconds earlier") : t("Start 0.1 seconds later")) : (dir < 0 ? t("End 0.1 seconds earlier") : t("End 0.1 seconds later"))}>{dir < 0 ? "−0.1 s" : "+0.1 s"}</button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </li>
              );
            })}
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
    </div>
  );
}
