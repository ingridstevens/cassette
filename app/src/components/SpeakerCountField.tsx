import { useT } from "../i18n";
import { Options } from "../types";

const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** "How many people speak?": automatic, an exact number, or a range. Used in the project's Options tab and in the start sheet. `hasResult` is false before the first transcription, when "transcribe again" would make no sense. */
export default function SpeakerCountField({ eff, set, hasResult = true }: { eff: Options; set(p: Partial<Options>): void; hasResult?: boolean }) {
  const t = useT();
  return (
    <label className="field">{t("Number of speakers")}
      <select className="input" value={eff.numSpeakers} disabled={eff.noDiarize} onChange={(e) => set({ numSpeakers: e.target.value })}>
        <option value="">{t("Detect automatically")}</option>
        {upTo(12).map((n) => <option key={n} value={String(n)}>{n}</option>)}
        <option value="range">{t("Between a minimum and a maximum…")}</option>
      </select>
      {eff.numSpeakers === "range" ? (
        <span className="pv-range">
          <label>{t("At least")}
            <select className="input" value={eff.minSpeakers ?? "2"} onChange={(e) => { const mn = e.target.value; set({ minSpeakers: mn, maxSpeakers: Number(eff.maxSpeakers ?? "4") < Number(mn) ? mn : eff.maxSpeakers }); }}>
              {upTo(20).map((n) => <option key={n} value={String(n)}>{n}</option>)}
            </select>
          </label>
          <label>{t("At most")}
            <select className="input" value={eff.maxSpeakers ?? "4"} onChange={(e) => { const mx = e.target.value; set({ maxSpeakers: mx, minSpeakers: Number(eff.minSpeakers ?? "2") > Number(mx) ? mx : eff.minSpeakers }); }}>
              {upTo(30).map((n) => <option key={n} value={String(n)}>{n}</option>)}
            </select>
          </label>
        </span>
      ) : <span className="note pv-plain">{hasResult ? t("Know it's exactly 3? Set it here and transcribe again.") : t("Know how many people speak? Set it here; it makes speaker detection more reliable.")}</span>}
    </label>
  );
}
