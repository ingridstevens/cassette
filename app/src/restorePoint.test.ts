import { describe, expect, it } from "vitest";
import { createSaveTracker } from "./saveTracker";
import { readRestorePoint, restoreFrom, takeRestorePoint, writeRestorePoint } from "./restorePoint";
import type { Project, Result } from "./types";

const full: Result = {
  language: "en", duration: 60, speakers: ["SPEAKER_00", "SPEAKER_01"],
  segments: [
    { start: 0, end: 5, speaker: "SPEAKER_00", text: "Hallo Welt", words: [{ start: 0, end: 5, word: "Hallo Welt", speaker: "SPEAKER_00", checked: true }], chapter: "Intro", translation: "Hello world", translationLang: "en", marked: true },
    { start: 5, end: 9, speaker: "SPEAKER_01", text: "Second", words: [], edited: true },
  ],
  highlights: [{ id: "h1", start: 0, end: 5, text: "Hallo Welt", speaker: "SPEAKER_00" }],
  summary: { summary: "Minutes", topics: [], decisions: ["Ship it"], actions: [] },
};
const proj = (over: Partial<Project> = {}): Project => ({ id: "p", path: "/a.wav", name: "a", addedAt: 1, result: full, names: { SPEAKER_00: "Ana" }, meta: { model: "small" }, status: "done", ...over });

describe("restoreFrom", () => {
  it("swaps the restore point with what is on screen, so the restore can be taken back", () => {
    const newer: Result = { ...full, segments: [full.segments[0]] };
    const p = proj({ result: newer, names: {}, previous: takeRestorePoint(proj(), "replace all", 5)! });
    const back = restoreFrom(p, "restore", 9)!;
    expect(back.result).toBe(full);
    expect(back.names).toEqual({ SPEAKER_00: "Ana" });
    expect(back.previous).toMatchObject({ result: newer, names: {}, label: "restore", at: 9 });
    const again = restoreFrom({ ...p, ...back }, "restore", 10)!;
    expect(again.result).toBe(newer);
  });
  it("does nothing without a restore point", () => expect(restoreFrom(proj(), "x", 1)).toBeNull());
  it("brings text, speakers, checked words, chapters, translations, quotes and minutes back together after a save and reload", () => {
    const p = proj({ result: { ...full, segments: [], highlights: [], summary: undefined, speakers: [] }, names: {}, previous: takeRestorePoint(proj(), "transcribe again", 1)! });
    const reloaded = JSON.parse(JSON.stringify(p)) as Project;  // what projects.json holds
    const restored = { ...reloaded, ...restoreFrom({ ...reloaded, previous: readRestorePoint(reloaded.previous) }, "restore", 2) };
    expect(JSON.parse(JSON.stringify(restored.result))).toEqual(JSON.parse(JSON.stringify(full)));
    expect(restored.names).toEqual({ SPEAKER_00: "Ana" });
  });
});

describe("readRestorePoint", () => {
  it("accepts the old shape with only result, names and meta", () => {
    const rp = readRestorePoint({ result: full, names: { A: "x" }, meta: { model: "tiny" } })!;
    expect(rp.result.segments).toHaveLength(2);
    expect(rp.label).toBeUndefined();
    expect(rp.meta).toEqual({ model: "tiny" });
  });
  it("fills in missing names, speakers, words and a bad highlights field", () => {
    const rp = readRestorePoint({ result: { segments: [{ start: 0, end: 1, speaker: "A", text: "x" }], highlights: "no" } })!;
    expect(rp.names).toEqual({});
    expect(rp.result.speakers).toEqual(["A"]);
    expect(rp.result.segments[0].words).toEqual([]);
    expect(rp.result.highlights).toBeUndefined();
  });
  it("drops what has no transcript in it", () => {
    for (const bad of [undefined, null, 3, "x", [], {}, { result: null }, { result: { segments: "no" } }]) expect(readRestorePoint(bad)).toBeUndefined();
  });
});

describe("writeRestorePoint", () => {
  const rp = takeRestorePoint(proj(), "replace all", 1)!;
  const tracker = (ok: () => boolean) => {
    const saved: Project[][] = [];
    const t = createSaveTracker<Project[]>(async (l) => { if (!ok()) return { ok: false, error: "disk full" }; saved.push(l); return { ok: true }; }, () => true, () => {});
    return { t, saved };
  };
  it("reports ok only after the point is written", async () => {
    const { t, saved } = tracker(() => true);
    const r = await writeRestorePoint(t, [proj()], "p", rp);
    expect(r.ok).toBe(true);
    expect(saved.at(-1)![0].previous).toBe(rp);
    expect(r.list[0].previous).toBe(rp);
  });
  it("fails and hands back the untouched list when the write fails", async () => {
    const { t } = tracker(() => false);
    const before = [proj()];
    const r = await writeRestorePoint(t, before, "p", rp);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("disk full");
    expect(r.list).toBe(before);
    expect(r.list[0].result).toBe(full);
    expect(r.list[0].previous).toBeUndefined();
  });
});
