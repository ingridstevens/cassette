import { describe, expect, it } from "vitest";
import { quoteText, toolbarPosition } from "./selectionToolbar";

const view = { width: 1000, height: 700 }, bar = { width: 300, height: 40 };

describe("selection toolbar position", () => {
  it("sits above the selection, centred", () => {
    const p = toolbarPosition({ top: 300, left: 400, width: 200, height: 20 }, bar, view);
    expect(p).toEqual({ top: 252, left: 350, placement: "above" });
  });
  it("goes below when there is no room above, without covering the selection", () => {
    const p = toolbarPosition({ top: 20, left: 400, width: 200, height: 20 }, bar, view);
    expect(p.placement).toBe("below");
    expect(p.top).toBeGreaterThanOrEqual(40);
  });
  it("stays inside the viewport at both sides", () => {
    expect(toolbarPosition({ top: 300, left: 0, width: 20, height: 20 }, bar, view).left).toBe(8);
    expect(toolbarPosition({ top: 300, left: 990, width: 10, height: 20 }, bar, view).left).toBe(692);
  });
  it("stays on screen when the selection is out of view", () => {
    const p = toolbarPosition({ top: 900, left: 100, width: 50, height: 20 }, bar, view);
    expect(p.top).toBeLessThanOrEqual(700 - 8 - 40);
  });
});

describe("quoteText", () => {
  const words = [{ word: " Hello" }, { word: " big" }, { word: " world." }];
  it("quotes only the selected words with speaker and time", () => {
    expect(quoteText("Ana", "0:03", words, 1, 2)).toBe("Ana (0:03): big world.");
  });
});
