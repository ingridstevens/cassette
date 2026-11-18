import { describe, expect, it } from "vitest";
import { fold, matcher, nearMisses } from "./find";

describe("fold", () => {
  it("strips accents and capitals", () => { expect(fold("Lucía")).toBe("lucia"); });
  it("keeps capitals when asked", () => { expect(fold("Élan", true)).toBe("Elan"); });
  it("keeps the length so positions line up", () => { expect(fold("Crème brûlée").length).toBe("Crème brûlée".length); });
});

describe("matcher", () => {
  it("is inactive for an empty query", () => {
    const m = matcher("   ");
    expect(m.active).toBe(false);
    expect(m.ranges("anything")).toEqual([]);
  });
  it("finds accented text without typing the accent", () => { expect(matcher("lucia").test("Hola, Lucía")).toBe(true); });
  it("ignores case by default and respects it on request", () => {
    expect(matcher("cat").count("Cat cat CAT")).toBe(3);
    expect(matcher("cat", { matchCase: true, wholeWord: false }).count("Cat cat CAT")).toBe(1);
  });
  it("limits to whole words", () => {
    const m = matcher("cat", { matchCase: false, wholeWord: true });
    expect(m.count("cat catalog concat cat.")).toBe(2);
  });
  it("returns the ranges of every match", () => { expect(matcher("ab").ranges("abxab")).toEqual([[0, 2], [3, 5]]); });
  it("replaces every match literally", () => {
    expect(matcher("a.").replace("a. a. b", "$&")).toEqual({ text: "$& $& b", n: 2 });
  });
  it("leaves text alone when nothing matches", () => { expect(matcher("zzz").replace("hello", "x")).toEqual({ text: "hello", n: 0 }); });
  it("cuts text into hit and non-hit parts", () => {
    expect(matcher("is").parts("this is")).toEqual([
      { text: "th", hit: false }, { text: "is", hit: true }, { text: " ", hit: false }, { text: "is", hit: true },
    ]);
  });
});

describe("nearMisses", () => {
  const texts = ["The meeting was long", "meetings are long", "meetings meetings"];
  it("suggests longer words that start with the query, most frequent first", () => {
    expect(nearMisses(texts, "meetin")[0]).toEqual({ word: "meetings", count: 3 });
  });
  it("suggests nothing for very short queries", () => { expect(nearMisses(texts, "me")).toEqual([]); });
  it("returns at most three", () => {
    expect(nearMisses(["cart carts carted carter cartel"], "cart").length).toBeLessThanOrEqual(3);
  });
});
