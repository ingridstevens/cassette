import { ModelStatus, Options } from "../../types";
import { useT } from "../../i18n";
import { WHISPER_MODELS } from "../modelInfo";
import { setLlm, useLlm } from "../llmChoice";

interface Props { opts: Options; set(o: Options): void; status: ModelStatus | null }

/** One job, one model: each row says what the model is used for and lets it be chosen on its own. */
export default function RolesSection({ opts, set, status }: Props) {
  const t = useT();
  const llm = status?.llm, llmInUse = useLlm(llm);
  const detect = opts.detectModel ?? "tiny";
  const sizeLabel = (id: string, name: string) => `${id === "large-v3-turbo" || id === "large-v3" ? name : t(name)}${status?.whisper[id] ? "" : " · " + t("not downloaded")}`;
  return (
    <div className="card st-card">
      <h2>{t("Which model does which job?")}</h2>
      <p className="st-lead">{t("Each job can use its own model. A small one is enough for quick jobs and leaves the big one for the words themselves.")}</p>

      <h3 className="st-sub"><label htmlFor="role-transcribe">{t("Writing the words down")}</label></h3>
      <p className="note">{t("The default size for new projects. You can still change it for a single project in its Options.")}</p>
      <select id="role-transcribe" className="input" value={opts.model} onChange={(e) => set({ ...opts, model: e.target.value })}>
        {WHISPER_MODELS.map((m) => <option key={m.id} value={m.id}>{sizeLabel(m.id, m.name)}</option>)}
      </select>

      <h3 className="st-sub"><label htmlFor="role-detect">{t("Finding out which language is spoken")}</label></h3>
      <p className="note">{t("Only used on recordings where the language is automatic. The answer is a few letters, so a tiny model does it well and fast. If it isn't downloaded, the model above is used instead.")}</p>
      <select id="role-detect" className="input" value={detect} onChange={(e) => set({ ...opts, detectModel: e.target.value === "tiny" ? undefined : e.target.value })}>
        <option value="same">{t("The same as for writing the words down")}</option>
        {WHISPER_MODELS.map((m) => <option key={m.id} value={m.id}>{sizeLabel(m.id, m.name)}{m.id === "tiny" ? " · " + t("Recommended") : ""}</option>)}
      </select>

      {llm?.available && (
        <>
          <h3 className="st-sub"><label htmlFor="role-llm">{t("Highlights and summaries")}</label></h3>
          <p className="note">{t("Used in every project. Bigger models choose better and take longer.")}</p>
          <select id="role-llm" className="input" value={llmInUse} onChange={(e) => setLlm(e.target.value)}>
            {(llm.catalog ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}{llm.models?.[m.id] ? "" : " · " + t("not downloaded")}{m.id === llm.default ? " · " + t("Recommended") : ""}</option>)}
          </select>
        </>
      )}

      <h3 className="st-sub">{t("Finding the speakers")}</h3>
      <p className="note">{t("One fixed model, set up in Storage and models. Whether it runs on the CPU or the graphics chip is under Performance.")}</p>
    </div>
  );
}
