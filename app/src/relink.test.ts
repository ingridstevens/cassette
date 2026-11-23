import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fingerprintFile } from "../electron/sourceId";
import { commitRelink, judgeLocated, type Located } from "./relink";
import { createSaveTracker } from "./saveTracker";
import type { Project } from "./types";

const roots: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "relink-")); roots.push(d); return d; };
afterEach(() => { for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }); });

const id = (n: string) => ({ size: 10, sample: n });
const project = (extra: Partial<Project> = {}): Project => ({
  id: "p1", path: "/old/talk.m4a", name: "Talk", addedAt: 1, status: "done", names: { SPEAKER_00: "Ana" },
  result: { language: "en", duration: 60, speakers: ["SPEAKER_00"], segments: [{ start: 0, end: 5, speaker: "SPEAKER_00", text: "hello", words: [] }], highlights: [{ id: "h1", start: 12.5, end: 20, text: "quote", speaker: "SPEAKER_00" }] },
  source: id("a"), ...extra,
});
const located = (sample: string, p = "/new/talk renamed.m4a"): Located => ({ path: p, name: path.basename(p), source: id(sample) });

describe("fingerprintFile", () => {
  it("is the same for a moved or renamed copy and differs for other bytes, even at the same size", async () => {
    const d = tmp(); const bytes = crypto.randomBytes(2_000_000);
    fs.writeFileSync(path.join(d, "a.wav"), bytes); fs.copyFileSync(path.join(d, "a.wav"), path.join(d, "b renamed.wav"));
    const other = Buffer.from(bytes); other[0] ^= 0xff; fs.writeFileSync(path.join(d, "c.wav"), other);
    const middle = Buffer.from(bytes); middle[1_000_000] ^= 0xff; fs.writeFileSync(path.join(d, "d.wav"), middle);
    const tail = Buffer.from(bytes); tail[bytes.length - 1] ^= 0xff; fs.writeFileSync(path.join(d, "e.wav"), tail);
    const a = await fingerprintFile(path.join(d, "a.wav"));
    expect(a?.size).toBe(2_000_000);
    expect(await fingerprintFile(path.join(d, "b renamed.wav"))).toEqual(a);
    for (const f of ["c.wav", "d.wav", "e.wav"]) expect((await fingerprintFile(path.join(d, f)))?.sample).not.toBe(a?.sample);
  });
  it("handles small and empty files, and gives null for a missing file or a folder", async () => {
    const d = tmp(); fs.writeFileSync(path.join(d, "s.wav"), "abc"); fs.writeFileSync(path.join(d, "z.wav"), "");
    expect((await fingerprintFile(path.join(d, "s.wav")))?.size).toBe(3);
    expect((await fingerprintFile(path.join(d, "z.wav")))?.size).toBe(0);
    expect(await fingerprintFile(path.join(d, "gone.wav"))).toBeNull();
    expect(await fingerprintFile(d)).toBeNull();
  });
});

describe("judgeLocated", () => {
  it("accepts a file with the project's identity under any name or place", () => expect(judgeLocated(project(), located("a"))).toBe("same"));
  it("rejects a different file even with the same name", () => expect(judgeLocated(project(), located("b", "/new/talk.m4a"))).toBe("different"));
  it("rejects the same checksum at another size", () => expect(judgeLocated(project(), { ...located("a"), source: { size: 11, sample: "a" } })).toBe("different"));
  it("asks for confirmation when the project has no identity yet, unless it is the file it already uses", () => {
    expect(judgeLocated(project({ source: undefined }), located("a"))).toBe("unverified");
    expect(judgeLocated(project({ source: undefined }), located("a", "/old/talk.m4a"))).toBe("same");
  });
});

/** A tracker over a fake disk that can be made to fail. */
function disk(failing = false) {
  const state = { saved: [] as Project[][], failing };
  const tracker = createSaveTracker<Project[]>(async (l) => { if (state.failing) return { ok: false, error: "disk full" }; state.saved.push(l); return { ok: true }; }, () => !state.failing, () => {});
  return { state, tracker };
}

describe("commitRelink", () => {
  it("changes only the path and identity, and the new place is on disk when it returns", async () => {
    const { state, tracker } = disk();
    const before = project(); const other = project({ id: "p2", path: "/x.wav" });
    const r = await commitRelink(tracker, [before, other], "p1", located("a"));
    expect(r.ok).toBe(true);
    const saved = state.saved.at(-1)!; const p = saved.find((x) => x.id === "p1")!;
    expect(p.path).toBe("/new/talk renamed.m4a");
    expect({ ...p, path: before.path }).toEqual(before);   // id, names, edits, highlights (seek positions), everything else equal
    expect(saved.find((x) => x.id === "p2")).toEqual(other);
    expect(p.result?.highlights?.[0]).toMatchObject({ start: 12.5, end: 20 });
  });
  it("survives a restart: what was saved, read back, still has the identity and the new path", async () => {
    const { state, tracker } = disk();
    await commitRelink(tracker, [project({ source: undefined })], "p1", located("a"));
    const back = JSON.parse(JSON.stringify(state.saved.at(-1))) as Project[];
    expect(back[0]).toMatchObject({ id: "p1", path: "/new/talk renamed.m4a", source: id("a"), names: { SPEAKER_00: "Ana" } });
  });
  it("leaves the saved projects as they were when the save fails", async () => {
    const { state, tracker } = disk(true);
    const list = [project()];
    const r = await commitRelink(tracker, list, "p1", located("a"));
    expect(r).toEqual({ ok: false, error: "disk full" });
    expect(list[0].path).toBe("/old/talk.m4a");
    state.failing = false; await tracker.drain();
    expect(state.saved.at(-1)![0].path).toBe("/old/talk.m4a");  // a later save writes the old place, never the new one
  });
});
