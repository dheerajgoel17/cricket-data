// A small on-device error log: the last 50 caught errors (screen crashes from the route error boundary), kept in storage so a build with no console can still tell what happened.
// No network, no account, nothing leaves the phone. Read it with `readErrors()` (dev tools or a future "Report a problem" action).
const KEY = "error-log";
const KEEP = 50;

export function readErrors(): string[] {
  try {
    const { raw } = require("./storage") as typeof import("./storage");
    return (raw.get(KEY) ?? "").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function logError(where: string, e: unknown): void {
  try {
    const { raw } = require("./storage") as typeof import("./storage");
    const msg = (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).replace(/\s+/g, " ").slice(0, 300);
    raw.set(KEY, [...readErrors(), `${new Date().toISOString()} ${where} ${msg}`].slice(-KEEP).join("\n"));
  } catch { /* storage not ready: the log is best effort */ }
}
