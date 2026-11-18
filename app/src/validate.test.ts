import { describe, expect, it } from "vitest";
import { EXPORT_FORMATS, MODEL, MODEL_NAME, modelsOk, safeName, saveClipOk, speakerCount, transcribeProblem } from "../electron/validate";

const ok = { model: "small", language: "auto", device: "auto" };

describe("transcribeProblem", () => {
  it("accepts what the window sends", () => {
    expect(transcribeProblem(ok)).toBeNull();
    for (const model of ["tiny", "large-v3-turbo", "parakeet-v3", "moonshine-en"]) expect(transcribeProblem({ ...ok, model, language: "de", device: undefined })).toBeNull();
    expect(transcribeProblem({ ...ok, language: "yue", device: "" })).toBeNull();
  });
  it("rejects a bad model, language or device", () => {
    expect(transcribeProblem({ ...ok, model: "x; rm" })).toBeTruthy();
    expect(transcribeProblem({ ...ok, model: undefined })).toBeTruthy();
    expect(transcribeProblem({ ...ok, language: "--x" })).toBeTruthy();
    expect(transcribeProblem({ ...ok, language: "EN" })).toBeTruthy();
    expect(transcribeProblem({ ...ok, device: "gpu" })).toBeTruthy();
    expect(MODEL.test("small\n")).toBe(false);
  });
});

describe("speakerCount", () => {
  it("accepts integers 1 to 20, as numbers or digit strings", () => {
    expect(speakerCount("3")).toBe(3);
    expect(speakerCount(20)).toBe(20);
  });
  it("rejects everything else", () => {
    for (const v of ["", "range", "0", "21", "-1", "2.5", 2.5, NaN, null, undefined, "1e1", "--x"]) expect(speakerCount(v)).toBeNull();
  });
});

describe("modelsOk", () => {
  it("accepts the actions and names the window uses", () => {
    expect(modelsOk("status", undefined)).toBe(true);
    expect(modelsOk("check", undefined)).toBe(true);
    for (const n of ["small", "diarization", "mlx-small", "llm-qwen3-4b", "moonshine-en", "parakeet-v3"]) expect(modelsOk("download", n)).toBe(true);
  });
  it("rejects other actions and odd names", () => {
    expect(modelsOk("rm", "small")).toBe(false);
    expect(modelsOk(undefined, "small")).toBe(false);
    for (const n of ["--x", "a b", "../x", "x;y", "A", 5]) expect(modelsOk("delete", n)).toBe(false);
    expect(MODEL_NAME.test("x".repeat(60))).toBe(false);
  });
});

describe("export", () => {
  it("knows every engine format and no others", () => {
    expect(EXPORT_FORMATS.has("combined-csv")).toBe(true);
    expect(EXPORT_FORMATS.has("exe")).toBe(false);
  });
  it("cleans the default file name", () => {
    expect(safeName("a/b\\c:d", "T")).toBe("a-b-c-d");
    expect(safeName("", "Transcript")).toBe("Transcript");
    expect(safeName(undefined, "Transcript")).toBe("Transcript");
    expect(safeName("x".repeat(500), "T")).toHaveLength(120);
    expect(safeName("a\nb", "T")).toBe("a-b");
  });
});

describe("saveClipOk", () => {
  it("needs finite numbers with end after start", () => {
    expect(saveClipOk(0, 1.5)).toBe(true);
    expect(saveClipOk(2, 2)).toBe(false);
    expect(saveClipOk(1, NaN)).toBe(false);
    expect(saveClipOk("1", 2)).toBe(false);
    expect(saveClipOk(undefined, 2)).toBe(false);
  });
});
