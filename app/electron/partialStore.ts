/**
 * The lines a transcription had written down when it was stopped, failed, or the app or computer went down (one file per project in
 * <data folder>/partials/). Plain Node, so it can be checked without Electron. Every write is atomic (temp file, then rename),
 * so a crash leaves either the old file or the new one. The file holds transcript text: owner-only permissions, removed as soon as
 * the run finishes, the project is deleted, or the user discards it.
 * This is a safety copy and a visible "interrupted" state. Nothing here continues a run: starting again begins from the start.
 */
import fs from "node:fs";
import path from "node:path";

export interface PartialLine { start: number; end: number; speaker: string; text: string; lang?: string }
export interface PartialSave { lines: PartialLine[]; audio: string; model: string; language: string }
export interface PartialInfo { lines: PartialLine[]; savedAt: number; model: string; language: string; /** The recording is not the one the lines were written from (or is gone). */ audioChanged: boolean }

const MAX_LINES = 100_000;
const ID = /^[A-Za-z0-9-]{1,64}$/;
export const validPartialId = (id: unknown): id is string => typeof id === "string" && ID.test(id);

const cleanLine = (l: unknown): PartialLine | null => {
  const o = l as Record<string, unknown> | null;
  if (!o || typeof o.start !== "number" || typeof o.end !== "number" || !isFinite(o.start) || !isFinite(o.end) || typeof o.speaker !== "string" || typeof o.text !== "string") return null;
  return { start: o.start, end: o.end, speaker: o.speaker.slice(0, 200), text: o.text, ...(typeof o.lang === "string" ? { lang: o.lang.slice(0, 20) } : {}) };
};
/** Lines in the order they were written; anything malformed is refused as a whole rather than half kept. */
export function cleanLines(v: unknown): PartialLine[] | null {
  if (!Array.isArray(v) || v.length > MAX_LINES) return null;
  const out: PartialLine[] = [];
  for (const l of v) { const c = cleanLine(l); if (!c) return null; out.push(c); }
  return out;
}

export function createPartialStore(dir: string) {
  const file = (id: string) => path.join(dir, `${id}.json`);
  const stamp = (audio: string) => { try { const s = fs.statSync(audio); return { size: s.size, mtimeMs: Math.floor(s.mtimeMs) }; } catch { return null; } };

  function save(id: string, d: PartialSave): boolean {
    if (!validPartialId(id)) return false;
    const lines = cleanLines(d?.lines);
    if (!lines || !lines.length) return false;
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = file(id) + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, savedAt: Date.now(), audio: String(d.audio), stamp: stamp(String(d.audio)), model: String(d.model).slice(0, 80), language: String(d.language).slice(0, 20), lines }), { mode: 0o600 });
    fs.renameSync(tmp, file(id));
    return true;
  }

  function load(id: string): PartialInfo | null {
    if (!validPartialId(id) || !fs.existsSync(file(id))) return null;
    try {
      const v = JSON.parse(fs.readFileSync(file(id), "utf8"));
      const lines = cleanLines(v?.lines);
      if (v?.version !== 1 || !lines || !lines.length || typeof v.savedAt !== "number") throw new Error("unreadable");
      const now = stamp(String(v.audio));
      return { lines, savedAt: v.savedAt, model: String(v.model ?? ""), language: String(v.language ?? ""),
        audioChanged: !now || !v.stamp || now.size !== v.stamp.size || now.mtimeMs !== v.stamp.mtimeMs };
    } catch { remove(id); return null; }  // a file that cannot be read is of no use to anyone; do not keep its text around
  }

  function remove(id: string): void { if (validPartialId(id)) { fs.rmSync(file(id), { force: true }); fs.rmSync(file(id) + ".tmp", { force: true }); } }

  /** Delete every file that does not belong to one of `keep` (projects that are gone, or already have a finished transcript), and any leftover temp file. */
  function prune(keep: Iterable<string>): void {
    const ok = new Set(keep);
    let names: string[];
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names) {
      const m = /^([A-Za-z0-9-]{1,64})\.json$/.exec(n);
      if (!m || !ok.has(m[1])) fs.rmSync(path.join(dir, n), { force: true });
    }
  }

  return { save, load, remove, prune };
}
