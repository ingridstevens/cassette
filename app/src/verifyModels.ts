import type { ModelStatus } from "./types";
import { isEngineModel, WHISPER_MODELS } from "./components/modelInfo";

/** One model's result from "Verify models". The engine reads the files on disk; nothing goes over the network. */
export interface VerifyRow {
  id: string;
  /** ok: matches; damaged: a file changed, is cut short or is gone; other_version: installed at a version this app does not use; missing: not downloaded. */
  state: "ok" | "damaged" | "other_version" | "missing";
  /** What "ok" was checked against. pinned: also a checksum built into this app; recorded: the checksum in the file's name in the models folder; present: some files had no checksum, only their presence was checked. */
  how: "pinned" | "recorded" | "present";
}

/** Repair re-downloads from the pinned version; it is offered for these two states only (a missing model has the Download button). */
export const needsRepair = (r: VerifyRow): boolean => r.state === "damaged" || r.state === "other_version";

export function summarize(rows: VerifyRow[]) {
  return { ok: rows.filter((r) => r.state === "ok").length, problems: rows.filter(needsRepair).length, notDownloaded: rows.filter((r) => r.state === "missing").length };
}

/** The name a person knows the model by (the same names as the model lists). */
export function modelLabel(id: string, status: ModelStatus | null, t: (s: string) => string): string {
  if (id === "diarization") return t("Speaker detection");
  const apple = id.startsWith("mlx-"), base = apple ? id.slice(4) : id;
  const w = WHISPER_MODELS.find((m) => m.id === base);
  if (w) return `Whisper ${w.id.startsWith("large") ? w.name : t(w.name)}${apple ? ` (${t("Apple GPU")})` : ""}`;
  if (isEngineModel(id)) return "Parakeet v3";
  if (id.startsWith("llm-")) {
    const m = [...(status?.llm?.catalog ?? []), ...(status?.llm?.translation ?? [])].find((x) => x.id === id.slice(4));
    return m?.label ?? id.slice(4);
  }
  return id;
}
