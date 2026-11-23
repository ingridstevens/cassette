import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createNetWatch } from "../electron/netWatch";
import { dueForCheck, isNewer, parseVersion, readUpdateFile, releaseVersion, updateState, UPDATES_OFF, WEEK_MS } from "../electron/updateLogic";
import { netSummary } from "./netSummary";

describe("version comparison", () => {
  it("reads plain versions, with or without v", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("0.4")).toEqual([0, 4, 0]);
  });
  it("refuses pre-releases and anything else", () => {
    for (const s of ["1.2.3-beta.1", "latest", "", "1.2.3.4", "2026-11-23", null, 3]) expect(parseVersion(s)).toBeNull();
  });
  it("says newer only when strictly newer", () => {
    expect(isNewer("1.2.4", "1.2.3")).toBe(true);
    expect(isNewer("v1.10.0", "1.9.9")).toBe(true);
    expect(isNewer("2.0.0", "1.99.99")).toBe(true);
    expect(isNewer("1.2.3", "1.2.3")).toBe(false);
    expect(isNewer("1.2.2", "1.2.3")).toBe(false);
    expect(isNewer("garbage", "1.2.3")).toBe(false);
    expect(isNewer("1.2.3", "garbage")).toBe(false);
  });
});

describe("releaseVersion", () => {
  it("takes the tag of a normal release", () => { expect(releaseVersion({ tag_name: "v0.5.0", name: "x" })).toBe("0.5.0"); });
  it("refuses drafts, pre-releases and unexpected answers", () => {
    expect(releaseVersion({ tag_name: "v0.5.0", prerelease: true })).toBeNull();
    expect(releaseVersion({ tag_name: "v0.5.0", draft: true })).toBeNull();
    expect(releaseVersion({ message: "Not Found" })).toBeNull();
    expect(releaseVersion({ tag_name: "nightly" })).toBeNull();
    expect(releaseVersion(null)).toBeNull();
    expect(releaseVersion("v1.0.0")).toBeNull();
  });
});

describe("dueForCheck: one request a week, and none while off", () => {
  const now = 1_700_000_000_000;
  it("never checks while the switch is off, whatever the dates say", () => {
    expect(dueForCheck({ on: false, lastChecked: null }, now)).toBe(false);
    expect(dueForCheck({ on: false, lastChecked: now - 10 * WEEK_MS }, now)).toBe(false);
  });
  it("checks at once when on and never checked", () => { expect(dueForCheck({ on: true, lastChecked: null }, now)).toBe(true); });
  it("waits a full week", () => {
    expect(dueForCheck({ on: true, lastChecked: now - WEEK_MS + 1 }, now)).toBe(false);
    expect(dueForCheck({ on: true, lastChecked: now - WEEK_MS }, now)).toBe(true);
  });
  it("treats a last-checked time in the future as due", () => { expect(dueForCheck({ on: true, lastChecked: now + 1000 }, now)).toBe(true); });
});

describe("the stored file", () => {
  it("is off when missing, empty or damaged", () => {
    for (const text of ["", "not json", "null", "[]"]) expect(readUpdateFile(text)).toEqual(UPDATES_OFF);
  });
  it("is off unless on is exactly true", () => { expect(readUpdateFile(JSON.stringify({ on: "yes" })).on).toBe(false); });
  it("keeps only well-formed fields", () => {
    expect(readUpdateFile(JSON.stringify({ on: true, lastChecked: 5, latest: "1.2.3", failed: true }))).toEqual({ on: true, lastChecked: 5, latest: "1.2.3", failed: true });
    expect(readUpdateFile(JSON.stringify({ on: true, lastChecked: "x", latest: "<script>" }))).toEqual({ on: true, lastChecked: null, latest: null, failed: false });
  });
  it("shows a newer version only while on", () => {
    const f = { on: true, lastChecked: 1, latest: "1.3.0", failed: false };
    expect(updateState(f, "1.2.0").newer).toBe("1.3.0");
    expect(updateState(f, "1.3.0").newer).toBeNull();
    expect(updateState({ ...f, on: false }, "1.2.0")).toMatchObject({ newer: null, failed: false });
  });
});

describe("Network activity", () => {
  it("records the update check with the host name only and counts it", () => {
    const w = createNetWatch();
    w.update("api.github.com");
    expect(w.snapshot().entries.map((e) => [e.kind, e.host])).toEqual([["update", "api.github.com"]]);
    expect(netSummary(w.snapshot()).updates).toBe(1);
  });
});

// The privacy promise in code: the request exists in one file only, is reachable only through the weekly rule, and the switch starts off.
describe("the request is guarded", () => {
  const src = readFileSync("electron/ipc/updates.ts", "utf8");
  const call = "net" + ".fetch" + "("; // written in parts so the web-request tripwire (engine/tests/test_network_surface.py) only sees the real call
  it("has exactly one request, made only after the due check", () => {
    expect(src.split(call).length - 1).toBe(1);
    expect(src.indexOf("dueForCheck(")).toBeGreaterThan(-1);
    expect(src.indexOf("dueForCheck(")).toBeLessThan(src.indexOf(call));
  });
  it("is recorded for the Network activity card before it is made", () => {
    expect(src.indexOf('watch.update("api.github.com")')).toBeGreaterThan(-1);
    expect(src.indexOf('watch.update("api.github.com")')).toBeLessThan(src.indexOf(call));
  });
  it("sends no cookies", () => { expect(src).toContain('credentials: "omit"'); });
  it("starts off", () => { expect(UPDATES_OFF.on).toBe(false); });
});
