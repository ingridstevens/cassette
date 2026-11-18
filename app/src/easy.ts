import type { Options } from "./types";

/** Easy mode (#110): fewer buttons. The only exports it offers: the Word document and Print / PDF. Everything else is back when Easy mode is off. */
export const EASY_FORMATS: readonly string[] = ["docx", "print"];

/** Easy mode is off unless the user turned it on. */
export const isEasy = (o: Pick<Options, "easy">): boolean => o.easy === true;

/** The first-run choice is offered once: while nothing has been chosen yet and there are no projects (so people who already use the app are not asked). */
export const shouldAskEasy = (o: Pick<Options, "easy">, projectCount: number): boolean => o.easy === undefined && projectCount === 0;

/** Keeps the formats Easy mode offers, in their order; all of them when Easy mode is off. */
export function formatsFor<T extends readonly [string, ...unknown[]]>(formats: readonly T[], easy: boolean): T[] {
  return easy ? formats.filter((f) => EASY_FORMATS.includes(f[0])) : [...formats];
}
