import { describe, expect, it } from "vitest";
import { createSaveTracker, SaveResult, SaveState } from "./saveTracker";

/** A disk that can fail, and whose answers the test releases by hand. */
function setup() {
  const disk: string[] = []; const states: SaveState[] = []; const waiting: { snap: string; done: (r: SaveResult) => void }[] = [];
  let fail = false;
  const tr = createSaveTracker<string>(
    (s) => new Promise((res) => { waiting.push({ snap: s, done: (r) => { if (r.ok) disk.push(s); res(r); } }); }),
    (s) => { if (fail) return false; disk.push(s); return true; },
    (s) => states.push(s));
  return { tr, disk, states, waiting, setFail: (f: boolean) => { fail = f; } };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("save tracker", () => {
  it("is saved with nothing to write", () => { expect(setup().tr.state().status).toBe("saved"); expect(setup().tr.flushSync()).toBe(true); });

  it("a failed write stays failed, and a retry saves the latest of two edits", async () => {
    const { tr, disk, waiting } = setup();
    tr.submit("one"); const d1 = tr.drain();
    waiting[0].done({ ok: false, error: "disk full" }); await d1;
    expect(tr.state()).toEqual({ status: "failed", error: "disk full" });
    tr.submit("one+two");  // a second edit while failed: still needs a retry
    expect(tr.state().status).toBe("failed");
    const d2 = tr.retry(); expect(tr.state().status).toBe("saving");
    waiting[1].done({ ok: true }); await d2;
    expect(disk).toEqual(["one+two"]); expect(tr.state().status).toBe("saved");
  });

  it("writes one at a time, and a late answer for an older snapshot does not clear a newer edit", async () => {
    const { tr, disk, waiting } = setup();
    tr.submit("a"); const d = tr.drain();
    tr.submit("ab"); tr.drain();            // second drain joins the running one: no second write in parallel
    expect(waiting.length).toBe(1);
    waiting[0].done({ ok: true }); await tick();
    expect(tr.state().status).toBe("saving");   // "ab" is still not written
    expect(waiting.length).toBe(2);
    expect(waiting[1].snap).toBe("ab");
    waiting[1].done({ ok: true }); await d;
    expect(disk).toEqual(["a", "ab"]); expect(tr.state().status).toBe("saved");
  });

  it("an older failure answered after a newer sync save is ignored", async () => {
    const { tr, disk, waiting } = setup();
    tr.submit("a"); const d = tr.drain();
    tr.submit("ab");
    expect(tr.flushSync()).toBe(true);        // close time writes "ab"
    waiting[0].done({ ok: false, error: "late" }); await d;
    expect(disk).toEqual(["ab"]); expect(tr.state().status).toBe("saved");
  });

  it("close flush that fails reports false and succeeds after the fault is gone", () => {
    const { tr, disk, setFail } = setup();
    tr.submit("x"); setFail(true);
    expect(tr.flushSync()).toBe(false); expect(tr.state().status).toBe("failed");
    setFail(false);
    expect(tr.flushSync()).toBe(true); expect(disk).toEqual(["x"]); expect(tr.state().status).toBe("saved");
  });
});
