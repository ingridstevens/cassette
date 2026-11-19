import { describe, expect, it } from "vitest";
import { copyName, duplicateProject, mediaKind, menuStep, sharesRecording } from "./projectActions";
import type { Project } from "./types";

const proj = (over: Partial<Project> = {}): Project => ({
  id: "a", path: "/x/talk.mp3", name: "Talk", addedAt: 1, openedAt: 5, result: { language: "en", duration: 3, speakers: ["SPEAKER_00"], segments: [] },
  names: { SPEAKER_00: "Ana" }, status: "done", lastExport: { format: "docx", options: {} }, previous: { result: { language: "en", duration: 1, speakers: [], segments: [] }, names: {} }, ...over,
});

describe("mediaKind", () => {
  it("tells video from audio by extension, ignoring case", () => {
    for (const f of ["a.mp4", "a.MOV", "a.mkv", "a.webm"]) expect(mediaKind(f)).toBe("video");
    for (const f of ["a.mp3", "a.WAV", "a.m4a", "a.flac", "a.ogg", "a.opus", "a.aac"]) expect(mediaKind(f)).toBe("audio");
  });
});

describe("copyName", () => {
  it("adds copy, then numbers", () => {
    expect(copyName("Talk", ["Talk"], "copy")).toBe("Talk copy");
    expect(copyName("Talk", ["Talk", "talk copy"], "copy")).toBe("Talk copy 2");
    expect(copyName("Talk", ["Talk copy", "Talk copy 2"], "copy")).toBe("Talk copy 3");
  });
});

describe("duplicateProject", () => {
  it("copies app data only, deeply, and points at the same recording", () => {
    const src = proj(), c = duplicateProject(src, "b", "Talk copy", 9);
    expect(c).toMatchObject({ id: "b", path: src.path, name: "Talk copy", status: "done", names: { SPEAKER_00: "Ana" } });
    expect(c.result).toEqual(src.result); expect(c.result).not.toBe(src.result); expect(c.names).not.toBe(src.names);
    expect(c.previous).toBeUndefined(); expect(c.lastExport).toBeUndefined(); expect(c.openedAt).toBeUndefined();
  });
  it("a project that was never transcribed stays idle", () => expect(duplicateProject(proj({ result: null, status: "error", error: "x" }), "b", "n", 1)).toMatchObject({ status: "idle", result: null }));
});

describe("sharesRecording", () => {
  it("is true only when another project has the same file", () => {
    const a = proj(), b = proj({ id: "b" }), c = proj({ id: "c", path: "/y.mp3" });
    expect(sharesRecording([a, b], a)).toBe(true);
    expect(sharesRecording([a, c], a)).toBe(false);
  });
});

describe("menuStep", () => {
  it("wraps with arrows and jumps with Home and End", () => {
    expect(menuStep("ArrowDown", 3, 4)).toBe(0); expect(menuStep("ArrowUp", 0, 4)).toBe(3);
    expect(menuStep("Home", 2, 4)).toBe(0); expect(menuStep("End", 0, 4)).toBe(3);
    expect(menuStep("a", 0, 4)).toBe(-1); expect(menuStep("ArrowDown", 0, 0)).toBe(-1);
  });
});
