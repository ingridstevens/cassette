import { beforeEach, describe, expect, it } from "vitest";
import { isTested, loadDismissed, recommendedModel, saveDismissed, suggest } from "./recommend";

const mac = { platform: "darwin", arch: "arm64", memGB: 16 };
const win = { platform: "win32", arch: "x64", memGB: 16 };

describe("recommendedModel", () => {
  it("is Small when it fits", () => { expect(recommendedModel(mac, true)).toBe("small"); expect(recommendedModel({ ...mac, memGB: undefined }, true)).toBe("small"); });
  it("steps down with little memory", () => {
    expect(recommendedModel({ ...mac, memGB: 4 }, true)).toBe("base");
    expect(recommendedModel({ ...mac, memGB: 3 }, true)).toBe("tiny");
  });
});

describe("suggest", () => {
  it("says nothing when the choice is already the suggestion", () => expect(suggest("small", mac, true)).toBeNull());
  it("never corrects a bigger size that fits", () => expect(suggest("large-v3", { ...mac, memGB: 48 }, true)).toBeNull());
  it("leaves Parakeet and Moonshine alone", () => { expect(suggest("parakeet-v3", { ...mac, memGB: 4 }, true)).toBeNull(); expect(suggest("moonshine-en", mac, true)).toBeNull(); });
  it("suggests a smaller size when the choice will not fit", () => expect(suggest("large-v3", { ...mac, memGB: 8 }, true)).toMatchObject({ model: "small", reason: "memory" }));
  it("suggests Small over Tiny on a computer that can run it", () => expect(suggest("tiny", mac, true)).toMatchObject({ model: "small", reason: "better" }));
  it("marks everything but Apple silicon as not tested", () => {
    expect(suggest("large-v3", { ...win, memGB: 8 }, true)?.tested).toBe(false);
    expect(suggest("large-v3", { platform: "linux", arch: "x64", memGB: 8 }, true)?.tested).toBe(false);
    expect(suggest("large-v3", { platform: "darwin", arch: "x64", memGB: 8 }, true)?.tested).toBe(false);
    expect(isTested(mac)).toBe(true);
  });
  it("notes a missing Apple GPU version only on Apple silicon", () => {
    expect(suggest("tiny", mac, true, { mlxAvailable: true, mlx: { small: false } })?.appleGpuMissing).toBe(true);
    expect(suggest("tiny", mac, true, { mlxAvailable: true, mlx: { small: true } })?.appleGpuMissing).toBe(false);
    expect(suggest("tiny", win, true, { mlxAvailable: true, mlx: {} })?.appleGpuMissing).toBe(false);
  });
});

describe("dismissal", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  });
  it("is remembered", () => { expect(loadDismissed()).toBe(""); saveDismissed("small"); expect(loadDismissed()).toBe("small"); });
});
