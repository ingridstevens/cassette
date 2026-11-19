import { describe, expect, it } from "vitest";
import { ALL, DEFAULT_SHOWN, isDefaultShown, normaliseShown, shownFormats, toggleShown } from "./exportFormats";

describe("formats in the Export menu", () => {
  it("uses the default set when nothing (or something malformed) was saved", () => {
    for (const raw of [undefined, null, "docx", 3, {}]) expect(normaliseShown(raw)).toEqual(DEFAULT_SHOWN);
  });
  it("keeps the chosen formats in menu order and drops unknown and repeated ids", () => {
    expect(normaliseShown(["json", "nope", "docx", "docx", 7, "srt"])).toEqual(["docx", "srt", "json"]);
  });
  it("keeps an empty choice empty (More formats still reaches everything)", () => {
    expect(normaliseShown([])).toEqual([]);
  });
  it("offers every known format as a choice", () => {
    expect(normaliseShown(ALL.map(([f]) => f))).toHaveLength(ALL.length);
  });
  it("ticks and unticks one format, starting from the default set", () => {
    expect(toggleShown(undefined, "csv", true)).toEqual([...DEFAULT_SHOWN.slice(0, 5), "csv", "minutes"].sort((a, b) => ALL.findIndex((x) => x[0] === a) - ALL.findIndex((x) => x[0] === b)));
    expect(toggleShown(undefined, "docx", false)).not.toContain("docx");
    expect(toggleShown(["docx"], "docx", true)).toEqual(["docx"]);
  });
  it("knows when the choice is the default", () => {
    expect(isDefaultShown(undefined)).toBe(true);
    expect(isDefaultShown([...DEFAULT_SHOWN].reverse())).toBe(true);
    expect(isDefaultShown(["docx"])).toBe(false);
  });
  it("leaves Easy mode with its fixed two items", () => {
    expect(shownFormats(["csv", "json"], true)).toEqual(["docx", "print"]);
    expect(shownFormats(["csv", "json"], false)).toEqual(["csv", "json"]);
  });
});
