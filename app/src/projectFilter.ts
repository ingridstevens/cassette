import { fold } from "./find";

/** The sidebar filter field appears once the list is longer than this. */
export const FILTER_MIN_PROJECTS = 8;

/** Projects whose name contains the typed text. Ignores capitals and accents, like Find; an empty query keeps everything. */
export function filterProjects<T extends { name: string }>(projects: T[], query: string): T[] {
  const q = fold(query.trim());
  return q ? projects.filter((p) => fold(p.name).includes(q)) : projects;
}
