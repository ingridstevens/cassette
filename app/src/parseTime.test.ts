import { describe, expect, it } from "vitest";
import { parseTime } from "./parseTime";

describe("parseTime", () => {
  it("reads plain seconds", () => { expect(parseTime("90")).toBe(90); expect(parseTime("90.5")).toBe(90.5); });
  it("reads minutes and seconds", () => { expect(parseTime("12:30")).toBe(750); });
  it("reads hours, minutes and seconds", () => { expect(parseTime("1:02:03")).toBe(3723); });
  it("trims spaces", () => { expect(parseTime("  1:05 ")).toBe(65); });
  it("rejects minutes or seconds over 59", () => { expect(parseTime("1:75")).toBeNull(); expect(parseTime("1:02:99")).toBeNull(); });
  it("rejects text that is not a time", () => { for (const s of ["", "abc", "1:", ":30", "-5", "1:2:3:4"]) expect(parseTime(s)).toBeNull(); });
});
