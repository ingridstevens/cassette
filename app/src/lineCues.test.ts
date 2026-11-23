import { describe, expect, it } from "vitest";
import { CUED_FORMATS, boundaryCues, quoteCues, unconfirmedSpeakers, unsureOf, untranscribedFrom } from "./lineCues";
import { assignToNamed } from "./speakerMenu";
import { matchSpeakers } from "./sources";
import { fixWord, joinWithPrevious, reattribute, retext, revertLine, acceptWord, splitSegment } from "./types";
import type { Part, Result, Segment, Word } from "./types";

const w = (start: number, end: number, word: string, speaker: string, extra: Partial<Word> = {}): Word => ({ start, end, word, speaker, ...extra });
const seg = (speaker: string, text: string, extra: Partial<Segment> = {}): Segment => ({
  start: 0, end: 4, speaker, text, words: text.split(" ").map((t, i) => w(i, i + 1, (i ? " " : "") + t, speaker)), ...extra,
});
const t = (s: string, v?: Record<string, string | number>) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => String(v[k])) : s);
const part = (id: string, over: Partial<Part> = {}): Part => ({ id, path: `/${id}.wav`, name: `${id}.wav`, offset: 100, duration: 50, ...over });

describe("which words and speakers a reader is warned about", () => {
  it("lists only unsure words nobody confirmed", () => {
    const words = [w(0, 1, "Brandt", "A", { prob: 0.2 }), w(1, 2, " will", "A", { prob: 0.9 }), w(2, 3, " send", "A", { prob: 0.1, checked: true }), w(3, 4, " it", "A")];
    expect(unsureOf(words)).toEqual(["Brandt"]);
  });
  it("calls a speaker from an added recording unconfirmed until it is matched or named", () => {
    const parts = [part("s2", { speakers: ["SPEAKER_01", "SPEAKER_02"] })];
    const speakers = ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"];
    expect(unconfirmedSpeakers(parts, speakers, {})).toEqual(["SPEAKER_01", "SPEAKER_02"]);
    expect(unconfirmedSpeakers(parts, speakers, { SPEAKER_01: "Ben" })).toEqual(["SPEAKER_02"]);
    expect(unconfirmedSpeakers([{ ...parts[0], matched: true }], speakers, {})).toEqual([]);
    expect(unconfirmedSpeakers(parts, ["SPEAKER_00"], {})).toEqual([]); // matched away: no longer a speaker
  });
  it("says nothing for a project with one recording", () => {
    expect(unconfirmedSpeakers(undefined, ["SPEAKER_00"], {})).toEqual([]);
    expect(boundaryCues([part("s1", { offset: 0 })])).toEqual([]);
    expect(untranscribedFrom(undefined, 600)).toEqual([]);
  });
  it("hands the engine each noted boundary and the rest of a sample", () => {
    const parts = [part("s1", { offset: 0 }), part("s2", { offset: 100, join: { kind: "gap", seconds: 12 } }), part("s3", { offset: 150 }), part("s4", { offset: 200, join: { kind: "unknown" } }), part("s5", { offset: 250, join: { kind: "overlap", seconds: 3 } })];
    expect(boundaryCues(parts)).toEqual([{ at: 100, kind: "gap", seconds: 12 }, { at: 200, kind: "unknown" }, { at: 250, kind: "overlap", seconds: 3 }]);
    expect(untranscribedFrom(true, 180)).toEqual([{ start: 180 }]);
  });
  it("covers the text, Word and quote exports and nothing else", () => {
    expect([...CUED_FORMATS].sort()).toEqual(["docx", "quotes", "txt"]);
  });
});

describe("Copy quote", () => {
  const s = seg("B", "Brandt will send it", { words: [w(0, 1, "Brandt", "B", { prob: 0.2 }), w(1, 2, " will", "B"), w(2, 3, " send", "B", { prob: 0.3 }), w(3, 4, " it", "B")] });
  it("adds nothing to a clean line", () => expect(quoteCues(t, seg("A", "All fine"), ["B"])).toBe(""));
  it("names the unsure words and the unconfirmed speaker apart", () => {
    expect(quoteCues(t, s, ["B"])).toBe(" [wording unsure: Brandt, send, speaker unconfirmed]");
    expect(quoteCues(t, s, [])).toBe(" [wording unsure: Brandt, send]");
  });
  it("limits the unsure words to the quoted ones", () => expect(quoteCues(t, s, [], s.words.slice(1, 4))).toBe(" [wording unsure: send]"));
  it("says a checked line was checked, and nothing else", () => expect(quoteCues(t, { ...s, heard: true }, ["B"])).toBe(" [checked by a person]"));
});

describe("the checked mark goes when wording or speaker changes", () => {
  const checked = seg("A", "We ship on Friday", { heard: true });
  it("keeps it when nothing changes", () => {
    expect(retext(checked, "We ship on Friday").heard).toBe(true);
    expect(reattribute(checked, "A")).toBe(checked);
    expect(acceptWord(checked, 0).heard).toBe(true);
    expect(splitSegment(checked, 2)![0].heard).toBe(true);
  });
  it("drops it when the text is edited, a word is fixed or the line is put back", () => {
    const edited = retext(checked, "We ship on Monday");
    expect("heard" in edited).toBe(false);
    expect("heard" in fixWord(checked, 3, "Monday")).toBe(false);
    expect("heard" in revertLine({ ...edited, heard: true })).toBe(false);
  });
  it("drops it when the line moves to another speaker, but not for the others", () => {
    const moved = reattribute(checked, "B");
    expect(moved.speaker).toBe("B");
    expect(moved.words.every((x) => x.speaker === "B")).toBe(true);
    expect("heard" in moved).toBe(false);
  });
  it("drops it when someone gives the line to a new or named speaker", () => {
    const r: Result = { language: "en", duration: 10, speakers: ["A", "B"], segments: [checked, seg("B", "ok", { heard: true })] };
    const out = assignToNamed(r, {}, 0, "Carla", (id) => id)!;
    expect("heard" in out.result.segments[0]).toBe(false);
    expect(out.result.segments[1].heard).toBe(true);
  });
  it("drops it for lines whose speaker is matched to another", () => {
    const r: Result = { language: "en", duration: 10, speakers: ["A", "B"], segments: [seg("A", "one", { heard: true }), seg("B", "two", { heard: true })] };
    const out = matchSpeakers(r, {}, { B: "A" }).result.segments;
    expect(out.map((s) => s.speaker)).toEqual(["A", "A"]);
    expect(out[0].heard).toBe(true); // already A's: unchanged
    expect("heard" in out[1]).toBe(false);
  });
  it("keeps it on a joined line only when both lines were checked", () => {
    expect(joinWithPrevious([checked, seg("A", "next", { heard: true })], 1)![0].heard).toBe(true);
    expect("heard" in joinWithPrevious([checked, seg("A", "next")], 1)![0]).toBe(false);
    expect("heard" in joinWithPrevious([seg("A", "first"), { ...seg("A", "next"), heard: true }], 1)![0]).toBe(false);
  });
});
