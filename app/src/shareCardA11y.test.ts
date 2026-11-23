import { describe, expect, it } from "vitest";
import { cardDescription, type Share } from "./components/shareCardLib";

const say = (s: string, v: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
const shares: Share[] = [
  { id: "A", name: "Ana", seconds: 60, pct: 66.7, color: "#000" },
  { id: "B", name: "Ben", seconds: 30, pct: 33.3, color: "#000" },
];

describe("cardDescription", () => {
  it("names the title and each speaker's share, with no quote", () => {
    expect(cardDescription("Weekly", shares, null, say)).toBe("Share card for “Weekly”. Talk time: Ana 67%, Ben 33%.");
  });
  it("adds the quote and who said it", () => {
    expect(cardDescription("Weekly", shares, { text: "Hello", name: "Ana" }, say)).toContain("Quote from Ana: “Hello”");
  });
  it("copes with no speakers", () => {
    expect(cardDescription("Empty", [], null, say)).toBe("Share card for “Empty”.");
  });
});
