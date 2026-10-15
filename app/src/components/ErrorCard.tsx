import type { ReactNode } from "react";
import "../styles/shell.css";
import { useT } from "../i18n";
import type { Models } from "./useModels";

export interface ErrorAction { label: string; onClick(): void; primary?: boolean; quiet?: boolean }
interface Props { tag: string; title: string; children: ReactNode; actions: ErrorAction[]; progress?: number | null }

/** One problem, in plain words: what happened, what it means, what to do next. */
export default function ErrorCard({ tag, title, children, actions, progress }: Props) {
  return (
    <div className="card errcard" role="alert">
      <h2><span className="tag">{tag}</span>{title}</h2>
      <p>{children}</p>
      {progress != null && <div className="bar" aria-hidden><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      <div className="actions">
        {actions.map((a) => <button key={a.label} type="button" className={"btn" + (a.primary ? " sun" : a.quiet ? " quiet" : "")} onClick={a.onClick}>{a.label}</button>)}
      </div>
    </div>
  );
}

const HF_PAGES = ["pyannote/speaker-diarization-3.1", "pyannote/segmentation-3.0"];

/** The right card for whatever went wrong with a model download (reads `models.errInfo`). Renders nothing when there is no error. */
export function ModelErrorCard({ models, onOpenSettings }: { models: Models; onOpenSettings?: () => void }) {
  const t = useT();
  const { errInfo: e, retry, clearErr } = models;
  if (!e) return null;
  if (e.kind === "offline") return (
    <ErrorCard tag={t("Download")} title={e.title} actions={[{ label: t("Resume download"), primary: true, onClick: retry }, { label: t("Cancel"), onClick: clearErr }]}>{e.body}</ErrorCard>
  );
  if (e.kind === "space") return (
    <ErrorCard tag={t("Disk space")} title={e.title} actions={[
      { label: t("Check again"), primary: true, onClick: retry },
      ...(onOpenSettings ? [{ label: t("Choose a smaller model"), onClick: onOpenSettings }] : []),
      { label: t("Dismiss"), quiet: true, onClick: clearErr },
    ]}>{e.body}</ErrorCard>
  );
  if (e.kind === "denied") return (
    <ErrorCard tag="Hugging Face" title={e.title} actions={[
      { label: t("Open the two model pages"), onClick: () => HF_PAGES.forEach((p) => window.api.openExternal(`https://huggingface.co/${p}`)) },
      { label: t("Try again"), primary: true, onClick: retry },
      { label: t("Dismiss"), quiet: true, onClick: clearErr },
    ]}>{e.body}</ErrorCard>
  );
  return (
    <ErrorCard tag={t("Download")} title={e.title} actions={[{ label: t("Try again"), primary: true, onClick: retry }, { label: t("Dismiss"), quiet: true, onClick: clearErr }]}>{e.body}</ErrorCard>
  );
}
