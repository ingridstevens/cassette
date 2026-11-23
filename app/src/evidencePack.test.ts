import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dataLocations } from "../electron/dataLocations";
import { buildEvidence, NETWORK_HOSTS, pathBytes, projectListBytes, type EvidenceInput } from "../electron/evidencePack";

const HOME = "/Users/ingrid.stevens";
const base = (over: Partial<EvidenceInput> = {}): EvidenceInput => ({
  appVersion: "1.2.3", electron: "33.0.0", platform: "darwin", arch: "arm64", osRelease: "25.5.0",
  locations: dataLocations(`${HOME}/Library/Application Support/Cassette`),
  sizes: { data: 3_000_000_000, projects: 48_000, recordings: 310_000_000, peaks: null, partials: null, tmp: 0, models: 2_100_000_000, log: 900 },
  home: HOME, net: { since: Date.UTC(2026, 0, 2, 10), entries: [], transcriptions: 0 }, now: Date.UTC(2026, 0, 2, 12), ...over,
});

describe("buildEvidence", () => {
  it("lists versions, every place with its size, and the network hosts", () => {
    const t = buildEvidence(base());
    expect(t).toContain("Cassette 1.2.3");
    expect(t).toContain("darwin arm64");
    expect(t).toContain("| Recordings made in the app |");
    expect(t).toContain("310.0 MB");
    expect(t).toContain("2.10 GB");
    expect(t).toContain("does not exist yet");
    for (const h of NETWORK_HOSTS) expect(t).toContain(h.host);
    expect(t).toContain("Nothing: no request");
  });
  it("shows the home folder as ~ and leaks no user name", () => {
    const t = buildEvidence(base());
    expect(t).not.toContain(HOME);
    expect(t).not.toContain("ingrid.stevens");
    expect(t).toContain("~/Library/Application Support/Cassette/recordings");
  });
  it("takes only versions, sizes and host names from its input: hostile values do not survive", () => {
    const hostile = "the patient admitted she stole the quarterly report";
    const t = buildEvidence(base({
      appVersion: hostile, electron: hostile, platform: hostile, arch: hostile, osRelease: hostile,
      net: { since: 0, transcriptions: 1, entries: [{ t: 1, kind: "model", host: "", action: hostile, model: "Project Nightingale hf_AbCdEfGhIjKlMnOp", whileTranscribing: true }, { t: 2, kind: "request", host: hostile, whileTranscribing: false }] },
    }));
    for (const s of [hostile, "stole", "Nightingale", "hf_AbCdEf"]) expect(t).not.toContain(s);
    expect(t).toContain("unknown");
  });
  it("lists the network entries the app made, host names only", () => {
    const t = buildEvidence(base({ net: { since: 0, transcriptions: 2, entries: [{ t: Date.UTC(2026, 0, 2, 11, 5, 6), kind: "update", host: "api.github.com", whileTranscribing: false }] } }));
    expect(t).toContain("11:05:06 UTC: the update check, api.github.com");
    expect(t).toContain("Transcriptions since the app opened: 2");
  });
});

describe("sizes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-"));
  it("adds up a folder, returns null for a missing place, and counts the project list with its backups", () => {
    fs.mkdirSync(path.join(dir, "recordings", "sub"), { recursive: true });
    fs.writeFileSync(path.join(dir, "recordings", "a.wav"), Buffer.alloc(100));
    fs.writeFileSync(path.join(dir, "recordings", "sub", "b.wav"), Buffer.alloc(50));
    expect(pathBytes(path.join(dir, "recordings"))).toBe(150);
    expect(pathBytes(path.join(dir, "nope"))).toBeNull();
    expect(projectListBytes(path.join(dir, "projects.json"))).toBeNull();
    fs.writeFileSync(path.join(dir, "projects.json"), "x".repeat(10));
    fs.writeFileSync(path.join(dir, "projects.json.bak1"), "x".repeat(5));
    fs.writeFileSync(path.join(dir, "projects.corrupt-1.json"), "x".repeat(3));
    fs.writeFileSync(path.join(dir, "other.json"), "x".repeat(99));
    expect(projectListBytes(path.join(dir, "projects.json"))).toBe(18);
  });
  it("does not follow a link out of the folder", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-out-"));
    fs.writeFileSync(path.join(outside, "big"), Buffer.alloc(1000));
    fs.mkdirSync(path.join(dir, "linked"));
    try { fs.symlinkSync(outside, path.join(dir, "linked", "l")); } catch { return; } // Windows without the right may not create links
    expect(pathBytes(path.join(dir, "linked"))).toBeLessThan(1000);
  });
});

describe("network host list", () => {
  it("covers every host in the Python tripwire's allow-list", () => {
    const py = fs.readFileSync("../engine/tests/test_network_surface.py", "utf8").replace(/\r\n/g, "\n");
    const hosts = [...(py.match(/^ALLOWED_HOSTS = \{([^}]*)\}/m)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((h) => h !== "www.w3.org");
    const listed = NETWORK_HOSTS.map((h) => h.host).join(" ");
    for (const h of hosts) expect(listed, h).toContain(h);
  });
});
