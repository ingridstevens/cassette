import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { failKind, runSteps, withStaged, writeStaged } from "../electron/stagedExport";

// Real files in a real temp folder; every path is built with path.join so the tests run the same on Windows, macOS and Linux.
let root = "";
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "staged-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
const read = (...p: string[]) => fs.readFileSync(path.join(root, ...p), "utf-8");
const leftovers = (dir = root) => fs.readdirSync(dir).filter((n) => n.startsWith(".cassette-staging-"));

describe("withStaged", () => {
  it("writes a new file under the destination's own name and leaves no staging folder", async () => {
    const dest = path.join(root, "Talk.txt");
    let seen = "";
    await withStaged(dest, async (out) => { seen = path.basename(out); fs.writeFileSync(out, "new"); });
    expect(seen).toBe("Talk.txt"); // the engine takes titles from this name
    expect(read("Talk.txt")).toBe("new");
    expect(leftovers()).toEqual([]);
    expect(fs.readdirSync(root)).toEqual(["Talk.txt"]);
  });

  it("replaces an earlier file only once the new one is finished", async () => {
    const dest = path.join(root, "Talk.txt");
    fs.writeFileSync(dest, "old");
    await withStaged(dest, async (out) => { fs.writeFileSync(out, "new"); expect(read("Talk.txt")).toBe("old"); });
    expect(read("Talk.txt")).toBe("new");
  });

  it("keeps the earlier file readable when the export fails halfway through writing", async () => {
    const dest = path.join(root, "Talk.txt");
    fs.writeFileSync(dest, "old");
    await expect(withStaged(dest, async (out) => { fs.writeFileSync(out, "half of the new te"); throw new Error("The engine stopped."); })).rejects.toThrow("The engine stopped.");
    expect(read("Talk.txt")).toBe("old");
    expect(leftovers()).toEqual([]);
  });

  it("treats a run that reports success but wrote nothing as a failure and keeps the earlier file", async () => {
    const dest = path.join(root, "Talk.txt");
    fs.writeFileSync(dest, "old");
    await expect(withStaged(dest, async () => {})).rejects.toThrow(/no file was written/);
    expect(read("Talk.txt")).toBe("old");
    expect(leftovers()).toEqual([]);
  });

  it("cannot replace a destination that is in the way (a folder here, standing in for a locked file): kind locked, nothing damaged", async () => {
    const dest = path.join(root, "Talk.txt");
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, "keep.txt"), "kept");
    const err = await withStaged(dest, async (out) => { fs.writeFileSync(out, "new"); }).catch((e: unknown) => e as { kind: string });
    expect((err as { kind: string }).kind).toBe("locked");
    expect(read("Talk.txt", "keep.txt")).toBe("kept");
    expect(leftovers()).toEqual([]);
  });

  it("fails before running anything when the folder does not exist, and says the folder is missing", async () => {
    const dest = path.join(root, "gone", "Talk.txt");
    let ran = false;
    const err = await withStaged(dest, async () => { ran = true; }).catch((e: unknown) => e as { kind: string });
    expect(ran).toBe(false);
    expect((err as { kind: string }).kind).toBe("folder");
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it("moves the files written beside the staged one (the anonymisation report) next to the destination", async () => {
    const dest = path.join(root, "Talk.txt");
    await withStaged(dest, async (out) => {
      fs.writeFileSync(out, "text");
      fs.writeFileSync(path.join(path.dirname(out), "Talk.anonymisation-report.txt"), "report");
    }, ["Talk.anonymisation-report.txt", "Talk.not-written.txt"]);
    expect(read("Talk.txt")).toBe("text");
    expect(read("Talk.anonymisation-report.txt")).toBe("report");
    expect(leftovers()).toEqual([]);
  });

  it("can stage a whole folder (the clips)", async () => {
    const dest = path.join(root, "clips");
    await withStaged(dest, async (out) => { fs.mkdirSync(out); fs.writeFileSync(path.join(out, "1.mp3"), "a"); });
    expect(read("clips", "1.mp3")).toBe("a");
    expect(leftovers()).toEqual([]);
  });

  it("writeStaged writes bytes and keeps the earlier file when the destination cannot be replaced", async () => {
    const ok = path.join(root, "card.png");
    await writeStaged(ok, new Uint8Array([1, 2, 3]));
    expect([...fs.readFileSync(ok)]).toEqual([1, 2, 3]);
    const blocked = path.join(root, "blocked.png");
    fs.mkdirSync(blocked);
    await expect(writeStaged(blocked, "x")).rejects.toBeTruthy();
    expect(fs.statSync(blocked).isDirectory()).toBe(true);
  });
});

describe("failKind", () => {
  const code = (c: string) => Object.assign(new Error(c), { code: c });
  it("sorts system errors into plain kinds", () => {
    expect(["EACCES", "EPERM", "EBUSY", "EROFS"].map((c) => failKind(code(c)))).toEqual(["locked", "locked", "locked", "locked"]);
    expect(["ENOENT", "ENOTDIR"].map((c) => failKind(code(c)))).toEqual(["folder", "folder"]);
    expect(["ENOSPC", "EDQUOT"].map((c) => failKind(code(c)))).toEqual(["space", "space"]);
    expect(failKind(new Error("engine said no"))).toBe("other");
    expect(failKind(null)).toBe("other");
  });
});

describe("runSteps (episode folder)", () => {
  const step = (id: string, file: string, text: string, fail = false) => ({ id, file, run: async (out: string) => { fs.writeFileSync(out, text); if (fail) throw new Error(`${id} failed`); } });

  it("saves every file when all succeed", async () => {
    const r = await runSteps(root, [step("chapters", "A chapters.txt", "c"), step("markers", "A markers.edl", "m")]);
    expect(r).toEqual({ saved: ["chapters", "markers"], failed: [] });
    expect(fs.readdirSync(root).sort()).toEqual(["A chapters.txt", "A markers.edl"]);
  });

  it("keeps going after one file fails, names it, and leaves the saved files and any earlier copy untouched", async () => {
    fs.writeFileSync(path.join(root, "A markers.edl"), "earlier markers");
    const r = await runSteps(root, [step("chapters", "A chapters.txt", "c"), step("markers", "A markers.edl", "half", true), step("clips", "clips", "x")]);
    expect(r.saved).toEqual(["chapters", "clips"]);
    expect(r.failed).toEqual([{ id: "markers", file: "A markers.edl", kind: "other", message: "markers failed" }]);
    expect(read("A markers.edl")).toBe("earlier markers");
    expect(read("A chapters.txt")).toBe("c");
    expect(leftovers()).toEqual([]);
  });

  it("a retry saves only the files that failed and does not touch the saved ones", async () => {
    const first = await runSteps(root, [step("chapters", "A chapters.txt", "c"), step("markers", "A markers.edl", "m", true)]);
    expect(first.failed.map((f) => f.id)).toEqual(["markers"]);
    const before = fs.statSync(path.join(root, "A chapters.txt")).mtimeMs;
    const again = await runSteps(root, [step("chapters", "A chapters.txt", "CHANGED"), step("markers", "A markers.edl", "m")], first.failed.map((f) => f.id));
    expect(again).toEqual({ saved: ["markers"], failed: [] });
    expect(read("A chapters.txt")).toBe("c");
    expect(fs.statSync(path.join(root, "A chapters.txt")).mtimeMs).toBe(before);
    expect(read("A markers.edl")).toBe("m");
  });

  it("names a file whose place is blocked, as locked, and still saves the others", async () => {
    fs.mkdirSync(path.join(root, "A markers.edl"));
    const r = await runSteps(root, [step("markers", "A markers.edl", "m"), step("chapters", "A chapters.txt", "c")]);
    expect(r.saved).toEqual(["chapters"]);
    expect(r.failed.map((f) => [f.file, f.kind])).toEqual([["A markers.edl", "locked"]]);
  });

  it("reports every file as failed when the folder is gone", async () => {
    const r = await runSteps(path.join(root, "gone"), [step("chapters", "A chapters.txt", "c"), step("markers", "A markers.edl", "m")]);
    expect(r.saved).toEqual([]);
    expect(r.failed.map((f) => f.kind)).toEqual(["folder", "folder"]);
  });
});
