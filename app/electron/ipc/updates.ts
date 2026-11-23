/**
 * The optional update notice. This file holds the app's ONLY request of its own to the internet, and it is made only while the person has switched
 * "Tell me when a new version is out" on (Settings, Privacy). The switch is off until they turn it on. One request to api.github.com, at most once a
 * week; it sends no cookies, no token and no identifier (GitHub sees the usual connection details and the app's name and version in the User-Agent),
 * reads only the newest release's version number from the answer, and never downloads or installs anything. The request is listed in Settings,
 * Privacy (Every network call) and in the Network activity card, and engine/tests/test_network_surface.py allows it in this file only.
 */
import fs from "node:fs";
import path from "node:path";
import { app, net } from "electron";
import { logLine } from "../activityLog";
import { dueForCheck, readUpdateFile, releaseVersion, updateState, UPDATES_OFF, type UpdateFile } from "../updateLogic";
import { handle, type IpcContext } from "./typed";

const LATEST_RELEASE = "https://api.github.com/repos/ingridstevens/cassette/releases/latest";
const RECHECK_MS = 6 * 3600 * 1000; // how often a running app looks at the clock; the weekly rule is dueForCheck's

export function registerUpdates({ watch }: IpcContext) {
  const file = () => path.join(app.getPath("userData"), "update-check.json");
  const load = (): UpdateFile => { try { return readUpdateFile(fs.readFileSync(file(), "utf-8")); } catch { return UPDATES_OFF; } };
  const save = (f: UpdateFile) => { try { fs.writeFileSync(file(), JSON.stringify(f)); } catch (e) { logLine("update", `could not save the update setting: ${(e as Error).message}`); } };
  const state = () => updateState(load(), app.getVersion());
  let busy = false;

  /** Makes the request only when the switch is on and a week has passed since the last one (or there has been none). */
  async function maybeCheck(): Promise<void> {
    const f = load();
    if (busy || !dueForCheck(f, Date.now())) return;
    busy = true;
    watch.update("api.github.com");
    try {
      const res = await net.fetch(LATEST_RELEASE, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": `Cassette/${app.getVersion()}` },
        credentials: "omit", signal: AbortSignal.timeout(10_000),
      });
      const version = res.ok ? releaseVersion(await res.json()) : null;
      // A release-less repository answers 404: not a failure, there is simply nothing newer to say.
      save({ ...load(), lastChecked: Date.now(), latest: version ?? load().latest, failed: !res.ok && res.status !== 404 || (res.ok && version === null) });
    } catch (e) {
      logLine("update", `update check failed: ${(e as Error).message}`);
      save({ ...load(), lastChecked: Date.now(), failed: true }); // wait a week before trying again rather than retrying on every start
    } finally { busy = false; }
  }

  handle("update-state", () => state());
  handle("update-set", async (_e, on: unknown) => {
    save({ ...load(), on: on === true });
    if (on === true) await maybeCheck();
    return state();
  });

  void maybeCheck();
  setInterval(() => void maybeCheck(), RECHECK_MS).unref();
}
