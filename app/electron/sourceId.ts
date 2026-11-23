import fs from "node:fs";
import { createHash } from "node:crypto";

/** What identifies a recording apart from its name and place: its size, and a SHA-256 over its size and three samples (start, middle, end). Stored with the project (see `SourceId` in src/types.ts). */
export interface SourceId { size: number; sample: string }

const CHUNK = 256 * 1024;

/**
 * Fingerprints a recording without reading all of it (a long video would take minutes): the size plus three 256 KB samples.
 * Two different recordings with the same size and the same bytes at all three places are not a realistic mistake; a moved or renamed copy gives the same value.
 * Returns null when the file is gone or is not a regular file.
 */
export async function fingerprintFile(file: string): Promise<SourceId | null> {
  let fh: fs.promises.FileHandle | undefined;
  try {
    fh = await fs.promises.open(file, "r");
    const st = await fh.stat();
    if (!st.isFile()) return null;
    const h = createHash("sha256").update(`cassette-source-v1:${st.size}:`);
    const at = st.size <= CHUNK * 3 ? [0] : [0, Math.floor((st.size - CHUNK) / 2), st.size - CHUNK];
    const buf = Buffer.alloc(CHUNK);
    for (const pos of at) {
      const want = st.size <= CHUNK * 3 ? st.size : CHUNK;
      let got = 0;
      while (got < want) { const r = await fh.read(buf, got, want - got, pos + got); if (!r.bytesRead) break; got += r.bytesRead; }
      h.update(buf.subarray(0, got));
    }
    return { size: st.size, sample: h.digest("hex") };
  } catch { return null; } finally { await fh?.close().catch(() => {}); }
}
