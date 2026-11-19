import { describe, expect, it } from "vitest";
import { buildBundle, bundleRequest, scrubLog } from "../electron/supportBundle";
import { crc32, zipStore } from "../electron/zipStore";

// Planted secrets: none of these may appear in any file of the bundle.
const TRANSCRIPT = "the patient admitted she stole the quarterly report";
const FILE = "Patient Smith interview.wav";
const HOME = "/Users/ingrid.stevens";
const TOKEN = "hf_AbCdEfGhIjKlMnOpQrStUvWxYz0123";
const USER = "ingrid.stevens";
const SECRETS = [TRANSCRIPT, "stole the quarterly", FILE, "Patient Smith", HOME, USER, TOKEN, "hf_AbCdEf", "ingrid@example.com", "Project Nightingale", "Speaker Ana Müller"];

const rawLog = [
  `2026-01-02T10:00:00.000Z [info] Input: ${HOME}/Documents/${FILE} (range 0.0s-5.0s)`,
  `2026-01-02T10:00:01.000Z [info] Saved the transcript next to the audio: ${HOME}/Documents/Patient Smith interview.transcript.json`,
  `2026-01-02T10:00:02.000Z [error] token ${TOKEN} rejected for ingrid@example.com`,
  `2026-01-02T10:00:03.000Z [renderer] failed in ${USER}'s project, see ${HOME}/x`,
  `${TRANSCRIPT} (a stray line without the log format)`,
  `2026-01-02T10:00:04.000Z [info] Decoded to 16 kHz mono, 24.0s.`,
].join("\n");

const hostile = {
  model: `small ${TRANSCRIPT}`,
  downloaded: ["tiny", FILE, TOKEN, "small"],
  diarization: true,
  checks: [{ id: "engine", level: "ok" }, { id: "Project Nightingale", level: "Speaker Ana Müller" }],
  includeLog: true,
};

describe("diagnostics bundle", () => {
  const input = () => {
    const r = bundleRequest(hostile)!;
    return buildBundle({
      appVersion: "0.1.0", electron: "44.7.2",
      os: { platform: "darwin", arch: "arm64", release: "25.5.0", chip: "Apple M5 Pro", cores: 18, memGB: 48 },
      freeBytes: 50 * 2 ** 30, model: r.model, downloaded: r.downloaded, diarization: r.diarization, checks: r.checks,
      log: rawLog, scrub: { home: HOME, user: USER },
    });
  };
  it("contains none of the planted secrets in any file", () => {
    const files = input();
    expect(files.map((f) => f.name)).toEqual(["README.txt", "system.txt", "models.txt", "setup-check.txt", "activity-log.txt"]);
    for (const f of files) for (const s of SECRETS) expect(f.text, `${f.name} leaks ${s}`).not.toContain(s);
  });
  it("also refuses secrets planted in the system fields", () => {
    const files = buildBundle({
      appVersion: `0.1 ${TOKEN}`, electron: FILE,
      os: { platform: HOME, arch: USER, release: TRANSCRIPT, chip: `${HOME}/chip`, cores: NaN, memGB: -1 },
      freeBytes: null, model: "small", downloaded: [], diarization: false, checks: [], log: null,
    });
    for (const f of files) for (const s of SECRETS) expect(f.text).not.toContain(s);
  });
  it("keeps the useful parts", () => {
    const f = Object.fromEntries(input().map((x) => [x.name, x.text]));
    expect(f["system.txt"]).toContain("App version: 0.1.0");
    expect(f["system.txt"]).toContain("Memory: 48 GB");
    expect(f["models.txt"]).toContain("Downloaded: tiny, small");
    expect(f["activity-log.txt"]).toContain("Decoded to 16 kHz mono, 24.0s.");
    expect(f["activity-log.txt"]).not.toContain("stray line");
  });
  it("leaves the log out when asked", () => {
    expect(buildBundle({ appVersion: "1", electron: "1", os: { platform: "linux", arch: "x64", release: "6", chip: "", cores: 1, memGB: 1 }, freeBytes: null, model: "tiny", downloaded: [], diarization: false, checks: [], log: null }).some((f) => f.name === "activity-log.txt")).toBe(false);
  });
  it("scrubLog drops long opaque strings and caps the length", () => {
    expect(scrubLog(`2026-01-02T10:00:00.000Z [info] key ${"a".repeat(40)} ok`)).toContain("[redacted]");
    expect(scrubLog(`2026-01-02T10:00:00.000Z [info] ${"word ".repeat(200)}`).length).toBeLessThan(420);
  });
  it("bundleRequest rejects non-objects and keeps only shapes", () => {
    expect(bundleRequest(null)).toBeNull();
    expect(bundleRequest({ model: "small" })).toBeNull();
    expect(bundleRequest(hostile)!.downloaded).toEqual(["tiny", "small"]);
  });
});

describe("zipStore", () => {
  it("writes a readable stored zip", () => {
    const zip = zipStore([{ name: "a.txt", data: Buffer.from("hello") }, { name: "b.txt", data: Buffer.from("") }]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(2);
    const cd = zip.readUInt32LE(end + 16);
    expect(zip.readUInt32LE(cd)).toBe(0x02014b50);
    expect(zip.readUInt32LE(cd + 16)).toBe(crc32(Buffer.from("hello")));
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(zip.includes(Buffer.from("hello"))).toBe(true);
  });
});
