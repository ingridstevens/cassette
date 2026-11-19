import path from "node:path";
import { describe, expect, it } from "vitest";
import { dataLocations } from "../electron/dataLocations";
import { EXPORT_FORMATS, episodeFolder, episodeInput, REVEAL_TARGETS, MODEL, MODEL_NAME, modelsOk, safeName, saveClipOk, speakerCount, transcribeProblem } from "../electron/validate";

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
  it("accepts only the known audio cleanup modes", () => {
    for (const audioCleanup of [undefined, "off", "level", "denoise", "both"]) expect(transcribeProblem({ ...ok, audioCleanup })).toBeNull();
    for (const audioCleanup of ["loudnorm", "both,x", "", 1]) expect(transcribeProblem({ ...ok, audioCleanup })).toBeTruthy();
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
    expect(EXPORT_FORMATS.has("md-copy")).toBe(true);
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

describe("reveal targets and data locations", () => {
  it("the window can only name a fixed place, never a path", () => {
    for (const k of ["models", "log", "data", "recordings", "peaks", "tmp"]) expect(REVEAL_TARGETS.has(k)).toBe(true);
    for (const k of ["/etc", "../x", "token", "projects", ""]) expect(REVEAL_TARGETS.has(k)).toBe(false);
  });
  it("every place lies inside the app's data folder", () => {
    const d = dataLocations("/u/Cassette");
    expect(d.recordings).toBe(path.join("/u/Cassette", "recordings"));
    expect(d.projects).toBe(path.join("/u/Cassette", "projects.json"));
    for (const p of Object.values(d)) expect(path.relative("/u/Cassette", p).startsWith("..")).toBe(false);
  });
});

describe("episodeInput", () => {
  const seg = { start: 0, end: 5, text: "Hi", speaker: "S1" };
  it("collects chapters and clips, naming speakers", () => {
    const r = episodeInput({ segments: [{ ...seg, chapter: " Intro " }], highlights: [{ start: 1, end: 4, speaker: "S1" }], speakers: { S1: "Anna" } });
    expect(r).toEqual({ chapters: true, clips: [{ start: 1, end: 4, speaker: "Anna" }] });
  });
  it("works without highlights or chapters", () => {
    expect(episodeInput({ segments: [seg] })).toEqual({ chapters: false, clips: [] });
  });
  it("rejects unusable payloads and bad highlight bounds", () => {
    for (const p of [null, "x", {}, { segments: [] }, { segments: [1] }, { segments: [seg], highlights: "x" }]) expect(typeof episodeInput(p)).toBe("string");
    for (const h of [{ start: 4, end: 1 }, { start: 2, end: 2 }, { start: NaN, end: 3 }, { start: 0, end: Infinity }, { start: "1", end: 3 }, null]) expect(typeof episodeInput({ segments: [seg], highlights: [h] })).toBe("string");
  });
});
describe("episodeFolder", () => {
  it("names the folder safely and numbers repeats", () => {
    expect(episodeFolder("Show: ep/1", 1)).toBe("Show- ep-1 episode");
    expect(episodeFolder("Show", 2)).toBe("Show episode (2)");
    expect(episodeFolder("", 1)).toBe("Episode episode");
    expect(episodeFolder("../..", 1)).not.toMatch(/[\\/]/);
  });
});
