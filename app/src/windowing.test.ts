import { describe, expect, it } from "vitest";
import { DEFAULT_ROW, renderIndices, rowOffsets, scrollToTurn, spacerHeight, visibleRange } from "./windowing";

describe("rowOffsets", () => {
  it("stacks measured rows with the gap between them", () => { expect(rowOffsets([100, 50, 80], 3, 2)).toEqual([0, 102, 154, 236]); });
  it("guesses unmeasured rows from the average of the measured ones", () => { expect(rowOffsets([100, undefined, 50, undefined], 4, 0)).toEqual([0, 100, 175, 225, 300]); });
  it("uses a default when nothing is measured", () => { expect(rowOffsets([], 2, 0)).toEqual([0, DEFAULT_ROW, DEFAULT_ROW * 2]); });
  it("handles an empty list", () => { expect(rowOffsets([], 0, 2)).toEqual([0]); });
});

describe("visibleRange", () => {
  const offsets = rowOffsets(new Array(1000).fill(100), 1000, 0);
  it("covers the rows in view", () => { expect(visibleRange(offsets, 0, 300, 0)).toEqual([0, 3]); });
  it("includes a row that is only partly in view", () => { expect(visibleRange(offsets, 150, 250, 0)).toEqual([1, 3]); });
  it("widens by the overscan on both sides", () => { expect(visibleRange(offsets, 5000, 5300, 200)).toEqual([48, 55]); });
  it("stays inside the list at both ends", () => {
    expect(visibleRange(offsets, -500, 100, 0)[0]).toBe(0);
    expect(visibleRange(offsets, 99000, 99900, 600)[1]).toBe(1000);
  });
  it("keeps at least one row when scrolled past the end", () => { expect(visibleRange(offsets, 1e6, 1e6 + 500, 0)).toEqual([999, 1000]); });
  it("draws a small slice of a 5,000-line transcript", () => {
    const big = rowOffsets(new Array(5000).fill(undefined), 5000, 2);
    const [s, e] = visibleRange(big, 200000, 200800, 600);
    expect(e - s).toBeLessThan(30);
    expect(s).toBeGreaterThan(1500);
  });
  it("is empty for no rows", () => { expect(visibleRange([0], 0, 100, 0)).toEqual([0, 0]); });
});

describe("renderIndices", () => {
  it("lists the window in order", () => { expect(renderIndices(10, [2, 5], [])).toEqual([2, 3, 4]); });
  it("adds pinned rows outside the window, sorted and without repeats", () => { expect(renderIndices(10, [4, 6], [9, 0, 5, 5])).toEqual([0, 4, 5, 9]); });
  it("ignores pinned rows that do not exist", () => { expect(renderIndices(3, [0, 2], [7, -1, 1.5])).toEqual([0, 1]); });
});

describe("spacerHeight", () => {
  it("makes a spacer and its two gaps as tall as the rows it replaces", () => {
    const gap = 2, o = rowOffsets([100, 100, 100, 100], 4, gap); // rows 1 and 2 are replaced
    expect(spacerHeight(o, 1, 3, gap) + gap).toBe(o[3] - o[1]);
  });
  it("never goes negative", () => { expect(spacerHeight([0, 1], 0, 1, 2)).toBe(0); });
});

describe("scrollToTurn", () => {
  it("resolves with null when no transcript is on screen", async () => { await expect(scrollToTurn(3)).resolves.toBeNull(); });
});
