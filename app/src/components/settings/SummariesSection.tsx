import { useT } from "../../i18n";
import { ModelErrorCard } from "../ErrorCard";
import { setLlm, useLlm } from "../llmChoice";
import { Block, SectionProps } from "./shared";
import ModelList, { Entry } from "./ModelList";

/** Language names for the model list; the keys are the codes the engine sends. */
const LANGUAGE_NAMES: Record<string, string> = { en: "English", de: "German", fr: "French", es: "Spanish" };

export default function SummariesSection({ status, models, say }: SectionProps) {
  const t = useT();
  const llm = status?.llm, inUse = useLlm(llm);
  if (!llm?.available) return <Block id="su-na" title={t("Summaries and translation")}><p className="note">{t("This version of the app cannot run the language model on this computer.")}</p></Block>;
  const mk = (id: string, label: string, like: string, license: string, langs: string, rec: boolean, translation: boolean): Entry => {
    const have = !!llm.models?.[id], size = llm.bytes?.[id] ?? 0, other = (llm.catalog ?? []).find((m) => m.id !== id && llm.models?.[m.id]);
    return {
      id, run: `llm-${id}`, name: label, badge: rec ? t("Recommended") : undefined, purpose: <>{t(like)}<small className="rel">{langs ? langs + " · " : ""}{t("License: {name}", { name: license })}</small></>,
      size, have, downloadSize: size, inUse: !translation && id === inUse, onUse: translation ? undefined : () => setLlm(id), undo: () => setLlm(inUse),
      alt: !translation && id === inUse && other ? { label: other.label, apply: () => setLlm(other.id) } : undefined,
    };
  };
  const names = (l: string[]) => l.map((c) => t(LANGUAGE_NAMES[c] ?? c)).join(", ");
  return (
    <>
      {models.errInfo && !models.busy && <ModelErrorCard models={models} />}
      <Block id="su-sum" title={t("Summary model")}>
        <p className="note">{t("A language model, separate from the transcriber. It suggests highlights and writes summaries in the language of the recording. It runs on this computer and sends nothing anywhere.")}</p>
        <ModelList label={t("Summary models")} models={models} say={say} entries={(llm.catalog ?? []).map((m) => mk(m.id, m.label, m.like, m.license, names(m.languages), m.id === llm.default, false))} />
      </Block>
      {!!llm.translation?.length && (
        <Block id="su-tr" title={t("Translation model")}>
          <p className="note">{t("Translates lines into another language, such as German or Arabic. Without it the app can only translate into English. It runs on this computer.")}</p>
          <ModelList label={t("Translation model")} models={models} say={say} entries={llm.translation.map((m) => mk(m.id, m.label, m.like, m.license, "", true, true))} />
        </Block>
      )}
    </>
  );
}
