import { describe, expect, it } from "vitest";
import { cleanupVerdict } from "./cleanupEstimate";

const lv = (speech_db: number, noise_floor_db: number) => ({ speech_db, noise_floor_db, gap_db: Math.round((speech_db - noise_floor_db) * 10) / 10 });

describe("cleanupVerdict", () => {
  it("reports a wider gap when the background drops more than the speech", () => {
    expect(cleanupVerdict(lv(-30, -50), lv(-26, -62))).toEqual({ speech: 4, background: -12, gap: 16, gapKind: "wider" });
  });
  it("reports a narrower gap when the cleanup blurs the difference", () => {
    expect(cleanupVerdict(lv(-20, -45), lv(-20, -38)).gapKind).toBe("narrower");
  });
  it("calls changes under 1 dB the same", () => {
    expect(cleanupVerdict(lv(-20, -45), lv(-19.6, -45.2)).gapKind).toBe("same");
  });
});
