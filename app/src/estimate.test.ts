import { describe, expect, it } from "vitest";
import { engineFor, estimate, memoryNeed, saferModel, tooBigForMemory } from "./estimate";

const base = { duration: 600, model: "small", engine: "faster" as const, speakers: false, gpuSpeakers: false };

describe("estimate", () => {
  it("is rough without a measured run", () => {
    const e = estimate(base);
    expect(e.rough).toBe(true);
    expect(e.mid).toBeCloseTo(600 / 3.9, 5);
    expect(e.low).toBeLessThan(e.mid);
    expect(e.high).toBeGreaterThan(e.mid);
  });
  it("uses a measured speed and narrows the range", () => {
    const e = estimate({ ...base, calib: { whisper: { "small:faster": 10 }, diar: {} } });
    expect(e.rough).toBe(false);
    expect(e.mid).toBe(60);
    expect(e.high / e.mid).toBeCloseTo(1.2, 5);
  });
  it("adds time for speaker detection and stays rough without a measured one", () => {
    const calib = { whisper: { "small:faster": 10 }, diar: {} };
    const e = estimate({ ...base, speakers: true, calib });
    expect(e.mid).toBeCloseTo(60 + 600 / 3, 5);
    expect(e.rough).toBe(true);
  });
  it("scales from another measured size on the same engine", () => {
    const e = estimate({ ...base, model: "medium", calib: { whisper: { "small:faster": 8 }, diar: {} } });
    expect(e.mid).toBeCloseTo(600 / (8 / 3.2), 5);
  });
  it("is at least one second", () => { expect(estimate({ ...base, duration: 0.1 }).mid).toBe(1); });
  it("is faster on the GPU engine", () => { expect(estimate({ ...base, engine: "mlx" }).mid).toBeLessThan(estimate(base).mid); });
});

describe("engineFor", () => {
  const status = { mlxAvailable: true, mlx: { small: true } };
  it("uses the GPU engine when available and downloaded", () => { expect(engineFor("small", {}, status)).toBe("mlx"); });
  it("falls back when the user or settings say so", () => {
    expect(engineFor("small", { whisperEngine: "faster" }, status)).toBe("faster");
    expect(engineFor("small", { device: "cpu" }, status)).toBe("faster");
    expect(engineFor("small", { vad: true }, status)).toBe("faster");
    expect(engineFor("medium", {}, status)).toBe("faster");
    expect(engineFor("small", {}, null)).toBe("faster");
  });
  it("always uses the fast engine for parakeet and moonshine", () => {
    expect(engineFor("parakeet-v3", {}, null)).toBe("mlx");
    expect(engineFor("moonshine-tiny", {}, null)).toBe("mlx");
  });
});

describe("memory", () => {
  it("adds a gigabyte for speaker detection", () => { expect(memoryNeed("small", true)).toBe(memoryNeed("small", false) + 1); });
  it("never warns when memory is unknown", () => { expect(tooBigForMemory("large-v3", true, undefined)).toBe(false); });
  it("warns when the model does not fit", () => { expect(tooBigForMemory("large-v3", false, 8)).toBe(true); expect(tooBigForMemory("small", false, 8)).toBe(false); });
  it("suggests the biggest model that fits, or tiny", () => {
    expect(saferModel(false, 8)).toBe("small");
    expect(saferModel(false, 3.5)).toBe("base");
    expect(saferModel(false, 2)).toBe("tiny");
  });
});
