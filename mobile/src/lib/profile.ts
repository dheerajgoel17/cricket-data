/* eslint-disable @typescript-eslint/no-explicit-any */
// A player's profile line from the site's `profiles.json` (PROJECT_GUIDE 5.9): `{ l: { r, b, w: code -> label }, p: { player id: { r?, b?, w? } } }`, role / batting hand / bowling style. A field the
// source did not give is simply missing there (never guessed), and so is left out of the line: "Batter · LHB", "All-rounder · RHB · Off-spin", or nothing at all.

/** The parts of the profile line, in the order shown: the role (its label), the hand (its code: RHB, LHB), the bowling style (its label). Empty when the player has no profile. */
export function profileParts(doc: any, pid: string | undefined | null): string[] {
  const p = pid ? doc?.p?.[pid] : null;
  if (!p) return [];
  const l = doc?.l || {};
  const parts: string[] = [];
  if (p.r) parts.push(l.r?.[p.r] || p.r);
  if (p.b) parts.push(p.b);
  if (p.w) parts.push(l.w?.[p.w] || p.w);
  return parts;
}
