import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanLines, createPartialStore, validPartialId } from "../electron/partialStore";

const line = (start: number, text = "Hello") => ({ start, end: start + 1, speaker: "SPEAKER_00", text });
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "partial-"));
  const audio = path.join(root, "talk.wav");
  fs.writeFileSync(audio, "12345");
  const dir = path.join(root, "partials");
  return { root, audio, dir, store: createPartialStore(dir) };
}
const d = (audio: string, lines = [line(0), line(1, "World")]) => ({ lines, audio, model: "small", language: "auto" });

describe("partialStore", () => {
  it("saves and loads the lines in order, leaving no temp file", () => {
    const { audio, dir, store } = setup();
    expect(store.save("a-1", d(audio))).toBe(true);
    const r = store.load("a-1")!;
    expect(r.lines.map((l) => l.text)).toEqual(["Hello", "World"]);
    expect(r).toMatchObject({ model: "small", language: "auto", audioChanged: false });
    expect(fs.readdirSync(dir)).toEqual(["a-1.json"]);
  });
  it("a second save replaces the first as a whole (a crash leaves one complete file)", () => {
    const { audio, store } = setup();
    store.save("a", d(audio, [line(0)]));
    store.save("a", d(audio, [line(0), line(1), line(2)]));
    expect(store.load("a")!.lines).toHaveLength(3);
  });
  it("says when the recording changed or is gone", () => {
    const { audio, store } = setup();
    store.save("a", d(audio));
    fs.writeFileSync(audio, "a different, longer recording");
    expect(store.load("a")!.audioChanged).toBe(true);
    fs.rmSync(audio);
    expect(store.load("a")!.audioChanged).toBe(true);
  });
  it("refuses bad ids, empty lists and malformed lines, and writes nothing", () => {
    const { audio, dir, store } = setup();
    expect(store.save("../x", d(audio))).toBe(false);
    expect(store.save("a", d(audio, []))).toBe(false);
    expect(store.save("a", d(audio, [line(0), { start: "x" } as never]))).toBe(false);
    expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toEqual([]);
    expect(validPartialId("3f2b-aa")).toBe(true);
    expect(validPartialId("a/b")).toBe(false);
    expect(cleanLines([line(0), null])).toBeNull();
  });
  it("deletes an unreadable file instead of keeping its text", () => {
    const { audio, dir, store } = setup();
    store.save("a", d(audio));
    fs.writeFileSync(path.join(dir, "a.json"), "{ not json");
    expect(store.load("a")).toBeNull();
    expect(fs.existsSync(path.join(dir, "a.json"))).toBe(false);
  });
  it("remove deletes the file; prune keeps only the wanted ones and clears leftovers", () => {
    const { audio, dir, store } = setup();
    for (const id of ["a", "b", "c"]) store.save(id, d(audio));
    fs.writeFileSync(path.join(dir, "b.json.tmp"), "half");
    store.remove("a");
    store.prune(["b"]);
    expect(fs.readdirSync(dir)).toEqual(["b.json"]);
    expect(store.load("a")).toBeNull();
  });
  it("owner-only permissions on the file", () => {
    if (process.platform === "win32") return;
    const { audio, dir, store } = setup();
    store.save("a", d(audio));
    expect(fs.statSync(path.join(dir, "a.json")).mode & 0o077).toBe(0);
  });
});
