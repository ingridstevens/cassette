import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useT } from "../i18n";
import { DEFAULT_EXPORT_OPTS, ExportOpts } from "../types";

export type OptionsKind = "srt" | "vtt" | "edl" | "text";
const KEY = "export-options";
const TC = /^\d{2}:[0-5]\d:[0-5]\d[:;]\d{2}$/;
/** Frame rates a timeline can have. 23.976, 29.97 and 59.94 are the broadcast rates (NTSC); the last two can use drop-frame timecode. */
const FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
const DROP_FPS = [29.97, 59.94];
const TITLES: Record<OptionsKind, string> = { srt: "Subtitle options", vtt: "Web subtitle options", edl: "Marker options (DaVinci Resolve)", text: "Text style" };

/** Subtitle style presets: they fill the four numbers (characters, lines, shortest and longest time on screen). */
const PRESETS: Record<string, Pick<ExportOpts, "maxChars" | "maxLines" | "minDuration" | "maxDuration">> = {
  netflix: { maxChars: 42, maxLines: 2, minDuration: 0.833, maxDuration: 7 },
  bbc: { maxChars: 37, maxLines: 2, minDuration: 1, maxDuration: 7 },
  social: { maxChars: 32, maxLines: 1, minDuration: 1, maxDuration: 7 },
};
const presetOf = (o: ExportOpts) => Object.keys(PRESETS).find((k) => (Object.keys(PRESETS[k]) as (keyof typeof PRESETS[string])[]).every((f) => PRESETS[k][f] === o[f])) ?? "custom";

export function loadExportOpts(): ExportOpts {
  try { return { ...DEFAULT_EXPORT_OPTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { ...DEFAULT_EXPORT_OPTS }; }
}

export default function ExportOptions({ kind, onCancel, onConfirm }: { kind: OptionsKind; onCancel(): void; onConfirm(o: ExportOpts): void }) {
  const t = useT();
  const [o, setO] = useState<ExportOpts>(loadExportOpts);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, select")?.focus();
    return () => before?.focus?.();
  }, []);
  const tcOk = TC.test(o.startTimecode);
  const subs = kind === "srt" || kind === "vtt";
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onCancel(); return; }
    if (e.key !== "Tab") return;
    const f = Array.from(box.current!.querySelectorAll<HTMLElement>("input, select, button:not([disabled])"));
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const submit = () => {
    if (kind === "edl" && !tcOk) return;
    const minDuration = Math.min(10, Math.max(0, Number(o.minDuration) || 0));
    const clean: ExportOpts = { ...o, maxChars: Math.min(60, Math.max(20, Math.round(o.maxChars) || 42)), minDuration, maxDuration: Math.min(30, Math.max(minDuration, 0.5, Number(o.maxDuration) || 7)), minGap: Math.max(0, Number(o.minGap) || 0), offsetSeconds: Number.isFinite(o.offsetSeconds) ? o.offsetSeconds : 0 };
    try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* storage can be unavailable */ }
    onConfirm(clean);
  };
  return (
    <div className="scrim" onKeyDown={key}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={id + "t"} ref={box}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); submit(); } }}>
        <h2 id={id + "t"}>{t(TITLES[kind])}</h2>
        {kind === "text" ? (
          <>
            <p>{t("Applies to Word, text, Markdown, spreadsheet, minutes and anonymised exports. Subtitles always keep their times. Your transcript itself is never changed.")}</p>
            <label className="field">{t("Hesitations (um, uh…)")}
              <select value={o.style} onChange={(e) => setO({ ...o, style: e.target.value as ExportOpts["style"] })}>
                <option value="verbatim">{t("Keep them (verbatim)")}</option>
                <option value="clean">{t("Remove them (clean copy)")}</option>
              </select>
              <span className="note">{t("Whisper sometimes leaves hesitations out by itself, so even “keep them” is not a guaranteed word-for-word record. A clean copy says so at the top.")}</span>
            </label>
            <div className="pv-opt-row">
              <span id={id + "pm"}>{t("Mark pauses")}</span>
              <button type="button" role="switch" className="switch" aria-checked={o.pauseMarks} aria-labelledby={id + "pm"} onClick={() => setO({ ...o, pauseMarks: !o.pauseMarks })} />
            </div>
            <span className="note">{t("Adds (.) for about half a second, (..) for about one second and (...) for two seconds or more.")}</span>
            <div className="pv-opt-row">
              <span id={id + "ts"}>{t("Show times")}</span>
              <button type="button" role="switch" className="switch" aria-checked={o.timestamps} aria-labelledby={id + "ts"} onClick={() => setO({ ...o, timestamps: !o.timestamps })} />
            </div>
            <div className="pv-opt-row">
              <span id={id + "xl"}>{t("Spreadsheet opens in Excel")}</span>
              <button type="button" role="switch" className="switch" aria-checked={o.excel} aria-labelledby={id + "xl"} onClick={() => setO({ ...o, excel: !o.excel })} />
            </div>
<span className="note">{t("For .csv files. Keeps accents like ä and é right in Excel on Windows, and shows a cell that starts with = + - or @ as text. Turn it off if you load the file into other software.")}</span>
            <div className="pv-opt-row">
              <span id={id + "vs"}>{t("Add a version line")}</span>
              <button type="button" role="switch" className="switch" aria-checked={o.stamp} aria-labelledby={id + "vs"} onClick={() => setO({ ...o, stamp: !o.stamp })} />
            </div>
            <span className="note">{t("Adds one last line to Word, text, Markdown, minutes and spreadsheet files: the Cassette and engine versions, the language and the speech model, so a result can be traced. No date, no file path, no names. In a spreadsheet it is a last row with # in the speaker column. Subtitles, JSON and the anonymised text are left as they are.")}</span>
          </>
        ) : subs ? (
          <>
            <label className="field">{t("Preset")}
              <select value={presetOf(o)} onChange={(e) => { const p = PRESETS[e.target.value]; if (p) setO({ ...o, ...p }); }}>
                <option value="custom">{t("Custom")}</option>
                <option value="netflix">{t("Netflix-like (42 characters, 2 lines, 0.833–7 s)")}</option>
                <option value="bbc">{t("BBC-like (37 characters, 2 lines)")}</option>
                <option value="social">{t("Social video (32 characters, 1 line)")}</option>
              </select>
            </label>
            <label className="field">{t("Max characters per line (20–60)")}
              <input type="number" min={20} max={60} value={o.maxChars} onChange={(e) => setO({ ...o, maxChars: Number(e.target.value) })} />
            </label>
            <label className="field">{t("Max lines per subtitle")}
              <select value={o.maxLines} onChange={(e) => setO({ ...o, maxLines: Number(e.target.value) })}><option value={1}>1</option><option value={2}>2</option></select>
            </label>
            <label className="field">{t("Shortest subtitle (seconds)")}
              <input type="number" step={0.1} min={0} max={10} value={o.minDuration} onChange={(e) => setO({ ...o, minDuration: Number(e.target.value) })} />
            </label>
            <label className="field">{t("Longest subtitle (seconds)")}
              <input type="number" step={0.5} min={1} max={30} value={o.maxDuration} onChange={(e) => setO({ ...o, maxDuration: Number(e.target.value) })} />
              <span className="note">{t("A subtitle is held on screen at least as long as the shortest time if the next one allows it, split when it runs longer than the longest time, and kept about two frames clear of the next one.")}</span>
            </label>
            <div className="pv-opt-row">
              <span id={id + "sw"}>{t("Put speaker names in subtitles")}</span>
              <button type="button" role="switch" className="switch" aria-checked={o.speakerNames} aria-labelledby={id + "sw"} onClick={() => setO({ ...o, speakerNames: !o.speakerNames })} />
            </div>
            <label className="field">{t("Shift all times by (seconds)")}
              <input type="number" step={0.1} value={o.offsetSeconds} onChange={(e) => setO({ ...o, offsetSeconds: Number(e.target.value) })} />
              <span className="note">{t("Use a negative number to move subtitles earlier. Times never go below 0.")}</span>
            </label>
          </>
        ) : (
          <>
            <p>{t("One marker per chapter, or per speaker turn if you have not marked chapters. Import it in Resolve with File → Import → Timeline Markers from EDL.")}</p>
            <label className="field">{t("Frame rate")}
              <select value={o.fps} onChange={(e) => setO({ ...o, fps: Number(e.target.value) })}>{FPS.map((f) => <option key={f} value={f}>{t("{fps} fps", { fps: f })}</option>)}</select>
              <span className="note">{t("Pick the rate of your timeline. If markers drift on a long recording, this is usually the cause.")}</span>
            </label>
            {DROP_FPS.includes(o.fps) && (
              <div className="pv-opt-row">
                <span id={id + "df"}>{t("Drop-frame timecode")}</span>
                <button type="button" role="switch" className="switch" aria-checked={!!o.dropFrame} aria-labelledby={id + "df"} onClick={() => setO({ ...o, dropFrame: !o.dropFrame })} />
              </div>
            )}
            <label className="field">{t("Start timecode")}
              <input type="text" value={o.startTimecode} placeholder="01:00:00:00" aria-invalid={!tcOk} aria-describedby={id + "tc"} onChange={(e) => setO({ ...o, startTimecode: e.target.value })} />
              <span className="note" id={id + "tc"}>{tcOk ? t("Hours:minutes:seconds:frames, like your timeline start.") : o.dropFrame && DROP_FPS.includes(o.fps) ? t("Use the form 01:00:00;00 for drop-frame.") : t("Use the form 01:00:00:00.")}</span>
            </label>
          </>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={onCancel}>{t("Cancel")}</button>
          <button type="button" className="btn sun" disabled={kind === "edl" && !tcOk} onClick={submit}>{kind === "text" ? t("Save") : t("Export")}</button>
        </div>
      </div>
    </div>
  );
}
