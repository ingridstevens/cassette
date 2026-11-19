import { describe, expect, it } from "vitest";
import { RangeStop, rangeOfWords } from "./playRange";

const words = [{ start: 1, end: 1.4 }, { start: 1.4, end: 2 }, { start: 2, end: 2.5 }, { start: 2.5, end: 3 }];

describe("rangeOfWords", () => {
  it("runs from the first selected word's start to the last one's end", () => expect(rangeOfWords(words, 1, 2)).toEqual({ start: 1.4, end: 2.5 }));
  it("accepts the ends in either order and clamps to the words there are", () => expect(rangeOfWords(words, 9, 2)).toEqual({ start: 2, end: 3 }));
  it("is one word's span for one word", () => expect(rangeOfWords(words, 0, 0)).toEqual({ start: 1, end: 1.4 }));
  it("is null without timing", () => {
    expect(rangeOfWords([], 0, 0)).toBeNull();
    expect(rangeOfWords([{ start: 2, end: 2 }], 0, 0)).toBeNull();
    expect(rangeOfWords([{ start: NaN, end: 3 }], 0, 0)).toBeNull();
  });
});

describe("RangeStop", () => {
  it("does nothing until armed, so normal play is untouched", () => {
    const r = new RangeStop();
    expect(r.armed).toBe(false);
    expect(r.tick(1000)).toBe(false);
  });
  it("fires once when the playhead reaches the end", () => {
    const r = new RangeStop(); r.arm(2.5);
    expect(r.tick(2.4)).toBe(false);
    expect(r.armed).toBe(true);
    expect(r.tick(2.5)).toBe(true);
    expect(r.armed).toBe(false);
    expect(r.tick(3)).toBe(false);
  });
  it("is cleared by a manual pause or seek, and does not stop later playback", () => {
    const r = new RangeStop(); r.arm(2.5); r.clear();
    expect(r.tick(9)).toBe(false);
  });
  it("a new range replaces the old one", () => {
    const r = new RangeStop(); r.arm(2); r.arm(5);
    expect(r.tick(3)).toBe(false);
    expect(r.tick(5.01)).toBe(true);
  });
  it("ignores a time that is not a number and a bad end", () => {
    const r = new RangeStop(); r.arm(2);
    expect(r.tick(NaN)).toBe(false);
    r.arm(NaN);
    expect(r.armed).toBe(false);
  });
});
