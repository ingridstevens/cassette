import { describe, expect, it } from "vitest";
import { canPreviewVideo, videoSeekTarget } from "./videoSync";

describe("videoSeekTarget", () => {
  it("leaves a picture that is close to the audio alone", () => {
    expect(videoSeekTarget(10.1, 10, true)).toBeNull();
    expect(videoSeekTarget(10.02, 10, false)).toBeNull();
  });
  it("moves the picture to the audio when it drifted or after a seek", () => {
    expect(videoSeekTarget(10.5, 10, true)).toBe(10);
    expect(videoSeekTarget(0, 42, true)).toBe(42);
    expect(videoSeekTarget(10.1, 10, false)).toBe(10);
  });
  it("ignores a time that is not a position", () => {
    expect(videoSeekTarget(5, NaN, true)).toBeNull();
    expect(videoSeekTarget(5, -1, false)).toBeNull();
  });
});

describe("canPreviewVideo", () => {
  const chromium = (m: string) => (m === "video/mp4" || m === "video/webm" ? "probably" : "");
  it("accepts what the engine can play", () => {
    expect(canPreviewVideo("/a/b.MP4", chromium)).toBe(true);
    expect(canPreviewVideo("/a/b.webm", chromium)).toBe(true);
  });
  it("refuses containers it cannot play, unknown types and throwing engines", () => {
    expect(canPreviewVideo("/a/b.mkv", chromium)).toBe(false);
    expect(canPreviewVideo("/a/b.mov", chromium)).toBe(false);
    expect(canPreviewVideo("/a/b.m4a", chromium)).toBe(false);
    expect(canPreviewVideo("/a/b.mp4", () => { throw new Error("x"); })).toBe(false);
  });
});
