import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BackupError, FIRST, FORMAT, VERSION, encodeHead, mediaNameFor, readManifest, restoreBackup, safeMediaName, writeBackup, type Manifest } from "../electron/projectArchive";
import { restoredProject } from "./projectBackup";
import { sourcesOf, timelineLength } from "./sources";

const roots: string[] = [];
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "archive-")); roots.push(root);
  const media = path.join(root, "Interview 1.m4a");
  const bytes = crypto.randomBytes(300_000); fs.writeFileSync(media, bytes);
  const out = path.join(root, "out"); fs.mkdirSync(out);
  const restored = path.join(root, "profile", "recordings");
  const project = { id: "p1", path: media, name: "Interview 1", addedAt: 5, result: { segments: [{ start: 0, end: 1, speaker: "S0", text: "hi" }], speakers: ["S0"] }, names: { S0: "Ana" } };
  return { root, media, bytes, out, restored, project, dest: path.join(out, "one.cassette-backup") };
}
const snapshot = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort().map((f) => `${f}:${fs.statSync(path.join(dir, f)).size}`) : []);
const fails = async (p: Promise<unknown>, code: string) => { const e = await p.then(() => null, (x) => x); expect(e).toBeInstanceOf(BackupError); expect((e as BackupError).code).toBe(code); };
afterEach(() => { for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }); });

/** A version-1 manifest (one recording, `media` an object): an older file that must still restore. */
type V1 = Omit<Manifest, "media"> & { media: { path: string; size: number; sha256: string } };
/** An archive with a hand-made manifest in the version-1 shape, for the shapes the writer never produces. */
function forge(file: string, media: Buffer, patch: (m: V1) => unknown, tail = Buffer.alloc(0)) {
  const m: V1 = { format: FORMAT, version: 1, createdAt: 1, app: "t", project: { id: "p1", name: "x" }, media: { path: "media/a.m4a", size: media.length, sha256: crypto.createHash("sha256").update(media).digest("hex") } };
  fs.writeFileSync(file, Buffer.concat([encodeHead((patch(m) ?? m) as unknown as Manifest), media, tail]));
}

describe("project backup and restore", () => {
  it("restores the recording and the project from a clean profile, with the original recording gone", async () => {
    const s = setup();
    const r = await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "0.1.0", freeBytes: async () => null });
    expect(r.bytes).toBe(fs.statSync(s.dest).size);
    expect(fs.existsSync(s.dest + ".partial")).toBe(false);
    fs.rmSync(s.media);
    const got = await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    expect(fs.readFileSync(got.mediaPath).equals(s.bytes)).toBe(true);
    expect(path.dirname(got.mediaPath)).toBe(s.restored);
    expect(got.project.names).toEqual({ S0: "Ana" });
    expect(got.project.path).toBeUndefined(); // the path on the old computer is not in the file
    expect(fs.readFileSync(s.dest).includes(Buffer.from(s.root))).toBe(false);
    expect(snapshot(s.restored)).toEqual([`${path.basename(got.mediaPath)}:${s.bytes.length}`]);
  });
  it("never overwrites a recording that is already there: a second restore gets its own file name", async () => {
    const s = setup();
    await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
    const a = await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    const b = await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    expect(b.mediaPath).not.toBe(a.mediaPath);
    expect(path.basename(b.mediaPath)).toBe("Interview 1 (2).m4a");
  });
  it("handles an empty recording", async () => {
    const s = setup(); fs.writeFileSync(s.media, "");
    await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
    const got = await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    expect(fs.statSync(got.mediaPath).size).toBe(0);
  });

  describe("backing up fails explicitly and keeps the earlier archive", () => {
    it("missing source", async () => {
      const s = setup(); fs.writeFileSync(s.dest, "earlier backup"); fs.rmSync(s.media);
      await fails(writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" }), "missing-source");
      expect(fs.readFileSync(s.dest, "utf8")).toBe("earlier backup");
    });
    it("unwritable destination", async () => {
      const s = setup();
      await fails(writeBackup({ dest: path.join(s.root, "no-such-folder", "x.cassette-backup"), project: s.project, mediaPath: s.media, app: "t" }), "unwritable");
    });
    it("low disk, checked before anything is written", async () => {
      const s = setup(); fs.writeFileSync(s.dest, "earlier backup");
      await fails(writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t", freeBytes: async () => 1000 }), "low-disk");
      expect(snapshot(s.out)).toEqual([`one.cassette-backup:${"earlier backup".length}`]);
    });
    it("a recording that changes during the backup", async () => {
      const s = setup(); fs.writeFileSync(s.dest, "earlier backup");
      let n = 0;
      const free = async () => { if (n++ === 0) setTimeout(() => fs.appendFileSync(s.media, "more"), 0); return null; };
      // the change may land before or after the second pass: either way nothing half-written is left, and the old archive stays or a complete new one replaces it
      const r = await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t", freeBytes: free }).then(() => "ok", (e) => e.code);
      expect(["ok", "source-changed"]).toContain(r);
      expect(fs.existsSync(s.dest + ".partial")).toBe(false);
      if (r === "source-changed") expect(fs.readFileSync(s.dest, "utf8")).toBe("earlier backup");
      else await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    });
  });

  describe("restoring fails explicitly and leaves the recordings folder as it was", () => {
    const untouched = async (s: ReturnType<typeof setup>, code: string, run: () => Promise<unknown> = () => restoreBackup({ archive: s.dest, mediaDir: s.restored })) => {
      fs.mkdirSync(s.restored, { recursive: true }); fs.writeFileSync(path.join(s.restored, "Interview 1.m4a"), "mine");
      const before = snapshot(s.restored);
      await fails(run(), code);
      expect(snapshot(s.restored)).toEqual(before);
      expect(fs.readFileSync(path.join(s.restored, "Interview 1.m4a"), "utf8")).toBe("mine");
    };
    it("a damaged recording (one flipped byte)", async () => {
      const s = setup(); await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
      const b = fs.readFileSync(s.dest); b[b.length - 10] ^= 0xff; fs.writeFileSync(s.dest, b);
      await untouched(s, "damaged");
    });
    it("a cut-short file", async () => {
      const s = setup(); await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
      fs.truncateSync(s.dest, fs.statSync(s.dest).size - 100);
      await untouched(s, "damaged");
    });
    it("extra bytes after the recording", async () => {
      const s = setup(); await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
      fs.appendFileSync(s.dest, "x");
      await untouched(s, "damaged");
    });
    it("a damaged contents list", async () => {
      const s = setup(); await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
      const b = fs.readFileSync(s.dest); b[60] ^= 0xff; fs.writeFileSync(s.dest, b);
      await untouched(s, "damaged");
    });
    it("a file that is not a backup, and an empty one", async () => {
      const s = setup(); fs.writeFileSync(s.dest, "just some text, long enough to be more than a header ........................................");
      await untouched(s, "not-backup");
      fs.writeFileSync(s.dest, ""); await fails(readManifest(s.dest), "damaged");
    });
    it("a newer format version", async () => {
      const s = setup(); forge(s.dest, s.bytes, (m) => ({ ...m, version: VERSION + 1 }));
      await untouched(s, "unsupported");
    });
    it.each(["media/../../evil.m4a", "../evil.m4a", "/etc/evil.m4a", "media/..\\evil.m4a", "media/sub/evil.m4a", "evil.m4a", "media/C:evil.m4a", "media/evil.sh", "media/.hidden.m4a", "media/nul.wav", "media/a\u0000.m4a", "media/"])("an unsafe recording path %j", async (p) => {
      const s = setup(); forge(s.dest, s.bytes, (m) => ({ ...m, media: { ...m.media, path: p } }));
      await untouched(s, "unsafe-path");
      expect(fs.existsSync(path.join(s.root, "evil.m4a"))).toBe(false);
    });
    it("low disk, checked before the recording is written", async () => {
      const s = setup(); await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
      await untouched(s, "low-disk", () => restoreBackup({ archive: s.dest, mediaDir: s.restored, freeBytes: async () => 10 }));
    });
    it("a recordings folder that cannot be created", async () => {
      const s = setup(); await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.media, app: "t" });
      const blocker = path.join(s.root, "file"); fs.writeFileSync(blocker, "x");
      await fails(restoreBackup({ archive: s.dest, mediaDir: path.join(blocker, "recordings") }), "unwritable");
    });
    it("a backup file that is not there", async () => {
      await fails(restoreBackup({ archive: path.join(os.tmpdir(), "nope-" + Date.now()), mediaDir: os.tmpdir() }), "failed");
    });
  });

  it("names recordings safely", () => {
    expect(mediaNameFor("/a/b/Talk 1.M4A")).toBe("Talk 1.M4A");
    expect(mediaNameFor("C:\\x\\a:b.wav")).toBe("a-b.wav");
    expect(mediaNameFor("/a/.mp3")).toBe("recording.mp3");
    expect(mediaNameFor("/a/CON.wav")).toBe("recording.wav");
    expect(safeMediaName("ok.m4a")).toBe(true);
    expect(safeMediaName("ok.exe")).toBe(false);
  });
});

describe("restoredProject", () => {
  const saved = { id: "p1", name: "Interview", path: "/old/x.m4a", addedAt: 9, status: "running", error: "boom", result: { segments: [], speakers: [] }, names: { A: "Ana" } };
  it("keeps the id when it is free and points at the restored recording", () => {
    const { project, collided } = restoredProject([{ id: "z", name: "Other" }], saved, "/new/x.m4a", "fresh", 100, "(restored)");
    expect(collided).toBe(false);
    expect(project).toMatchObject({ id: "p1", path: "/new/x.m4a", name: "Interview", status: "done", names: { A: "Ana" }, addedAt: 9 });
    expect(project.error).toBeUndefined();
  });
  it("gives a project that collides a new id and name, and leaves the existing one alone", () => {
    const existing = [{ id: "p1", name: "Interview" }, { id: "q", name: "Interview (restored)" }];
    const { project, collided } = restoredProject(existing, saved, "/new/x.m4a", "fresh", 100, "(restored)");
    expect(collided).toBe(true);
    expect(project.id).toBe("fresh");
    expect(project.name).toBe("Interview (restored) 2");
    expect(existing).toEqual([{ id: "p1", name: "Interview" }, { id: "q", name: "Interview (restored)" }]);
  });
  it("copes with a project that has no transcript or odd fields", () => {
    const { project } = restoredProject([], { id: 5, names: [], result: { nope: 1 } }, "/n.m4a", "fresh", 1, "x");
    expect(project).toMatchObject({ id: "fresh", name: "Restored project", result: null, status: "idle", names: {} });
  });
});

describe("a backup of a project with several recordings", () => {
  /** Two phones that both called their file "audio.m4a", in different folders, with a note on the boundary and a restore point from before the second was added. */
  function two() {
    const s = setup();
    const a = path.join(s.root, "phoneA"), b = path.join(s.root, "phoneB"); fs.mkdirSync(a); fs.mkdirSync(b);
    const pa = path.join(a, "audio.m4a"), pb = path.join(b, "audio.m4a");
    const ba = crypto.randomBytes(120_000), bb = crypto.randomBytes(80_000); fs.writeFileSync(pa, ba); fs.writeFileSync(pb, bb);
    const part = { id: "s2", path: pb, name: "audio.m4a", offset: 100, duration: 40, source: { size: bb.length, sample: "bbb" }, speakers: ["SPEAKER_01"], matched: true, join: { kind: "gap", seconds: 30 } };
    const project = {
      ...s.project, path: pa, source: { size: ba.length, sample: "aaa" }, appended: [part],
      result: { segments: [{ start: 0, end: 1, speaker: "S0", text: "hi" }, { start: 110, end: 112, speaker: "SPEAKER_01", text: "again" }], speakers: ["S0", "SPEAKER_01"], duration: 140 },
      previous: { result: { segments: [], speakers: [] }, names: {}, appended: [{ ...part, path: pb }, { id: "gone", path: "/old/x.wav", offset: 0, duration: 1 }] },
    };
    return { ...s, pa, pb, ba, bb, part, project };
  }
  it("restores both recordings on a clean profile with the original files gone, with offsets, notes and checked quotes kept", async () => {
    const s = two();
    const w = await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.pa, parts: [{ id: "s2", path: s.pb }], app: "t", freeBytes: async () => null });
    expect(w.bytes).toBe(fs.statSync(s.dest).size);
    fs.rmSync(path.join(s.root, "phoneA"), { recursive: true }); fs.rmSync(path.join(s.root, "phoneB"), { recursive: true });
    const got = await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    expect(got.mediaPaths).toEqual({ s1: got.mediaPath, s2: expect.any(String) });
    expect(got.mediaPaths.s2).not.toBe(got.mediaPath);
    expect(fs.readFileSync(got.mediaPath).equals(s.ba)).toBe(true);
    expect(fs.readFileSync(got.mediaPaths.s2).equals(s.bb)).toBe(true);
    expect(snapshot(s.restored)).toHaveLength(2);
    const { project } = restoredProject([], got.project, got.mediaPath, "fresh", 1, "(restored)");
    const parts = sourcesOf(project);
    expect(parts.map((x) => [x.id, x.path, x.offset, x.duration])).toEqual([["s1", got.mediaPath, 0, 100], ["s2", got.mediaPaths.s2, 100, 40]]);
    expect(timelineLength(parts)).toBe(140);
    expect(project.appended![0]).toMatchObject({ join: { kind: "gap", seconds: 30 }, speakers: ["SPEAKER_01"], matched: true, source: { size: s.bb.length, sample: "bbb" } });
    expect(project.source).toEqual({ size: s.ba.length, sample: "aaa" });
    expect(project.result!.segments).toHaveLength(2);
    // the restore point keeps only recordings the archive holds, pointing at the restored files, and no path of the old computer is left anywhere
    expect(project.previous!.appended!.map((x) => [x.id, x.path])).toEqual([["s2", got.mediaPaths.s2]]);
    expect(JSON.stringify(got.project)).not.toContain(path.join(s.root, "phone"));
  });
  it("keeps same-named recordings apart in the archive and in the recordings folder", async () => {
    const s = two();
    await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.pa, parts: [{ id: "s2", path: s.pb }], app: "t" });
    const m = (await readManifest(s.dest)).manifest;
    expect(m.media.map((x) => x.path)).toEqual(["media/audio.m4a", "media/audio (2).m4a"]);
    expect(m.media.map((x) => x.id)).toEqual([FIRST, "s2"]);
    const names = (project: unknown) => JSON.stringify(project);
    expect(names(m.project)).not.toContain(s.root);
    const got = await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    expect(snapshot(s.restored)).toEqual([`audio (2).m4a:${s.bb.length}`, `audio.m4a:${s.ba.length}`]);
    expect(path.basename(got.mediaPath)).toBe("audio.m4a");
  });
  it("a missing second recording fails explicitly and leaves an earlier backup and the folder alone", async () => {
    const s = two(); fs.writeFileSync(s.dest, "earlier backup"); fs.rmSync(s.pb);
    await fails(writeBackup({ dest: s.dest, project: s.project, mediaPath: s.pa, parts: [{ id: "s2", path: s.pb }], app: "t" }), "missing-source");
    expect(fs.readFileSync(s.dest, "utf8")).toBe("earlier backup");
    expect(fs.existsSync(`${s.dest}.partial`)).toBe(false);
  });
  it("a damaged second recording writes nothing at all, not even the first", async () => {
    const s = two();
    await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.pa, parts: [{ id: "s2", path: s.pb }], app: "t" });
    const b = fs.readFileSync(s.dest); b[b.length - 5] ^= 0xff; fs.writeFileSync(s.dest, b);
    fs.mkdirSync(s.restored, { recursive: true }); fs.writeFileSync(path.join(s.restored, "audio.m4a"), "mine");
    const before = snapshot(s.restored);
    await fails(restoreBackup({ archive: s.dest, mediaDir: s.restored }), "damaged");
    expect(snapshot(s.restored)).toEqual(before);
  });
  it("a cut-short file, too little disk for both, and a recording changing mid-backup all leave things as they were", async () => {
    const s = two();
    await fails(writeBackup({ dest: s.dest, project: s.project, mediaPath: s.pa, parts: [{ id: "s2", path: s.pb }], app: "t", freeBytes: async () => s.ba.length + 10 }), "low-disk");
    expect(fs.existsSync(s.dest)).toBe(false);
    await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.pa, parts: [{ id: "s2", path: s.pb }], app: "t" });
    fs.truncateSync(s.dest, fs.statSync(s.dest).size - 10);
    await fails(restoreBackup({ archive: s.dest, mediaDir: s.restored }), "damaged");
    await fails(restoreBackup({ archive: s.dest, mediaDir: s.restored, freeBytes: async () => s.ba.length }), "damaged");
    expect(snapshot(s.restored)).toEqual([]);
  });
  it("a manifest that lists an added recording it does not hold, or repeats one, is damaged", async () => {
    const s = two();
    await writeBackup({ dest: s.dest, project: s.project, mediaPath: s.pa, parts: [{ id: "s2", path: s.pb }], app: "t" });
    const { manifest } = await readManifest(s.dest);
    const data = fs.readFileSync(s.dest).subarray(fs.readFileSync(s.dest).length - (s.ba.length + s.bb.length));
    const write = (m: unknown) => fs.writeFileSync(s.dest, Buffer.concat([encodeHead(m as Manifest), data]));
    write({ ...manifest, media: [manifest.media[0]] });
    await fails(readManifest(s.dest), "damaged");
    write({ ...manifest, media: [manifest.media[0], { ...manifest.media[1], id: "s1" }] });
    await fails(readManifest(s.dest), "damaged");
    write({ ...manifest, media: [manifest.media[0], { ...manifest.media[1], path: "media/../x.m4a" }] });
    await fails(readManifest(s.dest), "unsafe-path");
    write({ ...manifest, media: [manifest.media[1], manifest.media[0]] });
    await fails(readManifest(s.dest), "damaged");
    expect(snapshot(s.restored)).toEqual([]);
  });
  it("an archive of one recording written before recordings could be added still restores", async () => {
    const s = setup(); forge(s.dest, s.bytes, () => undefined);
    const got = await restoreBackup({ archive: s.dest, mediaDir: s.restored });
    expect(Object.keys(got.mediaPaths)).toEqual([FIRST]);
    expect(fs.readFileSync(got.mediaPath).equals(s.bytes)).toBe(true);
  });
});
