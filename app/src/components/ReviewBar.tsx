import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { Segment, UnsureRef } from "../types";

interface Props {
  segments: Segment[]; list: UnsureRef[]; pos: number; current: number; total: number;
  onFix(text: string): void; onAccept(): void; onSkip(): void; onBack(): void; onReplay(): void; onTyping(): void; onRestart(): void; onExit(): void;
}

/** The input for one word. It is created fresh for every word (see the `key` below: the word's own time and text, not its position, because positions are reused when a neighbour is removed), so it can never show the previous word's text, and it starts with the word selected. */
function WordRow({ word, atStart, onFix, onReplay, onBack, onSkip, onTyping, onExit }: { word: string; atStart: boolean } & Pick<Props, "onFix" | "onReplay" | "onBack" | "onSkip" | "onTyping" | "onExit">) {
  const t = useT();
  const [value, setValue] = useState(word);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.focus(); box.current?.select(); }, []);
  const key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); onReplay(); }
    else if (e.key === "Enter") { e.preventDefault(); onFix(value); }
    else if (e.key === "ArrowDown") { e.preventDefault(); onSkip(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onBack(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onExit(); }
  };
  return (
    <div className="pv-rv-row">
      <input ref={box} className="input pv-rv-input" value={value} onChange={(e) => { setValue(e.target.value); onTyping(); }} onKeyDown={key} aria-label={t("The word as it should read. Leave it empty to remove the word.")} spellCheck={false} />
      <button type="button" className="btn sun small" onClick={() => onFix(value)}>{value.trim() === word ? t("It's right") : t("Save fix")}</button>
      <button type="button" className="btn small" onClick={onReplay}>{t("Play again")}</button>
      <button type="button" className="btn quiet small" onClick={onBack} disabled={atStart}>{t("Back")}</button>
      <button type="button" className="btn quiet small" onClick={onSkip}>{t("Skip")}</button>
    </div>
  );
}

/** Review mode: the unsure words one at a time, the word in its sentence, the audio around it, and a box to fix it. */
export default function ReviewBar({ segments, list, pos, current, total, onFix, onSkip, onBack, onReplay, onTyping, onRestart, onExit }: Props) {
  const t = useT();
  const cur = list[pos];
  const seg = cur ? segments[cur.seg] : undefined;
  const word = seg?.words[cur.word];

  if (!cur || !seg || !word) {
    return (
      <div className="card pv-review" role="status">
        <div className="pv-rv-done">
          <b>{list.length === 0 ? t("All unsure words are checked ✓") : list.length === 1 ? t("You skipped 1 unsure word") : t("You skipped {count} unsure words", { count: list.length })}</b>
          <span className="pv-rv-btns">
            {list.length > 0 && <button type="button" className="btn small" onClick={onRestart}>{t("Go through them again")}</button>}
            <button type="button" className="btn sun small" onClick={onExit}>{t("Done")}</button>
          </span>
        </div>
      </div>
    );
  }
  const tokens = (from: number, to: number) => seg.words.slice(Math.max(0, from), to).map((w) => w.word.trim()).join(" ");
  const before = tokens(cur.word - 7, cur.word), after = tokens(cur.word + 1, cur.word + 8);
  return (
    <div className="card pv-review" role="group" aria-label={t("Review unsure words")}>
      <div className="pv-rv-top">
        <span className="pv-rv-count">{t("Unsure word {current} of {total}", { current: Math.min(current, total), total })}</span>
        <button type="button" className="btn quiet small" onClick={onExit}>{t("Close review")}</button>
      </div>
      <p className="pv-rv-context">{before}{before ? " " : ""}<mark>{word.word.trim()}</mark>{after ? " " : ""}{after}</p>
      <WordRow key={`${cur.seg}:${word.start}:${word.word}`} word={word.word.trim()} atStart={pos === 0} onFix={onFix} onReplay={onReplay} onBack={onBack} onSkip={onSkip} onTyping={onTyping} onExit={onExit} />
      <p className="pv-rv-keys">{t("Enter saves and goes on · Shift+Enter plays again · ↓ skips · ↑ goes back · Esc closes")}</p>
    </div>
  );
}
