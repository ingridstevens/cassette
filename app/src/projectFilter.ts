import { fold } from "./find";

/** The sidebar shows a filter field once the list is longer than this. */
export const FILTER_MIN = 8;

/** Projects whose name contains what was typed. Accents and capitals are ignored ("lucia" finds "Lucía"); nothing typed keeps every project. */
export function filterProjects<T extends { name: string }>(projects: T[], query: string): T[] {
  const q = fold(query.trim());
  return q ? projects.filter((p) => fold(p.name).includes(q)) : projects;
}
