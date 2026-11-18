import { describe, expect, it } from "vitest";
import { ageDays, dueForRetention, lastUsed, type Dated } from "./retention";

const DAY = 86_400_000;
const now = 1_000 * DAY;
const proj = (id: string, p: Partial<Dated> = {}): Dated => ({ id, name: id, addedAt: now - 100 * DAY, status: "done", ...p });

describe("lastUsed", () => {
  it("is the latest of added, opened, edited and finished", () => {
    expect(lastUsed(proj("a", { openedAt: now - 5 * DAY, editedAt: now - 9 * DAY, meta: { finishedAt: now - 50 * DAY } }))).toBe(now - 5 * DAY);
  });
  it("falls back to the added time", () => { expect(lastUsed(proj("a"))).toBe(now - 100 * DAY); });
});

describe("dueForRetention", () => {
  it("is empty when retention is off", () => {
    const list = [proj("a")];
    expect(dueForRetention(list, undefined, now)).toEqual([]);
    expect(dueForRetention(list, 0, now)).toEqual([]);
    expect(dueForRetention(list, -3, now)).toEqual([]);
  });
  it("lists projects unused for longer than the period", () => {
    const list = [proj("old"), proj("new", { openedAt: now - DAY })];
    expect(dueForRetention(list, 30, now).map((p) => p.id)).toEqual(["old"]);
  });
  it("does not list a project unused for exactly the period", () => {
    expect(dueForRetention([proj("a", { addedAt: now - 30 * DAY })], 30, now)).toEqual([]);
  });
  it("never lists projects that are queued or running", () => {
    const list = [proj("q", { status: "queued" }), proj("r", { status: "running" }), proj("d")];
    expect(dueForRetention(list, 30, now).map((p) => p.id)).toEqual(["d"]);
  });
  it("counts editing as use", () => {
    expect(dueForRetention([proj("a", { editedAt: now - 2 * DAY })], 30, now)).toEqual([]);
  });
});

describe("ageDays", () => {
  it("counts whole days", () => { expect(ageDays(now - 45.9 * DAY, now)).toBe(45); });
  it("is never negative", () => { expect(ageDays(now + DAY, now)).toBe(0); });
});
