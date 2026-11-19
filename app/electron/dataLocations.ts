import path from "node:path";

/** The folders and files the app keeps inside its own data folder (userData). Pure, so Settings > Privacy and the tests use the same names as the code
 *  that writes them: recordings (live.ts, "sample" in main.ts), peaks ("peaks" in main.ts), partials (partialStore.ts), tmp (tempJson.ts, main.ts), projects.json (projectsStore.ts),
 *  activity.log (activityLog.ts), hf-token.bin and models (main.ts). */
export function dataLocations(userData: string) {
  return {
    data: userData,
    projects: path.join(userData, "projects.json"),
    recordings: path.join(userData, "recordings"),
    peaks: path.join(userData, "peaks"),
    partials: path.join(userData, "partials"),
    tmp: path.join(userData, "tmp"),
    models: path.join(userData, "models"),
    log: path.join(userData, "activity.log"),
    token: path.join(userData, "hf-token.bin"),
  };
}
export type DataLocations = ReturnType<typeof dataLocations>;
