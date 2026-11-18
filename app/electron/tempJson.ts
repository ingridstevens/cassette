import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

// Transcript text handed to the engine as a file lives in a private folder (owner-only), not the shared system temp folder, and is always deleted afterwards.
const privateTmp = () => { const d = path.join(app.getPath("userData"), "tmp"); fs.mkdirSync(d, { recursive: true, mode: 0o700 }); return d; };
export async function withTempJson<T>(data: unknown, fn: (file: string) => Promise<T>): Promise<T> {
  const f = path.join(privateTmp(), `${randomUUID()}.json`);
  fs.writeFileSync(f, JSON.stringify(data), { mode: 0o600 });
  try { return await fn(f); } finally { fs.rmSync(f, { force: true }); }
}
