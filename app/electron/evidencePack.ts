import fs from "node:fs";
import path from "node:path";
import type { DataLocations } from "./dataLocations";
import type { NetEntry } from "./netWatch";

/**
 * The evidence summary (Settings, Privacy, Save evidence summary). A short Markdown page for a data-protection officer: app and system versions, where the
 * app keeps data and how big each place is, which web hosts the app can ever contact and when, and what the app itself did on the network since it started.
 * An ALLOWLIST like the diagnostics bundle: every value below is a version, a size, a fixed text or a host name; no audio, no transcript, no project, file or
 * speaker name, no token and no activity log text is read. Paths of the app's own folders are written with the home folder shown as "~".
 * Pure (no Electron), so the tests can plant secrets and check none survive.
 */
export type SizeKey = "data" | "projects" | "recordings" | "peaks" | "partials" | "tmp" | "models" | "log";
export interface EvidenceInput {
  appVersion: string; electron: string; platform: string; arch: string; osRelease: string;
  /** The data folder's places and their sizes in bytes (null: does not exist yet or could not be read). */
  locations: DataLocations; sizes: Record<SizeKey, number | null>;
  home: string;
  net: { since: number; entries: NetEntry[]; transcriptions: number };
  /** Milliseconds since 1970 when the summary was made. */
  now: number;
}

/** The only hosts the app's own code can reach, with when and which file does it. Kept next to ALLOWED_HOSTS in engine/tests/test_network_surface.py (a test compares them). */
export const NETWORK_HOSTS: { host: string; when: string; source: string }[] = [
  { host: "huggingface.co", when: "You press Download or Repair on a model, or save or check a Hugging Face token", source: "engine/src/engine/models.py" },
  { host: "download.moonshine.ai", when: "You download a Moonshine model", source: "engine/src/engine/asr_moonshine.py" },
  { host: "api.github.com", when: "Only if you switch on the update notice: when you switch it on, then at most once a week", source: "app/electron/ipc/updates.ts" },
  { host: "huggingface.co and github.com pages", when: "Only when you press a link that opens a page in your browser; the app sends nothing itself", source: "app/electron/ipc/diagnostics.ts" },
];

const ONE = (v: unknown, re: RegExp, max = 60) => (typeof v === "string" && v.length <= max && re.test(v) ? v : "unknown");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sizeText = (n: number | null) => (n === null ? "does not exist yet" : n < 1000 ? `${n} B` : n < 1e6 ? `${(n / 1e3).toFixed(1)} kB` : n < 1e9 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e9).toFixed(2)} GB`);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildEvidence(i: EvidenceInput): string {
  const home = [i.home, i.home.replace(/\\/g, "/")].filter((h) => h.length > 1);
  const shown = (p: string) => home.reduce((m, h) => m.replace(new RegExp("^" + esc(h), "i"), "~"), p);
  const row = (what: string, where: string, key: SizeKey, note: string) => `| ${what} | \`${shown(where)}\` | ${sizeText(num(i.sizes[key]))} | ${note} |`;
  const kinds = { request: "a request from the app's window", update: "the update check", link: "a page opened in your browser", model: "a model action asked of the engine" } as const;
  const entries = i.net.entries.slice(-50).map((e) => `- ${new Date(e.t).toISOString().slice(11, 19)} UTC: ${kinds[e.kind] ?? "other"}${e.host ? `, ${ONE(e.host, /^[a-z0-9.-]+$/i, 80)}` : ""}${e.kind === "model" ? ` (${ONE(e.action, /^[a-z]+$/, 12)})` : ""}${e.whileTranscribing ? " while a transcription ran" : ""}`);
  return [
    "# Cassette: where your data is (evidence summary)",
    "",
    `Made on this computer on ${day(i.now)} and saved where you chose. Nothing was sent anywhere. It contains no audio, no transcript text and no project, file or speaker names.`,
    "It was written from the app's own code and the folders on this computer; it is not an independent audit. The longer version, with the source file behind each row, is docs/data-evidence.md in the project.",
    "",
    "## Versions",
    "",
    `- Cassette ${ONE(i.appVersion, /^\d[\d.]*(-[a-z0-9.]{1,20})?$/i, 30)}`,
    `- Electron ${ONE(i.electron, /^\d[\d.]*(-[a-z0-9.]{1,20})?$/i, 30)}`,
    `- System: ${ONE(i.platform, /^[a-z0-9]+$/i, 20)} ${ONE(i.arch, /^[a-z0-9_]+$/i, 20)}, release ${ONE(i.osRelease, /^[\w.-]+$/, 40)}`,
    "",
    "## Where the app keeps data",
    "",
    "Sizes are read from the folders now (file sizes only, no contents). The app does not encrypt these files; use your system's disk encryption (FileVault, BitLocker or the Linux equivalent). The app does not check whether it is on.",
    "",
    "| What | Where | Size | Note |",
    "| --- | --- | --- | --- |",
    row("Data folder (everything below)", i.locations.data, "data", "The app's own folder"),
    row("Projects, transcripts, speaker names", i.locations.projects, "projects", "projects.json; up to three rolling backups beside it"),
    row("Recordings made in the app", i.locations.recordings, "recordings", "Audio"),
    row("Lines of an unfinished transcription", i.locations.partials, "partials", "Transcript text; only for a run that did not finish"),
    row("Waveform cache", i.locations.peaks, "peaks", "Loudness values, no words, no audio"),
    row("Temporary files", i.locations.tmp, "tmp", "Emptied when the app starts"),
    row("Models", i.locations.models, "models", "No recordings or transcripts"),
    row("Activity log", i.locations.log, "log", "File names and engine messages"),
    "",
    "Not in the data folder: your own recordings (opened where they are, never copied), backups, exports and the anonymisation key (saved where you chose), and the decoded audio the engine holds in the system temporary folder while a job runs.",
    "",
    "## Network: the only places the app's code can reach",
    "",
    ...NETWORK_HOSTS.map((h) => `- ${h.host}: ${h.when}. Source: ${h.source}`),
    "- Everything else (transcribing, exporting, highlights, translation, retention): never.",
    "",
    `## What the app did on the network since it started (${day(i.net.since)})`,
    "",
    `Transcriptions since the app opened: ${num(i.net.transcriptions) ?? 0}. It cannot see other software or the engine's own connections, and the list starts empty each time the app opens.`,
    "",
    ...(entries.length ? entries : ["Nothing: no request, no download and no page opened."]),
    "",
  ].join("\n");
}

/** Total size in bytes of a file or of everything under a folder (symbolic links are not followed), or null when it does not exist. Reads sizes only. */
export function pathBytes(p: string, limit = 200_000): number | null {
  let left = limit;
  const walk = (q: string): number => {
    let st: fs.Stats;
    try { st = fs.lstatSync(q); } catch { return 0; }
    if (st.isSymbolicLink()) return 0;
    if (!st.isDirectory()) return st.size;
    let sum = 0;
    let names: string[];
    try { names = fs.readdirSync(q); } catch { return 0; }
    for (const n of names) { if (--left < 0) break; sum += walk(path.join(q, n)); }
    return sum;
  };
  try { fs.lstatSync(p); } catch { return null; }
  return walk(p);
}

/** projects.json plus its rolling backups (projects.json.bak1 to bak3) and any moved-aside damaged copies. */
export function projectListBytes(file: string): number | null {
  const dir = path.dirname(file), base = path.basename(file, ".json");
  let names: string[];
  try { names = fs.readdirSync(dir); } catch { return null; }
  const mine = names.filter((n) => n === base + ".json" || n.startsWith(base + ".json.bak") || (n.startsWith(base + ".corrupt-") && n.endsWith(".json")));
  return mine.length ? mine.reduce((s, n) => s + (pathBytes(path.join(dir, n)) ?? 0), 0) : null;
}
