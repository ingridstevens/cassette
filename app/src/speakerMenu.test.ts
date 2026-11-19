import { describe, expect, it } from "vitest";
import { FILTER_AT, assignToNamed, filterSpeakers, nextSpeakerId } from "./speakerMenu";
import type { Result } from "./types";

const seg = (speaker: string, start: number) => ({ start, end: start + 1, speaker, text: "hi", words: [{ start, end: start + 1, word: "hi", speaker, prob: 1 }] });
const res = (): Result => ({ language: "en", duration: 3, speakers: ["SPEAKER_00", "SPEAKER_01"], segments: [seg("SPEAKER_00", 0), seg("SPEAKER_01", 1), seg("SPEAKER_00", 2)] });
const names = { SPEAKER_01: "Zoë" };
const label = (id: string) => names[id as keyof typeof names] ?? id;

describe("speaker menu", () => {
  it("shows the filter only with many speakers", () => { expect(FILTER_AT).toBeGreaterThan(2); });
  it("filters by shown name, ignoring case and accents", () => {
    const sp = ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"];
    expect(filterSpeakers(sp, label, "zoe")).toEqual(["SPEAKER_01"]);
    expect(filterSpeakers(sp, label, "  ZOË ")).toEqual(["SPEAKER_01"]);
    expect(filterSpeakers(sp, label, "")).toEqual(sp);
    expect(filterSpeakers(sp, label, "nobody")).toEqual([]);
  });
  it("picks the next free id, also past ids that only have a name", () => {
    expect(nextSpeakerId(["SPEAKER_00", "SPEAKER_01"], {})).toBe("SPEAKER_02");
    expect(nextSpeakerId(["SPEAKER_00"], { SPEAKER_04: "x" })).toBe("SPEAKER_05");
    expect(nextSpeakerId([], {})).toBe("SPEAKER_00");
    expect(nextSpeakerId(["Host"], {})).toBe("SPEAKER_00");
  });
  it("creates a speaker and gives the line to them, changing only that line", () => {
    const r = res(), out = assignToNamed(r, names, 0, "  Mia ", label)!;
    expect(out.created).toBe(true);
    expect(out.id).toBe("SPEAKER_02");
    expect(out.result.speakers).toEqual(["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"]);
    expect(out.names).toEqual({ SPEAKER_01: "Zoë", SPEAKER_02: "Mia" });
    expect(out.result.segments.map((s) => s.speaker)).toEqual(["SPEAKER_02", "SPEAKER_01", "SPEAKER_00"]);
    expect(out.result.segments[0].words[0].speaker).toBe("SPEAKER_02");
    expect(r.speakers).toHaveLength(2); // the input is not changed
  });
  it("keeps the default name when none is typed", () => {
    const out = assignToNamed(res(), {}, 1, "   ", label)!;
    expect(out.created).toBe(true);
    expect(out.names).toEqual({});
    expect(out.result.speakers).toContain(out.id);
  });
  it("uses an existing speaker when the name is already taken", () => {
    const out = assignToNamed(res(), names, 0, "zoë", label)!;
    expect(out.created).toBe(false);
    expect(out.id).toBe("SPEAKER_01");
    expect(out.result.speakers).toHaveLength(2);
    expect(out.result.segments[0].speaker).toBe("SPEAKER_01");
  });
  it("ignores a line that does not exist", () => { expect(assignToNamed(res(), {}, 9, "A", label)).toBeNull(); });
});
