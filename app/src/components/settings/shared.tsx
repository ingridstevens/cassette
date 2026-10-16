import { ReactNode } from "react";
import { ModelStatus, Options } from "../../types";
import type { Models } from "../useModels";
import { isEngineModel, isMoonshine } from "../modelInfo";

export type Engine = "whisper" | "parakeet" | "moonshine";
export const engineOf = (model: string): Engine => (isMoonshine(model) ? "moonshine" : isEngineModel(model) ? "parakeet" : "whisper");

/** What every Settings page gets. `say` shows a message (and announces it); give it `undo` to offer Undo. */
export interface SectionProps {
  opts: Options; set(o: Options): void; status: ModelStatus | null; models: Models;
  onGoTo(section: string): void; say(msg: string, undo?: () => void): void; onReset(): void;
}

/** A titled card. The title is a real heading so screen-reader users can jump between blocks. */
export function Block({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return <section className="card st-card" aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}

/** A label, a line of help and a switch, in one row. */
export function SwitchRow({ id, title, help, on, onChange }: { id: string; title: string; help?: string; on: boolean; onChange(v: boolean): void }) {
  return (
    <div className="st-row st-setting">
      <div className="grow"><b id={id}>{title}</b>{help && <p className="note" id={id + "-d"}>{help}</p>}</div>
      <button type="button" className="switch" role="switch" aria-checked={on} aria-labelledby={id} aria-describedby={help ? id + "-d" : undefined} onClick={() => onChange(!on)} />
    </div>
  );
}
