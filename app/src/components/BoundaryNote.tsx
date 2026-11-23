import { useEffect, useState } from "react";
import { useT } from "../i18n";
import type { Boundary } from "../sources";
import type { Join, Part } from "../types";
import { fmt } from "../types";

type T = ReturnType<typeof useT>;
/** A length the person can read: 45 s, 2 min 5 s. */
const length = (t: T, s: number) => (s < 60 ? t("{n} s", { n: Math.round(s * 10) / 10 }) : t("{m} min {s} s", { m: Math.floor(s / 60), s: Math.round(s % 60) }));

/** The three kinds of boundary, each with its own word (never told apart by colour alone) and sentence. */
export function describeJoin(t: T, b: Boundary): { label: string; text: string } {
  const args = { a: b.index, b: b.index + 1, length: b.join && "seconds" in b.join ? length(t, b.join.seconds) : "" };
  switch (b.join?.kind) {
    case "gap": return { label: t("Known gap"), text: t("Nothing was recorded for {length} between part {a} and part {b}. The transcript continues after the gap.", args) };
    case "unknown": return { label: t("Unknown gap"), text: t("Something may be missing between part {a} and part {b}, and nobody knows how much.", args) };
    case "overlap": return { label: t("Handoff overlap"), text: t("Part {a} and part {b} both recorded the same {length}, so a few words may be heard twice. Nothing was cut.", args) };
    default: return { label: t("New recording"), text: t("Part {b}, “{name}”, starts here.", { ...args, name: b.after.name }) };
  }
}

/** A line across the transcript where one recording ends and the next begins. Playing from it starts the later recording. */
export function BoundaryNote({ boundary, onSeek }: { boundary: Boundary; onSeek(time: number): void }) {
  const t = useT();
  const d = describeJoin(t, boundary);
  return (
    <div className={"pv-boundary " + (boundary.join?.kind ?? "plain")} role="note">
      <span className="pv-flag pv-bflag">{d.label}</span>
      <span className="pv-btext">{d.text}</span>
      <button type="button" className="btn quiet small" onClick={() => onSeek(boundary.at)} aria-label={t("Play part {b} from its start, {time}", { b: boundary.index + 1, time: fmt(boundary.at) })}>{t("Play part {b}", { b: boundary.index + 1 })}</button>
    </div>
  );
}

const KINDS: { id: "none" | Join["kind"]; label: string }[] = [
  { id: "none", label: "Nothing noted" }, { id: "gap", label: "Known gap" }, { id: "unknown", label: "Unknown gap" }, { id: "overlap", label: "Handoff overlap" },
];

/** Notes for every boundary: one row per join, choosing what is known about it. Only a note is saved; no recording and no time on the timeline changes. */
export function BoundaryEditor({ parts, onChange }: { parts: Part[]; onChange(id: string, join: Join | undefined): void }) {
  const t = useT();
  return (
    <div className="pv-bedit" role="group" aria-label={t("Boundaries between recordings")}>
      {parts.slice(1).map((p, i) => <BoundaryRow key={p.id} index={i + 1} part={p} onChange={onChange} />)}
      <div className="pv-hint">{t("These notes only label the transcript. They do not change the audio or the times.")}</div>
    </div>
  );
}

function BoundaryRow({ index, part, onChange }: { index: number; part: Part; onChange(id: string, join: Join | undefined): void }) {
  const t = useT();
  const [chosen, setChosen] = useState<string>(part.join?.kind ?? "none");
  // the length is typed freely, and only a positive number is saved
  const [text, setText] = useState(part.join && "seconds" in part.join ? String(part.join.seconds) : "");
  const [bad, setBad] = useState(false);
  const needsLength = chosen === "gap" || chosen === "overlap";
  const save = (kind: string, typed: string) => {
    const n = Number(typed);
    if (kind === "none") { setBad(false); onChange(part.id, undefined); }
    else if (kind === "unknown") { setBad(false); onChange(part.id, { kind: "unknown" }); }
    else if (typed.trim() !== "" && Number.isFinite(n) && n > 0) { setBad(false); onChange(part.id, { kind: kind as "gap" | "overlap", seconds: n }); }
    else { setBad(true); onChange(part.id, undefined); }
  };
  // the note changed from outside (undo, redo): show what is saved. A typed value that is not saved yet (no join, "bad") is left alone.
  useEffect(() => {
    const j = part.join;
    if (j) { if (j.kind !== chosen || ("seconds" in j && j.seconds !== Number(text))) { setChosen(j.kind); setText("seconds" in j ? String(j.seconds) : text); setBad(false); } }
    else if (chosen === "unknown" || (needsLength && !bad)) { setChosen("none"); setText(""); }
  }, [part.join]); // eslint-disable-line react-hooks/exhaustive-deps
  const id = `bd-${part.id}`;
  return (
    <div className="pv-brow">
      <label htmlFor={id}>{t("Between part {a} and part {b}", { a: index, b: index + 1 })}</label>
      <select id={id} value={chosen} onChange={(e) => { setChosen(e.target.value); save(e.target.value, text); }}>
        {KINDS.map((k) => <option key={k.id} value={k.id}>{t(k.label)}</option>)}
      </select>
      {needsLength && (
        <>
          <label htmlFor={id + "-s"} className="pv-sr">{chosen === "gap" ? t("Length of the gap in seconds") : t("Length of the overlap in seconds")}</label>
          <input id={id + "-s"} type="number" min={0} step="any" inputMode="decimal" value={text} aria-invalid={bad} aria-describedby={bad ? id + "-e" : undefined} onChange={(e) => { setText(e.target.value); save(chosen, e.target.value); }} />
          <span aria-hidden>{t("seconds")}</span>
          {bad && <span id={id + "-e"} className="pv-berr" role="alert">{t("Enter a length above 0, or choose “Unknown gap”.")}</span>}
        </>
      )}
    </div>
  );
}
