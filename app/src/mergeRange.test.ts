import { describe, expect, it } from "vitest";
import { mergeRange } from "./useProjects";
import type { Result, Segment } from "./types";

const seg = (start: number, end: number, speaker = "A", text = `${start}`): Segment => ({ start, end, speaker, text, words: [{ start, end, word: text, speaker } as never] });
const res = (segments: Segment[], speakers = ["A"]): Result => ({ language: "en", duration: 100, speakers, segments });

describe("mergeRange", () => {
  const prev = res([seg(0, 10), seg(10, 20), seg(20, 30)]);
  it("replaces the segments inside the range and keeps the rest in order", () => {
    const out = mergeRange(prev, res([seg(10, 15, "A", "new")]), [10, 20]);
    expect(out.segments.map((s) => s.text)).toEqual(["0", "new", "20"]);
  });
  it("drops segments that overlap the range", () => {
    const out = mergeRange(prev, res([seg(5, 25, "A", "wide")]), [5, 25]);
    expect(out.segments.map((s) => s.text)).toEqual(["wide"]);
  });
  it("adds new speakers without repeating old ones", () => {
    const out = mergeRange(prev, res([seg(10, 20, "B")], ["A", "B"]), [10, 20]);
    expect(out.speakers).toEqual(["A", "B"]);
  });
  it("keeps the speaker and sets the language when one line is redone", () => {
    const out = mergeRange(prev, res([seg(10, 20, "SPEAKER_9", "hola")]), [10, 20], { language: "es", speaker: "A" });
    const s = out.segments[1];
    expect(s).toMatchObject({ speaker: "A", lang: "es", text: "hola" });
    expect(s.words.every((w) => w.speaker === "A")).toBe(true);
    expect(out.speakers).toEqual(["A"]);
  });
  it("does not change the previous result", () => {
    mergeRange(prev, res([seg(10, 15, "A", "new")]), [10, 20]);
    expect(prev.segments.map((s) => s.text)).toEqual(["0", "10", "20"]);
  });
});
