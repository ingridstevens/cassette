import { describe, expect, it } from "vitest";
import { filterProjects } from "./projectFilter";

const list = [{ name: "Interview Lucía" }, { name: "Team meeting" }, { name: "Podcast 12" }];

describe("filterProjects", () => {
  it("keeps everything for an empty or blank query", () => {
    expect(filterProjects(list, "")).toBe(list);
    expect(filterProjects(list, "   ")).toBe(list);
  });
  it("matches part of a name, ignoring capitals and accents", () => {
    expect(filterProjects(list, "LUCIA").map((p) => p.name)).toEqual(["Interview Lucía"]);
    expect(filterProjects(list, "meet").map((p) => p.name)).toEqual(["Team meeting"]);
  });
  it("returns nothing when no name matches", () => {
    expect(filterProjects(list, "zzz")).toEqual([]);
  });
});
