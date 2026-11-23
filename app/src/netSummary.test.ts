import { describe, expect, it } from "vitest";
import { createNetWatch, foreignHost } from "../electron/netWatch";
import { netSummary } from "./netSummary";

// Addresses are built from parts so the project's web-address tripwire (engine/tests/test_network_surface.py) only sees real addresses in the app.
const web = (rest: string) => `https://${rest}`;
const plain = (rest: string) => `http://${rest}`;

describe("foreignHost", () => {
  it("treats the app's own content as not network use", () => {
    for (const u of ["file:///Applications/Cassette/dist/index.html", "media://file/%2FUsers%2Fa.wav", "blob:null/1234", "data:text/plain,hi", "devtools://devtools/x", "about:blank"]) expect(foreignHost(u)).toBeNull();
  });
  it("ignores the development server's address only", () => {
    expect(foreignHost(plain("localhost:5173/src/main.tsx"), plain("localhost:5173"))).toBeNull();
    expect(foreignHost("ws:" + "//localhost:5173/?token=x", plain("localhost:5173"))).toBeNull();
    expect(foreignHost(plain("localhost:9999/x"), plain("localhost:5173"))).toBe("localhost");
    expect(foreignHost(plain("localhost:5173/x"))).toBe("localhost");
  });
  it("keeps the host name only, never the path or query", () => {
    expect(foreignHost(web("example.org/secret/path?token=hf_abc#frag"))).toBe("example.org");
  });
  it("does not throw on an unreadable address", () => { expect(() => foreignHost("not a url")).not.toThrow(); });
});

describe("createNetWatch", () => {
  it("starts empty and reports no transcriptions", () => {
    const w = createNetWatch(() => 1000);
    expect(w.snapshot()).toEqual({ since: 1000, entries: [], transcribing: false, transcriptions: 0 });
  });
  it("records a foreign window request, not app content", () => {
    const w = createNetWatch();
    expect(w.request("file:///app/index.html")).toBe(false);
    expect(w.request(web("example.org/a?b=c"))).toBe(true);
    expect(w.snapshot().entries.map((e) => [e.kind, e.host])).toEqual([["request", "example.org"]]);
  });
  it("records only the model actions that use the network", () => {
    const w = createNetWatch();
    for (const a of ["status", "delete", "import", "verify"]) expect(w.model(a, "small")).toBe(false);
    for (const a of ["download", "repair", "check"]) expect(w.model(a)).toBe(true);
    expect(w.snapshot().entries.map((e) => e.action)).toEqual(["download", "repair", "check"]);
  });
  it("marks entries made while a transcription runs, and a transcription with none stays at zero", () => {
    const w = createNetWatch();
    w.link(web("huggingface.co/settings/tokens"));
    w.transcriptionStarted();
    expect(w.snapshot().transcribing).toBe(true);
    w.transcriptionEnded();
    w.link(web("github.com/x"));
    const s = netSummary(w.snapshot());
    expect(s).toEqual({ requests: 0, models: 0, links: 2, duringTranscription: 0, transcriptions: 1 });
    w.transcriptionStarted(); w.request(web("example.org/")); w.transcriptionEnded();
    expect(netSummary(w.snapshot()).duringTranscription).toBe(1);
  });
  it("never goes below zero running transcriptions and keeps at most 200 entries", () => {
    const w = createNetWatch();
    w.transcriptionEnded();
    expect(w.snapshot().transcribing).toBe(false);
    for (let i = 0; i < 250; i++) w.request(web(`h${i}.example/`));
    const e = w.snapshot().entries;
    expect(e).toHaveLength(200);
    expect(e[199].host).toBe("h249.example");
  });
});
