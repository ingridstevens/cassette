import { describe, expect, it } from "vitest";
import { EASY_FORMATS, formatsFor, isEasy, shouldAskEasy } from "./easy";

describe("easy mode", () => {
  it("is off by default", () => {
    expect(isEasy({})).toBe(false);
    expect(isEasy({ easy: false })).toBe(false);
    expect(isEasy({ easy: true })).toBe(true);
  });
  it("asks once, only when nothing was chosen and there are no projects", () => {
    expect(shouldAskEasy({}, 0)).toBe(true);
    expect(shouldAskEasy({}, 2)).toBe(false);
    expect(shouldAskEasy({ easy: false }, 0)).toBe(false);
    expect(shouldAskEasy({ easy: true }, 0)).toBe(false);
  });
  const all = [["docx", "Word"], ["txt", "Text"], ["print", "Print"], ["print-large", "Large"], ["srt", "SRT"], ["minutes", "Minutes"]] as const;
  it("offers only Word and Print in easy mode", () => {
    expect(formatsFor(all, true).map((f) => f[0])).toEqual(EASY_FORMATS);
  });
  it("offers every format otherwise", () => {
    expect(formatsFor(all, false)).toHaveLength(all.length);
  });
});
