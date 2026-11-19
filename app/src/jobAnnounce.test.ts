import { describe, expect, it } from "vitest";
import { finishAnnouncement, progressAnnouncement } from "./jobAnnounce";

const say = (s: string, p: number | null) => (p == null ? s : `${s} ${p}%`);
describe("progressAnnouncement", () => {
  it("announces a new stage once", () => {
    const a = progressAnnouncement(null, "Transcribing", 0.01, say);
    expect(a.text).toBe("Transcribing");
    expect(progressAnnouncement(a.mark, "Transcribing", 0.05, say).text).toBe("");
  });
  it("announces each quarter once, and not completion (finish does that)", () => {
    let m = progressAnnouncement(null, "T", 0, say).mark;
    const heard: string[] = [];
    for (const f of [0.1, 0.26, 0.3, 0.51, 0.52, 0.8, 0.99, 1]) { const r = progressAnnouncement(m, "T", f, say); m = r.mark; if (r.text) heard.push(r.text); }
    expect(heard).toEqual(["T 25%", "T 50%", "T 75%"]);
  });
  it("announces again when the stage changes", () => {
    const m = progressAnnouncement(null, "A", 0.6, say).mark;
    expect(progressAnnouncement(m, "B", 0.1, say).text).toBe("B");
  });
  it("copes with an unknown fraction", () => { expect(progressAnnouncement({ label: "A", quarter: 0 }, "A", null, say).text).toBe(""); });
});
describe("finishAnnouncement", () => {
  const d = () => "done", f = () => "failed";
  it("speaks when a running or queued job ends", () => {
    expect(finishAnnouncement("running", "done", d, f)).toBe("done");
    expect(finishAnnouncement("queued", "error", d, f)).toBe("failed");
  });
  it("stays quiet for loads, edits and cancels", () => {
    expect(finishAnnouncement(undefined, "done", d, f)).toBe("");
    expect(finishAnnouncement("done", "done", d, f)).toBe("");
    expect(finishAnnouncement("running", "idle", d, f)).toBe("");
  });
});
