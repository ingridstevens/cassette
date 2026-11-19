import { redactNames } from "./logRedact";
import { MODEL_NAME } from "./validate";

/**
 * The diagnostics bundle (Settings, Advanced). An ALLOWLIST: every file below is built from fields named here, each cut to a fixed shape,
 * never from "everything the app knows". Nothing else (transcript text, audio, file or project names, speaker names, user name, home folder,
 * token, settings) can get in, because nothing else is read. Pure (no Electron, no disk), so the tests plant secrets and check none survive.
 *
 * Fields: app version, Electron version, OS name/arch/release, chip name, core count, memory (GB), free disk space, the model in use,
 * which models are downloaded (names only), whether speaker detection is set up, the setup-check results (id and level only), and the
 * activity log lines, scrubbed (see scrubLog). The log is the only free text; it is optional and the person sees it before saving.
 */
export interface BundleInput {
  appVersion: string; electron: string;
  os: { platform: string; arch: string; release: string; chip: string; cores: number; memGB: number };
  freeBytes: number | null;
  model: string; downloaded: string[]; diarization: boolean;
  checks: { id: string; level: string }[];
  log: string | null; // the raw activity log text, or null to leave it out
  /** Things to remove from the log if they appear: the home folder and the user name. */
  scrub?: { home?: string; user?: string };
}
export interface BundleFile { name: string; text: string }

const word = (v: unknown, max = 40) => (typeof v === "string" && /^[a-z0-9][a-z0-9.-]*$/i.test(v) && v.length <= max ? v : "unknown"); // no underscore: a token or a user name with one cannot pass
const version = (v: unknown) => (typeof v === "string" && /^\d[\d.]*(-[a-z0-9.]{1,20})?$/i.test(v) && v.length <= 30 ? v : "unknown");
const model = (v: unknown) => (typeof v === "string" && MODEL_NAME.test(v) ? v : "unknown");
const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null);
const chipName = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9 ().,@+-]{1,80}$/.test(v) ? v : "unknown");
const oneOf = (v: unknown, list: string[]) => (typeof v === "string" && list.includes(v) ? v : "unknown");
const LEVELS = new Set(["ok", "warn", "bad"]);
const MAX_LOG_LINES = 400;
const LOG_LINE = /^\d{4}-\d\d-\d\dT[\d:.]+Z \[[a-z]{2,12}\] /;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Log lines for sharing. Keeps only well-formed lines, applies the same name hiding as the "Hide file and folder names" setting (always, not only when it is on),
 *  then removes the home folder, the user name, tokens, e-mail addresses and long opaque strings. Best effort for free text: it cannot know a name inside ordinary
 *  words, which is why the person sees the result first and can leave the log out. */
export function scrubLog(raw: string, scrub: { home?: string; user?: string } = {}): string {
  const lines = raw.split(/\r?\n/).filter((l) => LOG_LINE.test(l)).slice(-MAX_LOG_LINES);
  return lines.map((l) => {
    let m = redactNames(l);
    for (const h of [scrub.home, scrub.home?.replace(/\\/g, "/"), scrub.home?.replace(/\//g, "\\")]) if (h && h.length > 1) m = m.replace(new RegExp(esc(h), "gi"), "~");
    if (scrub.user && scrub.user.length >= 2) m = m.replace(new RegExp(esc(scrub.user), "gi"), "[user]");
    m = m.replace(/\bhf_[A-Za-z0-9]{6,}/g, "[token]").replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
    return m.length > 400 ? m.slice(0, 400) + "…" : m;
  }).join("\n");
}

export function buildBundle(i: BundleInput): BundleFile[] {
  const cores = num(i.os.cores, 4096), mem = num(i.os.memGB, 100000), free = num(i.freeBytes, 2 ** 60);
  const files: BundleFile[] = [];
  files.push({ name: "README.txt", text: [
    "Cassette diagnostics",
    "",
    "Made on this computer and saved where you chose. Nothing was sent anywhere; attach it to a bug report yourself.",
    "It contains no recordings, transcripts, project names, speaker names, file names or token.",
    "Files: system.txt, models.txt, setup-check.txt" + (i.log == null ? "." : ", activity-log.txt (file names hidden as far as the app can recognise them)."),
  ].join("\n") + "\n" });
  files.push({ name: "system.txt", text: [
    `App version: ${version(i.appVersion)}`, `Electron: ${version(i.electron)}`,
    `OS: ${oneOf(i.os.platform, ["darwin", "win32", "linux", "freebsd"])} ${oneOf(i.os.arch, ["arm64", "x64", "ia32", "arm"])} ${version(i.os.release)}`,
    `Chip: ${chipName(i.os.chip)}`, `Cores: ${cores ?? "unknown"}`, `Memory: ${mem ?? "unknown"} GB`,
    `Free disk space (models drive): ${free == null ? "unknown" : Math.round(free / 2 ** 20) + " MB"}`,
  ].join("\n") + "\n" });
  files.push({ name: "models.txt", text: [
    `Model in use: ${model(i.model)}`,
    `Downloaded: ${i.downloaded.map((d) => model(d)).filter((d) => d !== "unknown").join(", ") || "none"}`,
    `Speaker detection: ${i.diarization === true ? "ready" : "not set up"}`,
  ].join("\n") + "\n" });
  files.push({ name: "setup-check.txt", text: i.checks.slice(0, 20).map((c) => `${LEVELS.has(c.level) ? c.level : "unknown"} ${word(c.id, 20)}`).join("\n") + "\n" });
  if (i.log != null) files.push({ name: "activity-log.txt", text: scrubLog(i.log, i.scrub) + "\n" });
  return files;
}

/** What the window may send for the bundle: shapes only. Returns the cleaned fields or null. */
export function bundleRequest(v: unknown): { model: string; downloaded: string[]; diarization: boolean; checks: { id: string; level: string }[]; includeLog: boolean } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.model !== "string" || !Array.isArray(o.downloaded) || !Array.isArray(o.checks)) return null;
  return {
    model: model(o.model), diarization: o.diarization === true, includeLog: o.includeLog !== false,
    downloaded: o.downloaded.slice(0, 40).map((d) => model(d)).filter((d) => d !== "unknown"),
    checks: o.checks.slice(0, 20).map((c) => ({ id: word((c as { id?: unknown })?.id, 20), level: LEVELS.has((c as { level?: string })?.level ?? "") ? (c as { level: string }).level : "unknown" })),
  };
}
