import { describe, expect, it } from "vitest";
import { clampZoom, followScroll, maxZoom, pxPerSec, stepZoom, zoomLabel } from "./waveZoom";

describe("maxZoom", () => {
  it("allows a deep zoom on a short recording", () => { expect(maxZoom(800, 60, 8000)).toBe(30); });
  it("is limited by the peaks on a long recording (22 px per second at most for an hour)", () => { expect(maxZoom(800, 3600, 8000)).toBe(100); expect(maxZoom(800, 36000, 8000)).toBe(100); });
  it("is 1 when there is nothing to zoom into", () => { expect(maxZoom(800, 3, 8000)).toBe(1); expect(maxZoom(0, 60, 8000)).toBe(1); expect(maxZoom(800, 0, 8000)).toBe(1); expect(maxZoom(800, 60, 0)).toBe(1); });
});
describe("clampZoom and stepZoom", () => {
  it("clamps into 1..max", () => { expect(clampZoom(0.2, 8)).toBe(1); expect(clampZoom(50, 8)).toBe(8); expect(clampZoom(NaN, 8)).toBe(1); });
  it("doubles in and halves out", () => { expect(stepZoom(1, 1, 32)).toBe(2); expect(stepZoom(4, 1, 32)).toBe(8); expect(stepZoom(8, -1, 32)).toBe(4); expect(stepZoom(2, -1, 32)).toBe(1); });
  it("stops at both ends and ends exactly at the maximum", () => { expect(stepZoom(1, -1, 32)).toBe(1); expect(stepZoom(32, 1, 32)).toBe(32); expect(stepZoom(8, 1, 12)).toBe(12); expect(stepZoom(12, -1, 12)).toBe(8); expect(stepZoom(1, 1, 1)).toBe(1); });
});
describe("pxPerSec and zoomLabel", () => {
  it("is 0 (fit) at factor 1", () => { expect(pxPerSec(1, 800, 60)).toBe(0); expect(pxPerSec(4, 800, 60)).toBeCloseTo(53.33, 1); expect(pxPerSec(4, 800, 0)).toBe(0); });
  it("labels", () => { expect(zoomLabel(1)).toBe(""); expect(zoomLabel(4)).toBe("4×"); expect(zoomLabel(12.04)).toBe("12×"); });
});
describe("followScroll", () => {
  it("leaves a visible playhead alone", () => { expect(followScroll(5, 100, 400, 500)).toBeNull(); });
  it("scrolls when the playhead is off to either side", () => { expect(followScroll(20, 100, 0, 500)).toBe(1850); expect(followScroll(1, 100, 400, 500)).toBe(0); });
  it("does nothing without a zoom", () => { expect(followScroll(5, 0, 0, 500)).toBeNull(); });
});
