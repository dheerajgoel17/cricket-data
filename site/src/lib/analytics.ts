import { track as send } from "@vercel/analytics";

/** A named event with a few small string or number properties (what was tapped, never who). The page views are counted by the analytics script itself; a failure here never reaches the page. */
export function track(name: string, props?: Record<string, string | number>) {
  try { send(name, props); } catch { /* blocked or offline: nothing to do */ }
}
