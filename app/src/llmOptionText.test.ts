import { describe, expect, it } from "vitest";
import { llmOptionText } from "./components/llmChoice";

const t = (s: string, v?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? ""));

describe("llmOptionText", () => {
  it("shows size and not downloaded", () => { expect(llmOptionText(t, "Qwen3 4B", false, 2_497_281_120)).toBe("Qwen3 4B · ≈ 2.5 GB · Not downloaded"); });
  it("shows size and downloaded", () => { expect(llmOptionText(t, "Qwen3 4B", true, 2_278_972_236)).toBe("Qwen3 4B · ≈ 2.3 GB · Downloaded"); });
  it("leaves the size out when it is unknown", () => { expect(llmOptionText(t, "X", false, undefined)).toBe("X · Not downloaded"); });
});
