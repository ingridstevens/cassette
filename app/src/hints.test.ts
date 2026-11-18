import { beforeEach, describe, expect, it } from "vitest";
import { legacyAiPart, markSeen, normalizeTab, readSeen } from "./hints";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
});

describe("normalizeTab", () => {
  it("keeps the new ids", () => { expect(["speakers", "ai", "details"].map(normalizeTab)).toEqual(["speakers", "ai", "details"]); });
  it("maps the old ids to their new tab", () => {
    expect(normalizeTab("highlights")).toBe("ai"); expect(normalizeTab("ask")).toBe("ai");
    expect(normalizeTab("options")).toBe("details"); expect(normalizeTab("info")).toBe("details");
  });
  it("falls back to speakers", () => { expect(normalizeTab(undefined)).toBe("speakers"); expect(normalizeTab("nope")).toBe("speakers"); });
  it("keeps Ask as the AI part for an old saved ask tab", () => { expect(legacyAiPart("ask")).toBe("ask"); expect(legacyAiPart("highlights")).toBe("highlights"); });
});

describe("hints seen", () => {
  it("starts empty and remembers each hint once", () => {
    expect(readSeen()).toEqual([]);
    markSeen("a"); markSeen("a"); markSeen("b");
    expect(readSeen()).toEqual(["a", "b"]);
  });
  it("ignores corrupt storage", () => { store.hintsSeen = "{oops"; expect(readSeen()).toEqual([]); store.hintsSeen = "5"; expect(readSeen()).toEqual([]); });
});
