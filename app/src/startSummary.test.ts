import { beforeEach, describe, expect, it } from "vitest";
import { loadStartOpen, saveStartOpen, summaryLine } from "./startSummary";
import { Options } from "./types";

const t = (s: string, v?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k]));
const opts = (o: Partial<Options>) => ({ model: "small", language: "auto", numSpeakers: "", vad: false, prompt: "", noDiarize: false, device: "auto", autosave: true, ...o }) as Options;

describe("summaryLine", () => {
  it("describes the defaults", () => expect(summaryLine(t, opts({}))).toBe("Automatic language · Small model · find speakers"));
  it("names language, speakers and translation", () => {
    expect(summaryLine(t, opts({ language: "de", numSpeakers: "3", translate: true }))).toBe("German · Small model · 3 speakers · with translation");
  });
  it("covers several languages, a range and transcript only", () => {
    expect(summaryLine(t, opts({ multilingual: true, numSpeakers: "range", minSpeakers: "2", maxSpeakers: "5" }))).toBe("Several languages · Small model · 2 to 5 speakers");
    expect(summaryLine(t, opts({ noDiarize: true, numSpeakers: "3" }))).toBe("Automatic language · Small model · transcript only");
  });
});

describe("remembered fold", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  });
  it("starts closed and remembers the choice", () => {
    expect(loadStartOpen()).toBe(false);
    saveStartOpen(true);
    expect(loadStartOpen()).toBe(true);
    saveStartOpen(false);
    expect(loadStartOpen()).toBe(false);
  });
});
