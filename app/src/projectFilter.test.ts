import { describe, expect, it } from "vitest";
import { FILTER_MIN, filterProjects } from "./projectFilter";

const list = [{ name: "Interview Lucía" }, { name: "Team call" }, { name: "interview two" }];

describe("filterProjects", () => {
  it("keeps everything when nothing (or only spaces) is typed", () => {
    expect(filterProjects(list, "")).toBe(list);
    expect(filterProjects(list, "   ")).toBe(list);
  });
  it("matches part of a name, ignoring capitals", () => {
    expect(filterProjects(list, "INTER").map((p) => p.name)).toEqual(["Interview Lucía", "interview two"]);
  });
  it("ignores accents in both directions", () => {
    expect(filterProjects(list, "lucia")).toHaveLength(1);
    expect(filterProjects([{ name: "Lucia" }], "lucía")).toHaveLength(1);
  });
  it("returns an empty list when nothing matches", () => {
    expect(filterProjects(list, "zzz")).toEqual([]);
  });
  it("only shows the field for long lists", () => { expect(FILTER_MIN).toBe(8); });
});
