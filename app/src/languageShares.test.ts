import { describe, expect, it } from "vitest";
import { languageShares } from "./languageShares";
import { ALL, DEFAULT_SHOWN, needsTranslation, shownFormats } from "./exportFormats";

const seg = (start: number, end: number, lang?: string) => ({ start, end, lang });

describe("language shares", () => {
  it("counts seconds per language, the recording's language for untagged lines, most spoken first", () => {
    const r = languageShares([seg(0, 30), seg(30, 50, "en"), seg(50, 60)], "de");
    expect(r.map((x) => [x.lang, x.seconds, x.percent])).toEqual([["de", 40, 67], ["en", 20, 33]]);
  });
  it("adds up to 100", () => {
    const r = languageShares([seg(0, 1, "a"), seg(1, 2, "b"), seg(2, 3, "c")]);
    expect(r.reduce((n, x) => n + x.percent, 0)).toBe(100);
  });
  it("gives nothing for no speech or no language", () => {
    expect(languageShares([])).toEqual([]);
    expect(languageShares([seg(0, 5)])).toEqual([]);
    expect(languageShares([seg(3, 3, "en")])).toEqual([]);
  });
});

describe("bilingual formats in the Export menu", () => {
  it("are registered, but not up front and not in Easy mode", () => {
    for (const f of ["bilingual", "bilingual-srt", "languages"]) {
      expect(ALL.some(([id]) => id === f)).toBe(true);
      expect(DEFAULT_SHOWN).not.toContain(f);
      expect(shownFormats(undefined, true)).not.toContain(f);
    }
  });
  it("need a translated line, the language shares do not", () => {
    expect(needsTranslation("bilingual", 0)).toBe(true);
    expect(needsTranslation("bilingual-srt", 0)).toBe(true);
    expect(needsTranslation("bilingual", 2)).toBe(false);
    expect(needsTranslation("languages", 0)).toBe(false);
    expect(needsTranslation("docx", 0)).toBe(false);
  });
});
