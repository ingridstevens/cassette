/**
 * projects.json on disk: written atomically with rolling backups, and read back without ever wiping what is there.
 * A damaged file is moved aside (kept), then the newest readable backup is used. Plain Node, so it can be checked without Electron.
 */
import fs from "node:fs";
import path from "node:path";

export interface ProjectsLoad { projects: unknown[]; recoveredFrom?: string; recoveredAt?: number; corruptCopy?: string }

const BACKUP_EVERY_MS = 60_000;
const KEEP = 3;

export function createProjectsStore(dir: string, log: (level: string, message: string) => void = () => {}) {
  const file = () => path.join(dir, "projects.json");
  const bak = (n: number) => `${file()}.bak${n}`;
  let lastBackup = 0;

  const read = (f: string): unknown[] => {
    const v = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!Array.isArray(v)) throw new Error("not a list");
    return v;
  };

  function save(data: unknown): void {
    if (!Array.isArray(data)) throw new Error("projects must be an array");
    fs.mkdirSync(dir, { recursive: true });
    // at most one backup per minute, three kept; only a readable file is worth keeping as a backup
    if (fs.existsSync(file()) && Date.now() - lastBackup > BACKUP_EVERY_MS) {
      let readable = true;
      try { read(file()); } catch { readable = false; }
      if (readable) {
        for (let n = KEEP - 1; n >= 1; n--) if (fs.existsSync(bak(n))) fs.renameSync(bak(n), bak(n + 1));
        fs.copyFileSync(file(), bak(1));
        lastBackup = Date.now();
      }
    }
    const tmp = file() + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file());
  }

  function load(): ProjectsLoad {
    if (!fs.existsSync(file())) return { projects: [] };
    try { return { projects: read(file()) }; }
    catch (err) {
      const aside = file().replace(/\.json$/, `.corrupt-${Date.now()}.json`);
      fs.renameSync(file(), aside);
      log("error", `projects.json unreadable (${String(err)}); kept as ${path.basename(aside)}`);
      for (let n = 1; n <= KEEP; n++) {
        try {
          const projects = read(bak(n));
          return { projects, recoveredFrom: path.basename(bak(n)), recoveredAt: fs.statSync(bak(n)).mtimeMs, corruptCopy: path.basename(aside) };
        } catch { /* try the next backup */ }
      }
      return { projects: [], corruptCopy: path.basename(aside) };
    }
  }

  return { load, save };
}
