import { track as send } from "@vercel/analytics";

/** A named event with a few small string or number properties (what was tapped, never who). The page views are counted by the analytics script itself; a failure here never reaches the page. */
export function track(name: string, props?: Record<string, string | number>) {
  try { send(name, props); } catch { /* blocked or offline: nothing to do */ }
}

let sent = 0;
/** A page error counted by kind (`error_chunk` a script gone after a deploy, `error_render` a page that threw, `error_script` / `error_promise` anything else): the kind is in the event's name so the totals read on the free plan. At most five a page load, so a loop cannot flood it. */
export function reportError(kind: "chunk" | "render" | "script" | "promise", e?: unknown) {
  if (sent >= 5) return;
  sent += 1;
  const msg = String((e as { message?: string } | undefined)?.message ?? e ?? "").replace(/\s+/g, " ").slice(0, 120);
  track(`error_${kind}`, { page: location.pathname.split("/").slice(0, 2).join("/"), msg });
}
