import { describe, expect, it } from "vitest";
import { parseTime, shortcutList } from "./shortcuts";

describe("shortcutList", () => {
  const list = shortcutList((s) => s);
  it("has a key and a description for every entry", () => {
    for (const [key, text] of list) { expect(key.length).toBeGreaterThan(0); expect(text.length).toBeGreaterThan(0); }
  });
  it("has no key listed twice", () => { const keys = list.map(([k]) => k); expect(new Set(keys).size).toBe(keys.length); });
  it("passes every description through the translator", () => {
    expect(shortcutList((s) => `<${s}>`).every(([, text]) => text.startsWith("<"))).toBe(true);
  });
  it("re-exports parseTime", () => { expect(parseTime("1:30")).toBe(90); });
});
