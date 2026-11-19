import { describe, expect, it } from "vitest";
import { extendSel, selBounds, startSel } from "./wordSelection";

const words = [0, 1, 2, 3, 4].map((i) => ({ start: i, end: i + 1 }));

describe("startSel", () => {
  it("starts at the word being played in this line", () => expect(startSel(words, 2.5, 1)).toEqual({ anchor: 2, head: 2 }));
  it("else at the first word going right and the last going left", () => {
    expect(startSel(words, 99, 1)).toEqual({ anchor: 0, head: 0 });
    expect(startSel(words, 99, -1)).toEqual({ anchor: 4, head: 4 });
  });
  it("is null for a line without words", () => expect(startSel([], 0, 1)).toBeNull());
});

describe("extendSel and selBounds", () => {
  it("grows to the right, and shrinks back when the other way is pressed", () => {
    let s = startSel(words, 1.5, 1)!;
    s = extendSel(s, 1, 5); s = extendSel(s, 1, 5);
    expect(selBounds(s)).toEqual([1, 3]);
    s = extendSel(s, -1, 5);
    expect(selBounds(s)).toEqual([1, 2]);
  });
  it("goes left of the start too", () => {
    let s = startSel(words, 1.5, -1)!;
    s = extendSel(s, -1, 5);
    expect(selBounds(s)).toEqual([0, 1]);
  });
  it("stays inside the line", () => {
    expect(extendSel({ anchor: 4, head: 4 }, 1, 5).head).toBe(4);
    expect(extendSel({ anchor: 0, head: 0 }, -1, 5).head).toBe(0);
  });
});
