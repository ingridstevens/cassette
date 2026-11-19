import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, MERGE_MS, emptyHistory, record, stepBack, stepForward } from "./history";
import type { Result } from "./types";

const res = (text: string): Result => ({ language: "en", duration: 1, speakers: ["A"], segments: [{ start: 0, end: 1, speaker: "A", text, words: [] }] });
const snap = (text: string, names: Record<string, string> = {}) => ({ result: res(text), names });
const text = (s: { result: Result }) => s.result.segments[0].text;

describe("undo history", () => {
  it("has nothing to undo or redo when empty", () => {
    expect(stepBack(emptyHistory(), snap("a"))).toBeNull();
    expect(stepForward(emptyHistory(), snap("a"))).toBeNull();
  });
  it("undoes and redoes an edit, with its label", () => {
    let h = record(emptyHistory(), snap("a"), "replace all", 0);
    const back = stepBack(h, snap("b"))!;
    expect(text(back.snap)).toBe("a");
    expect(back.snap.label).toBe("replace all");
    h = back.h;
    const fwd = stepForward(h, snap("a"))!;
    expect(text(fwd.snap)).toBe("b");
    expect(fwd.snap.label).toBe("replace all");
    expect(fwd.h.future).toHaveLength(0);
    expect(fwd.h.past).toHaveLength(1);
  });
  it("walks back through several edits in order", () => {
    let h = emptyHistory();
    h = record(h, snap("a"), "x", 0); h = record(h, snap("b"), "y", 10); h = record(h, snap("c"), "z", 20);
    const one = stepBack(h, snap("d"))!; expect(text(one.snap)).toBe("c");
    const two = stepBack(one.h, one.snap)!; expect(text(two.snap)).toBe("b");
    const three = stepBack(two.h, two.snap)!; expect(text(three.snap)).toBe("a");
    expect(stepBack(three.h, three.snap)).toBeNull();
  });
  it("brings back the speaker names too", () => {
    const h = record(emptyHistory(), snap("a", { A: "Ann" }), "rename", 0);
    expect(stepBack(h, snap("a", { A: "Bo" }))!.snap.names).toEqual({ A: "Ann" });
  });
  it("a new edit clears the redo stack", () => {
    const h = record(emptyHistory(), snap("a"), "x", 0);
    const back = stepBack(h, snap("b"))!;
    expect(back.h.future).toHaveLength(1);
    expect(record(back.h, snap("a"), "y", 5).future).toHaveLength(0);
  });
  it("keeps at most the last 200 steps", () => {
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, snap(String(i)), "x", i * 10000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(text(h.past[0])).toBe("20");
  });
  it("merges quick repeats of a merge-able edit, but not slow ones or other kinds", () => {
    let h = record(emptyHistory(), snap("a"), "rename", 0, true);
    h = record(h, snap("b"), "rename", 100, true);
    expect(h.past).toHaveLength(1);
    expect(text(h.past[0])).toBe("a");  // the state before the first keystroke
    h = record(h, snap("c"), "rename", 100 + MERGE_MS + 1, true);
    expect(h.past).toHaveLength(2);
    h = record(h, snap("d"), "mark", 100 + MERGE_MS + 2, true);
    expect(h.past).toHaveLength(3);
  });
  it("does not change the history it is given", () => {
    const h = record(emptyHistory(), snap("a"), "x", 0);
    stepBack(h, snap("b"));
    expect(h.past).toHaveLength(1);
  });
});

import { toggleHeard } from "./types";
import type { Segment } from "./types";
describe("toggleHeard", () => {
  const seg = (text: string): Segment => ({ start: 0, end: 1, speaker: "A", text, words: [] });
  it("sets and clears the mark on one line only, without touching the input", () => {
    const segs = [seg("a"), seg("b")];
    const on = toggleHeard(segs, 1);
    expect(on[1].heard).toBe(true);
    expect(on[0]).toBe(segs[0]);
    expect(segs[1].heard).toBeUndefined();
    const off = toggleHeard(on, 1);
    expect("heard" in off[1]).toBe(false);
  });
  it("leaves a project saved without the field alone", () => {
    expect(toggleHeard([seg("a")], 5)).toEqual([seg("a")]);
  });
});
