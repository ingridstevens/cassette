import path from "node:path";

/** The recordings the app knows about: the saved project list, files the user picked or dropped, and what the live recorder wrote.
 *  The window may only read, reveal or delete a recording whose path is in here, so a compromised window cannot point those at other files. */
export function createKnownPaths() {
  const known = new Set<string>();
  const key = (p: string) => path.resolve(p);
  return {
    /** Replaces the set with the paths in the saved project list (anything else in the list is ignored). */
    remember(list: unknown): void {
      if (!Array.isArray(list)) return;
      known.clear();
      const take = (f: unknown) => { if (typeof f === "string" && f) known.add(key(f)); };
      // recordings added to a project, and the ones its restore point would bring back
      const parts = (a: unknown) => { if (Array.isArray(a)) for (const x of a) take((x as { path?: unknown } | null)?.path); };
      for (const p of list) { const o = p as { path?: unknown; appended?: unknown; previous?: { appended?: unknown } | null } | null; take(o?.path); parts(o?.appended); parts(o?.previous?.appended); }
    },
    add(paths: unknown): void { if (Array.isArray(paths)) for (const p of paths) if (typeof p === "string" && p) known.add(key(p)); },
    has: (p: unknown): boolean => typeof p === "string" && known.has(key(p)),
  };
}
export type KnownPaths = ReturnType<typeof createKnownPaths>;
