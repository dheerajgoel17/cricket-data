// Start-up timing marks for the dev loop: `EXPO_PUBLIC_PERF=1` prints `[perf] <name> <ms since the JS bundle started>` once per name, and a watchdog reports how long the JS thread was
// blocked (a timer that fires late means a frame or more was lost). Off by default; costs nothing then.
const ON = process.env.EXPO_PUBLIC_PERF === "1";
const t0 = Date.now();
const seen = new Set<string>();

// A release build prints nothing anywhere readable, so with the flag on every line is also kept in storage (`perf-log`, read back from the simulator's app data); flushed at most once a second.
const lines: string[] = [];
let flushing = false;
function log(line: string): void {
  console.log(line);
  lines.push(line);
  if (flushing) return;
  flushing = true;
  setTimeout(() => { flushing = false; try { (require("./storage") as typeof import("./storage")).raw.set("perf-log", lines.slice(-600).join("\n")); } catch { /* storage not ready */ } }, 1000);
}

export function mark(name: string, extra?: string): void {
  if (!ON || seen.has(name)) return;
  seen.add(name);
  log(`[perf] ${name} ${Date.now() - t0}${extra ? ` ${extra}` : ""}`);
}

/** React commits that took 12 ms or more (`<Profiler onRender={onRender}>`; render time of the subtree, including its children). */
export function onRender(id: string, phase: string, actual: number): void {
  if (ON && actual >= 12) log(`[perf-render] ${id} ${phase} ${Math.round(actual)}ms at ${Date.now() - t0}`);
}
export const PROFILE = ON;

/** Runs `fn`, reporting it when it took 15 ms or more. */
export function timed<T>(name: string, fn: () => T): T {
  if (!ON) return fn();
  const t = Date.now();
  const v = fn();
  if (Date.now() - t >= 15) span(name, t);
  return v;
}

/** Every duration worth reporting (a network read, an unwrap), not once per name. */
export function span(name: string, since: number, extra?: string): void {
  if (ON && !name.startsWith("gate ")) log(`[perf-span] ${name} ${Date.now() - since}ms at ${Date.now() - t0}${extra ? ` ${extra}` : ""}`);
}

if (ON) {
  log(`[perf-epoch] ${t0}`);
  let last = Date.now(), worst = 0, total = 0, long = 0;
  setInterval(() => {
    const now = Date.now(), late = now - last - 100;
    last = now;
    if (late > 32) { total += late; long++; if (late > worst) worst = late; if (late > 100) log(`[perf-stall] ${late}ms at ${now - t0}`); }
  }, 100);
  setInterval(() => log(`[perf-jank] t=${Date.now() - t0} stalls>32ms=${long} stalledMs=${total} worst=${worst}`), 5000);
}
