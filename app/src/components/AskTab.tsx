import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { ModelStatus, Project, bytes, displayName, fmt } from "../types";
import { LlmJob } from "./HighlightsTab";
import { setLlm, useLlm } from "./llmChoice";
import { useModels } from "./useModels";
import "../styles/project.css";

/** One question and what came back: `answer` is missing while the model is working, `error` is set when it could not answer. */
export interface AskItem { id: number; q: string; answer?: { text: string; sources: number[]; used: number; total: number }; error?: string }

interface Props {
  project: Project; visible: boolean; thread: AskItem[]; job: LlmJob | null;
  onAsk(question: string, model: string): void; onStop(): void; onClear(): void; onShow(line: number): void;
}

/** The model's answer as paragraphs and bullet lists (it is asked to start list items with "- "). */
function AnswerText({ text }: { text: string }) {
  const blocks: { list: boolean; rows: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const row = raw.trim();
    if (!row) continue;
    const item = /^[-•*]\s+/.test(row);
    const last = blocks[blocks.length - 1];
    if (item && last?.list) last.rows.push(row.replace(/^[-•*]\s+/, ""));
    else blocks.push({ list: item, rows: [item ? row.replace(/^[-•*]\s+/, "") : row] });
  }
  return <>{blocks.map((b, i) => (b.list ? <ul key={i}>{b.rows.map((r, j) => <li key={j}>{r}</li>)}</ul> : <p key={i}>{b.rows.join(" ")}</p>))}</>;
}

export default function AskTab({ project, visible, thread, job, onAsk, onStop, onClear, onShow }: Props) {
  const t = useT();
  const { result, names } = project;
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [cited, setCited] = useState<string>("");
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const refresh = useCallback(() => { window.api.models("status").then((r) => { if (alive.current && r) setStatus(r as unknown as ModelStatus); }).catch(() => {}); }, []);
  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);
  const models = useModels(refresh);
  const model = useLlm(status?.llm);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [thread.length, thread[thread.length - 1]?.answer]);
  if (!result) return <p className="note">{t("Ask appears here once the recording is transcribed.")}</p>;

  const llm = status?.llm;
  const have = !!llm?.models?.[model];
  const size = llm?.bytes?.[model];
  const downloading = models.busy === `download llm-${model}`;
  const pct = models.dl?.fraction != null ? Math.round(models.dl.fraction * 100) : null;
  const busyOther = !!job && job.kind !== "ask";
  const asking = job?.kind === "ask";
  const who = (i: number) => displayName(result.segments[i].speaker, result.speakers, names);
  const first = result.speakers.length ? displayName(result.speakers[0], result.speakers, names) : "";
  const suggestions: [string, string][] = [
    ...(first ? [[t("What did {name} promise to do?", { name: first }), t("action items")] as [string, string]] : []),
    [t("What concerns did people raise?"), t("concerns")],
    [t("Which topics came up?"), t("topics")],
    [t("What was decided, and what is still open?"), t("decisions")],
  ];
  const send = (q: string) => {
    const question = q.trim();
    if (!question || !have || job) return;
    setText(""); onAsk(question, model);
  };
  const fit = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; };
  const copy = async (item: AskItem) => {
    if (!item.answer) return;
    try { await navigator.clipboard.writeText(item.answer.text); } catch { return; }
    setCopied(item.id); window.setTimeout(() => setCopied(null), 1800);
  };
  const cite = (itemId: number, line: number) => { setCited(`${itemId}:${line}`); onShow(line); };

  const setup = !llm?.available ? (
    status ? <p className="note">{t("The language model is not part of this version of the app, so questions can't be answered.")}</p> : null
  ) : !have && (
    <div className="pv-ask-setup card">
      <b>{t("Asking needs a language model")}</b>
      <p className="note">{t("It runs on this computer and nothing is sent anywhere. It needs a one-time download of {size}.", { size: bytes(size ?? 0) })}</p>
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
    <div className="pv-col pv-ask">
      <div className="pv-ask-scope"><span className="dot" aria-hidden /><span>{t("Answers come only from this transcript, on this computer.")}</span>
        {thread.length > 0 && <button type="button" className="btn quiet small" disabled={asking} onClick={onClear}>{t("Clear chat")}</button>}
      </div>
      <div className="pv-ask-thread" aria-live="polite">
        {thread.length === 0 ? (
          <div className="pv-ask-empty">
            <h3>{t("What do you want to know about this recording?")}</h3>
            <p className="note">{t("Ask in your own words. Every answer points to the lines it came from, so you can check it.")}</p>
            {have && (
              <div className="pv-ask-sugg">
                {suggestions.map(([q, tag]) => <button key={q} type="button" disabled={!!job} onClick={() => send(q)}><span>{q}</span><i>{tag}</i></button>)}
              </div>
            )}
          </div>
        ) : thread.map((item) => (
          <div key={item.id} className="pv-ask-turn">
            <div className="pv-ask-q">{item.q}</div>
            {item.answer ? (
              <div className="pv-ask-a">
                <AnswerText text={item.answer.text} />
                {item.answer.sources.length > 0 && (
                  <div className="pv-ask-cites" role="group" aria-label={t("Sources")}>
                    {item.answer.sources.map((i) => {
                      const seg = result.segments[i];
                      return seg ? <button key={i} type="button" className="pv-ask-cite" aria-pressed={cited === `${item.id}:${i}`} onClick={() => cite(item.id, i)} aria-label={t("Show the line at {time} in the transcript", { time: fmt(seg.start) })}>{fmt(seg.start)} {who(i)}</button> : null;
                    })}
                  </div>
                )}
                <div className="pv-ask-meta">
                  <span>{item.answer.sources.length > 0 ? t("Based on {count} of {total} lines", { count: item.answer.sources.length, total: item.answer.total }) : ""}</span>
                  <button type="button" className="btn quiet small" onClick={() => copy(item)}>{copied === item.id ? t("Copied ✓") : t("Copy")}</button>
                </div>
              </div>
            ) : item.error ? (
              <div className="alert err" role="alert"><span>{item.error}</span></div>
            ) : (
              <div className="pv-ask-think" role="status">
                <span className="note">{job?.message || t("Reading the transcript…")}</span>
                <div className="prog st-prog"><i className="indet" /></div>
                <button type="button" className="btn quiet small" onClick={onStop}>{t("Stop")}</button>
              </div>
            )}
          </div>
        ))}
        {thread.length === 0 && setup}
        <div ref={end} />
      </div>
      {busyOther && <p className="note">{t("Another language model job is running. You can ask when it finishes.")}</p>}
      {llm?.available && (llm.catalog?.length ?? 0) > 1 && (
        <label className="pv-ask-model">{t("Language model")}
          <select value={model} onChange={(e) => setLlm(e.target.value)} disabled={!!job || !!models.busy}>
            {llm.catalog!.map(({ id, label }) => <option key={id} value={id}>{label}{llm.models?.[id] ? " ✓" : ` (${bytes(llm.bytes?.[id] ?? 0)})`}</option>)}
          </select>
        </label>
      )}
      <div className="pv-ask-box">
        <label htmlFor="ask-input" hidden>{t("Ask about this transcript")}</label>
        <textarea id="ask-input" ref={box} rows={1} value={text} disabled={!have} placeholder={t("Ask about this transcript…")}
          onChange={(e) => { setText(e.target.value); fit(e.target); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); if (box.current) box.current.style.height = "auto"; } }} />
        <button type="button" className="pv-ask-send" disabled={!have || !!job || !text.trim()} onClick={() => { send(text); if (box.current) box.current.style.height = "auto"; }} aria-label={t("Send question")}>
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
      <p className="note pv-ask-foot">{t("Can be wrong. Check the lines it points to.")}</p>
    </div>
  );
}
