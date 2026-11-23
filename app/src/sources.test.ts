import { describe, expect, it } from "vitest";
import { clipOf, hasParts, joinAdded, locate, matchSpeakers, readParts, redoTarget, shiftResult, sourcesOf, timelineLength } from "./sources";
import { duplicateProject } from "./projectActions";
import { readRestorePoint, restoreFrom, takeRestorePoint } from "./restorePoint";
import { createKnownPaths } from "../electron/knownPaths";
import type { Project, Result, Segment, Word } from "./types";

const w = (start: number, end: number, word: string, speaker: string, extra: Partial<Word> = {}): Word => ({ start, end, word, speaker, ...extra });
const seg = (start: number, end: number, speaker: string, text: string, extra: Partial<Segment> = {}): Segment => ({ start, end, speaker, text, words: text.split(" ").map((t, i, a) => w(start + ((end - start) * i) / a.length, start + ((end - start) * (i + 1)) / a.length, (i ? " " : "") + t, speaker)), ...extra });

// Two phones with different formats and levels: phone one (an .m4a, quiet, 100 s) and phone two (a .wav, loud, 40 s). Each was transcribed on its own, so both call their first speaker SPEAKER_00.
const partOne: Result = {
  language: "en", duration: 100, speakers: ["SPEAKER_00", "SPEAKER_01"],
  segments: [
    seg(0, 10, "SPEAKER_00", "Thanks for coming in", { edited: true, orig: { text: "Thanks for cooming in", words: [] }, heard: true }),
    seg(10, 20, "SPEAKER_01", "Happy to be here", { words: [w(10, 12, "Happy", "SPEAKER_01", { prob: 0.3, checked: true }), w(12, 14, " to", "SPEAKER_01"), w(14, 17, " be", "SPEAKER_01"), w(17, 20, " here", "SPEAKER_01")] }),
    seg(90, 100, "SPEAKER_00", "Let me call you back", { marked: true, chapter: "Wrap-up" }),
  ],
  highlights: [{ id: "h1", start: 10, end: 20, text: "Happy to be here", speaker: "SPEAKER_01" }],
};
const partTwo: Result = {
  language: "de", duration: 40, speakers: ["SPEAKER_00"],
  segments: [seg(2, 12, "SPEAKER_00", "Ja, hier bin ich wieder"), seg(30, 40, "SPEAKER_00", "Bis bald")],
};
const phoneA = { path: "/phones/a.m4a", source: { size: 1000, sample: "aaa" } };
const base = (over: Partial<Project> = {}): Project => ({ id: "p", name: "Interview", addedAt: 1, status: "done", names: { SPEAKER_00: "Ana", SPEAKER_01: "Ben" }, result: partOne, ...phoneA, ...over });
const add = { id: "s2", path: "/phones/b.wav", name: "b.wav", offset: 100, source: { size: 2000, sample: "bbb" } };
const joined = () => { const j = joinAdded(base(), partTwo, add, 40)!; return base({ ...j }); };

describe("sourcesOf", () => {
  it("treats a project saved before recordings could be added as one source starting at 0", () => {
    const parts = sourcesOf(base());
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ id: "s1", path: "/phones/a.m4a", offset: 0, duration: 100, source: phoneA.source });
    expect(hasParts(base())).toBe(false);
  });
  it("lists the first recording, then the added ones, with stable ids; the first one follows the project's own path", () => {
    const p = joined();
    expect(sourcesOf(p).map((x) => [x.id, x.path, x.offset, x.duration])).toEqual([["s1", "/phones/a.m4a", 0, 100], ["s2", "/phones/b.wav", 100, 40]]);
    const moved = sourcesOf({ ...p, path: "/new/a.m4a" });
    expect(moved[0].path).toBe("/new/a.m4a");
    expect(moved[1].id).toBe("s2");
    expect(timelineLength(sourcesOf(p))).toBe(140);
  });
});

describe("locate: seeking on both sides of the join", () => {
  const parts = sourcesOf(joined());
  it("finds the recording and the place in it", () => {
    expect(locate(parts, 0)).toEqual({ index: 0, local: 0 });
    expect(locate(parts, 99.5)).toEqual({ index: 0, local: 99.5 });
    expect(locate(parts, 100)).toEqual({ index: 1, local: 0 });
    expect(locate(parts, 112)).toEqual({ index: 1, local: 12 });
    expect(locate(parts, 139)).toEqual({ index: 1, local: 39 });
  });
  it("stays inside the nearest recording for a time outside the timeline", () => {
    expect(locate(parts, -5)).toEqual({ index: 0, local: 0 });
    expect(locate(parts, 500).index).toBe(1);
  });
  it("is the identity for a project with one recording", () => {
    expect(locate(sourcesOf(base()), 42)).toEqual({ index: 0, local: 42 });
  });
});

describe("clipOf and redoTarget", () => {
  const parts = sourcesOf(joined());
  it("cuts a clip from the recording it is in, in that recording's own time", () => {
    expect(clipOf(parts, 112, 118)).toEqual({ path: "/phones/b.wav", start: 12, end: 18, index: 1 });
    expect(clipOf(parts, 10, 20)).toEqual({ path: "/phones/a.m4a", start: 10, end: 20, index: 0 });
  });
  it("cuts a clip that runs over the join at the end of the recording it starts in", () => {
    expect(clipOf(parts, 95, 110)).toEqual({ path: "/phones/a.m4a", start: 95, end: 100, index: 0 });
  });
  it("a project with one recording clips and redoes exactly as before: the same file, the same seconds", () => {
    const one = sourcesOf(base());
    expect(clipOf(one, 12, 18)).toEqual({ path: "/phones/a.m4a", start: 12, end: 18, index: 0 });
    expect(clipOf(one, 95, 130)).toMatchObject({ start: 95, end: 130 }); // nothing to cut at: the only recording has no join
    expect(redoTarget(one, [10, 20])).toEqual({ path: "/phones/a.m4a", offset: 0, local: [10, 20], global: [10, 20] });
  });
  it("redoes a stretch on its own recording and says where the result goes on the timeline", () => {
    expect(redoTarget(parts, [102, 112])).toEqual({ path: "/phones/b.wav", offset: 100, local: [2, 12], global: [102, 112] });
    expect(redoTarget(parts, [96, 120])).toMatchObject({ path: "/phones/a.m4a", local: [96, 100], global: [96, 100] });
  });
});

describe("joinAdded: part one survives the append", () => {
  const before = structuredClone(partOne);
  const p = joined();
  it("leaves every line, edit, checked word, mark, chapter and highlight of part one exactly as it was", () => {
    expect(p.result!.segments.slice(0, 3)).toEqual(before.segments);
    expect(p.result!.highlights).toEqual(before.highlights);
    expect(p.names).toEqual({ SPEAKER_00: "Ana", SPEAKER_01: "Ben" });
    expect(partOne).toEqual(before); // the input was not changed either
  });
  it("puts part two on the timeline after part one, with its own length", () => {
    expect(p.result!.segments.slice(3).map((s) => [s.start, s.end])).toEqual([[102, 112], [130, 140]]);
    expect(p.result!.segments[3].words.every((x) => x.start >= 100 && x.end <= 140)).toBe(true);
    expect(p.result!.duration).toBe(140);
    expect(p.appended).toEqual([expect.objectContaining({ id: "s2", offset: 100, duration: 40, path: "/phones/b.wav" })]);
  });
  it("gives the second phone's speaker an id nobody uses and tags its other language", () => {
    expect(p.result!.speakers).toEqual(["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"]);
    expect(p.result!.segments[3].speaker).toBe("SPEAKER_02");
    expect(p.result!.segments[3].words.every((x) => x.speaker === "SPEAKER_02")).toBe(true);
    expect(p.result!.segments[3].lang).toBe("de");
    expect(p.result!.segments[0].speaker).toBe("SPEAKER_00");
    expect(p.appended![0].speakers).toEqual(["SPEAKER_02"]);
  });
  it("survives a restart: saved as JSON and read back it has the same edits and the same seek map", () => {
    const back = JSON.parse(JSON.stringify({ ...p, appended: p.appended })) as Project;
    back.appended = readParts(back.appended);
    expect(back.result).toEqual(p.result);
    expect(sourcesOf(back)).toEqual(sourcesOf(p));
    expect(locate(sourcesOf(back), 101).index).toBe(1);
    expect(locate(sourcesOf(back), 99).index).toBe(0);
  });
  it("a second added recording starts where the last one ends", () => {
    const again = joinAdded(p, partTwo, { id: "s3", path: "/c.mp3", name: "c.mp3", offset: timelineLength(sourcesOf(p)) }, 40)!;
    expect(again.appended!.map((x) => [x.id, x.offset])).toEqual([["s2", 100], ["s3", 140]]);
    expect(again.result!.speakers).toEqual(["SPEAKER_00", "SPEAKER_01", "SPEAKER_02", "SPEAKER_03"]);
  });
  it("a part that failed to decode never reaches here: the project is the one it was", () => {
    // the hook settles a failed add with only { status: "done", partial: undefined, adding: undefined }; nothing joins
    const failed = { ...base(), ...{ status: "done" as const, error: undefined, partial: undefined, adding: undefined } };
    expect(failed.result).toBe(partOne);
    expect(failed.appended).toBeUndefined();
    expect(sourcesOf(failed)).toHaveLength(1);
    expect(joinAdded({ result: null, appended: undefined }, partTwo, add, 40)).toBeNull();
  });
});

describe("matchSpeakers", () => {
  it("moves the lines of a speaker to the matched person and drops the extra speaker and its name", () => {
    const p = joined();
    const m = matchSpeakers(p.result!, { ...p.names, SPEAKER_02: "Caller" }, { SPEAKER_02: "SPEAKER_01" });
    expect(m.result.speakers).toEqual(["SPEAKER_00", "SPEAKER_01"]);
    expect(m.result.segments.slice(3).every((s) => s.speaker === "SPEAKER_01" && s.words.every((x) => x.speaker === "SPEAKER_01"))).toBe(true);
    expect(m.names).toEqual({ SPEAKER_00: "Ana", SPEAKER_01: "Ben" });
    expect(m.result.segments.slice(0, 3)).toEqual(partOne.segments);
  });
  it("leaves a speaker that is not matched as a new speaker, and ignores nonsense", () => {
    const p = joined();
    expect(matchSpeakers(p.result!, p.names, {}).result).toBe(p.result);
    expect(matchSpeakers(p.result!, p.names, { SPEAKER_02: "SPEAKER_09", SPEAKER_07: "SPEAKER_00" }).result).toBe(p.result);
  });
  it("keeps highlights pointing at the right person", () => {
    const r: Result = { ...joined().result!, highlights: [{ id: "x", start: 102, end: 110, text: "Ja", speaker: "SPEAKER_02" }] };
    expect(matchSpeakers(r, {}, { SPEAKER_02: "SPEAKER_00" }).result.highlights![0].speaker).toBe("SPEAKER_00");
  });
});

describe("shiftResult", () => {
  it("moves lines, words, originals and highlights, and does nothing for 0", () => {
    const r = shiftResult(partOne, 5);
    expect(r.segments[0].orig).toBeDefined();
    expect(r.segments[1].words[0]).toMatchObject({ start: 15, end: 17, checked: true });
    expect(r.highlights![0]).toMatchObject({ start: 15, end: 25 });
    expect(shiftResult(partOne, 0)).toBe(partOne);
  });
});

describe("readParts", () => {
  it("keeps good entries, drops damaged ones, and gives undefined when none is left", () => {
    expect(readParts(undefined)).toBeUndefined();
    expect(readParts([null, 3, { id: "x" }, { id: "a", path: "/a.wav", offset: -1, duration: 5 }])).toBeUndefined();
    expect(readParts([{ id: "a", path: "/a.wav", offset: 10, duration: 5, matched: true, speakers: ["S", 4] }, { id: "b" }])).toEqual([{ id: "a", path: "/a.wav", name: "a.wav", offset: 10, duration: 5, speakers: ["S"], matched: true }]);
  });
});

describe("the restore point and copies carry the added recordings", () => {
  it("restoring the state from before an append takes the added recording out of the timeline, and restoring again brings it back", () => {
    const before = base();
    const after = joined();
    const point = takeRestorePoint(before, "add a recording", 1)!;
    expect(point.appended).toBeUndefined();
    const withPoint = { ...after, previous: point };
    const back = restoreFrom(withPoint, "restore", 2)!;
    expect(back.appended).toBeUndefined();
    expect(back.result).toBe(partOne);
    const again = restoreFrom({ ...withPoint, ...back }, "restore", 3)!;
    expect(again.appended).toEqual(after.appended);
  });
  it("reads a point saved by an older version (no recordings) and one with recordings", () => {
    expect(readRestorePoint({ result: partOne, names: {} })!.appended).toBeUndefined();
    expect(readRestorePoint({ result: partOne, names: {}, appended: joined().appended })!.appended).toHaveLength(1);
  });
  it("a duplicate keeps the added recordings and the transcript that refers to them", () => {
    const c = duplicateProject(joined(), "q", "copy", 9);
    expect(sourcesOf(c).map((x) => x.path)).toEqual(["/phones/a.m4a", "/phones/b.wav"]);
    expect(c.result!.duration).toBe(140);
  });
});

describe("known recordings", () => {
  it("includes the added recordings (and those a restore point would bring back), so they play after a restart", () => {
    const k = createKnownPaths();
    k.remember([{ path: "/phones/a.m4a", appended: [{ path: "/phones/b.wav" }], previous: { appended: [{ path: "/phones/c.mp3" }] } }, { path: "/x.wav" }]);
    for (const f of ["/phones/a.m4a", "/phones/b.wav", "/phones/c.mp3", "/x.wav"]) expect(k.has(f)).toBe(true);
    expect(k.has("/phones/d.wav")).toBe(false);
  });
});
