import { describe, expect, it } from "vitest";
import { modelLabel, needsRepair, summarize, VerifyRow } from "./verifyModels";
import { modelsOk } from "../electron/validate";

const row = (id: string, state: VerifyRow["state"], how: VerifyRow["how"] = "recorded"): VerifyRow => ({ id, state, how });
const t = (s: string) => s;

describe("verify results", () => {
  it("offers repair for damaged and other-version models only", () => {
    expect(needsRepair(row("tiny", "damaged"))).toBe(true);
    expect(needsRepair(row("tiny", "other_version"))).toBe(true);
    expect(needsRepair(row("tiny", "ok"))).toBe(false);
    expect(needsRepair(row("tiny", "missing"))).toBe(false);
  });
  it("counts each state", () => {
    expect(summarize([row("a", "ok"), row("b", "ok"), row("c", "damaged"), row("d", "other_version"), row("e", "missing")])).toEqual({ ok: 2, problems: 2, notDownloaded: 1 });
  });
  it("names models like the model lists do", () => {
    expect(modelLabel("small", null, t)).toBe("Whisper Small");
    expect(modelLabel("large-v3-turbo", null, t)).toBe("Whisper Large v3 turbo");
    expect(modelLabel("mlx-tiny", null, t)).toBe("Whisper Tiny (Apple GPU)");
    expect(modelLabel("parakeet-v3", null, t)).toBe("Parakeet v3");
    expect(modelLabel("diarization", null, t)).toBe("Speaker detection");
  });
});

describe("models IPC validator for verify and repair", () => {
  it("allows verify with or without a name, repair only with a valid name", () => {
    expect(modelsOk("verify", undefined)).toBe(true);
    expect(modelsOk("verify", "small")).toBe(true);
    expect(modelsOk("repair", "diarization")).toBe(true);
    expect(modelsOk("repair", "llm-qwen3-4b")).toBe(true);
    expect(modelsOk("repair", undefined)).toBe(false);
    expect(modelsOk("repair", "../x")).toBe(false);
    expect(modelsOk("verify; rm", "small")).toBe(false);
  });
});
