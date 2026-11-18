import { useT } from "../i18n";

/** First run: Simple (fewer buttons) or Full. Both can be changed later under Settings, Text and language. */
export default function EasyChoice({ onChoose }: { onChoose(easy: boolean): void }) {
  const t = useT();
  return (
    <section className="card setup-card" aria-labelledby="easy-h" style={{ margin: "16px 24px", padding: "20px 24px" }}>
      <h2 id="easy-h">{t("How would you like to use Cassette?")}</h2>
      <p className="note">{t("You can change this at any time under Settings.")}</p>
      <div className="choices">
        <button type="button" className="choice-card" onClick={() => onChoose(true)}>
          <b>{t("Simple")}</b>
          <span>{t("Fewer buttons: your recordings, the transcript, play, edit, rename speakers, Print and Word.")}</span>
        </button>
        <button type="button" className="choice-card" onClick={() => onChoose(false)}>
          <b>{t("Full")}</b>
          <span>{t("Everything: summaries, review, chapters, clips, marked lines and all export formats.")}</span>
        </button>
      </div>
    </section>
  );
}
