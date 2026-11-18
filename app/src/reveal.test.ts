import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion, revealTurn } from "./windowing";

afterEach(() => vi.unstubAllGlobals());

describe("prefersReducedMotion", () => {
  it("is false without a window", () => expect(prefersReducedMotion()).toBe(false));
  it("follows the media query", () => {
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q.includes("reduce") }) });
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe("revealTurn", () => {
  it("resolves null when no document exists", async () => expect(await revealTurn(3)).toBeNull());
});
