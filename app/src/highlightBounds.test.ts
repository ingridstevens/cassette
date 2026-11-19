import { describe, expect, it } from "vitest";
import { dragEdge, nudgeStep, nudgeWord } from "./highlightBounds";
import type { Highlight, Segment } from "./types";

const w = (word: string, start: number, end: number) => ({ start, end, word, speaker: "A" });
const seg: Segment = { start: 0, end: 5, speaker: "A", text: "one two three four five", words: [w("one", 0, 1), w(" two", 1, 2), w(" three", 2, 3), w(" four", 3, 4), w(" five", 4, 5)] };
const h: Highlight = { id: "h", start: 1, end: 4, text: "two three four", speaker: "A" };
const S = [seg];

describe("nudgeWord", () => {
  it("moves the start earlier and later by one word and rewrites the text", () => {
    expect(nudgeWord(S, h, "start", -1, 5)).toMatchObject({ start: 0, end: 4, text: "one two three four" });
    expect(nudgeWord(S, h, "start", 1, 5)).toMatchObject({ start: 2, end: 4, text: "three four" });
  });
  it("moves the end", () => {
    expect(nudgeWord(S, h, "end", 1, 5)).toMatchObject({ start: 1, end: 5, text: "two three four five" });
    expect(nudgeWord(S, h, "end", -1, 5)).toMatchObject({ start: 1, end: 3, text: "two three" });
  });
  it("stops at the recording edges and never crosses the other edge", () => {
    expect(nudgeWord(S, { ...h, start: 0 }, "start", -1, 5)).toBeNull();
    expect(nudgeWord(S, { ...h, end: 5 }, "end", 1, 5)).toBeNull();
    const one = { ...h, start: 2, end: 3, text: "three" };
    expect(nudgeWord(S, one, "start", 1, 5)).toBeNull();
    expect(nudgeWord(S, one, "end", -1, 5)).toBeNull();
  });
});

describe("nudgeStep", () => {
  it("moves by a fixed step", () => {
    expect(nudgeStep(S, h, "start", -0.1, 5)).toMatchObject({ start: 0.9, end: 4 });
    expect(nudgeStep(S, h, "end", 0.1, 5)).toMatchObject({ start: 1, end: 4.1 });
  });
  it("clamps to 0 and the duration and keeps start < end", () => {
    expect(nudgeStep(S, { ...h, start: 0 }, "start", -0.1, 5)).toBeNull();
    expect(nudgeStep(S, { ...h, end: 5 }, "end", 0.1, 5)).toBeNull();
    expect(nudgeStep(S, { ...h, start: 0.05 }, "start", -0.1, 5)).toMatchObject({ start: 0 });
    const r = nudgeStep(S, { ...h, start: 1, end: 1.15 }, "start", 1, 5);
    expect(r).toMatchObject({ start: 1.05 });
    expect(r!.end - r!.start).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });
  it("rejects non-finite values", () => {
    expect(nudgeStep(S, h, "end", NaN, 5)).toBeNull();
  });
});

describe("dragEdge", () => {
  it("snaps to the nearest word boundary", () => {
    expect(dragEdge(S, h, "start", 1.9, 5)).toMatchObject({ start: 2, text: "three four" });
    expect(dragEdge(S, h, "end", 4.8, 5)).toMatchObject({ end: 5 });
  });
  it("does not cross the other edge or accept junk", () => {
    expect(dragEdge(S, h, "start", 4.9, 5)!.start).toBeLessThan(h.end);
    expect(dragEdge(S, h, "end", Infinity, 5)).toBeNull();
    expect(dragEdge(S, h, "end", 1.0, 5)!.end).toBeGreaterThan(h.start);
  });
});
