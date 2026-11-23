/**
 * A short list, kept in memory since the app started, of the network use the app itself starts. It exists so a person can look and see that
 * transcribing starts none (Settings, Privacy, Network activity).
 *
 * What it can show, and no more:
 *  - "request": a request made by the app's own window to something that is not part of the app (the window should make none).
 *  - "model": the app asked the speech engine to download a model or check the Hugging Face token. The connection itself is made inside the
 *    engine, which this list does not watch; only the fact that the app asked is recorded.
 *  - "link": a page the app opened in the person's browser (huggingface.co pages and the feedback form).
 * What it cannot show: other software on the computer, or the engine's own connections. Only the host name is kept, never a path, query or token.
 */
export type NetKind = "request" | "model" | "link";
export type NetEntry = {
  t: number; kind: NetKind;
  /** Host name for a request or link; empty for a model action. */
  host: string;
  /** For a model action: "download", "repair" or "check", and the model's name when there is one. */
  action?: string; model?: string;
  /** True when a transcription was running at that moment. */
  whileTranscribing: boolean;
};
export type NetActivity = { since: number; entries: NetEntry[]; transcribing: boolean; transcriptions: number };

/** Parts of the app itself: its files, the player's media:// stream, developer tools and in-memory data. These are not network use. */
const LOCAL_SCHEMES = new Set(["file:", "media:", "devtools:", "chrome-extension:", "chrome:", "data:", "blob:", "about:"]);
const CAP = 200;

/** The host to show for a window request, or null when it is the app's own content (or the development server's address). */
export function foreignHost(url: string, devOrigin?: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return url.slice(0, 40) || "(unreadable address)"; }
  if (LOCAL_SCHEMES.has(u.protocol)) return null;
  if (devOrigin) { try { if (u.host === new URL(devOrigin).host) return null; } catch { /* no dev server address */ } }
  return u.hostname || u.protocol;
}

/** Model actions that reach the internet when they run (the Privacy table): downloading, repairing and the token check. */
export const NETWORK_MODEL_ACTIONS = new Set(["download", "repair", "check"]);

export function createNetWatch(now: () => number = Date.now) {
  const since = now();
  const entries: NetEntry[] = [];
  let running = 0, transcriptions = 0;
  const add = (e: Omit<NetEntry, "t" | "whileTranscribing">) => {
    entries.push({ t: now(), whileTranscribing: running > 0, ...e });
    if (entries.length > CAP) entries.splice(0, entries.length - CAP);
  };
  return {
    /** A request from the app's window. Returns true when it was not the app's own content and was recorded. */
    request(url: string, devOrigin?: string): boolean {
      const host = foreignHost(url, devOrigin);
      if (host === null) return false;
      add({ kind: "request", host });
      return true;
    },
    /** The app asked the engine for a model action. Only actions that use the network are recorded. */
    model(action: string, model?: string): boolean {
      if (!NETWORK_MODEL_ACTIONS.has(action)) return false;
      add({ kind: "model", host: "", action, ...(model ? { model } : {}) });
      return true;
    },
    /** A page opened in the person's browser. */
    link(url: string): void {
      let host = "";
      try { host = new URL(url).hostname; } catch { /* not an address */ }
      add({ kind: "link", host });
    },
    /** A transcription started or ended; entries made in between are marked as made while transcribing. */
    transcriptionStarted() { running++; transcriptions++; },
    transcriptionEnded() { running = Math.max(0, running - 1); },
    snapshot(): NetActivity { return { since, entries: entries.slice(), transcribing: running > 0, transcriptions }; },
  };
}
export type NetWatch = ReturnType<typeof createNetWatch>;
