// Start-up timing marks for the dev loop: `EXPO_PUBLIC_PERF=1` prints `[perf] <name> <ms since the JS bundle started>` once per name, and a watchdog reports how long the JS thread was
// blocked (a timer that fires late means a frame or more was lost). Off by default; costs nothing then.
const ON = process.env.EXPO_PUBLIC_PERF === "1";
const t0 = Date.now();
const seen = new Set<string>();

export function mark(name: string, extra?: string): void {
  if (!ON || seen.has(name)) return;
  seen.add(name);
  console.log(`[perf] ${name} ${Date.now() - t0}${extra ? ` ${extra}` : ""}`);
}

/** Every duration worth reporting (a network read, an unwrap), not once per name. */
export function span(name: string, since: number, extra?: string): void {
  if (ON) console.log(`[perf-span] ${name} ${Date.now() - since}ms at ${Date.now() - t0}${extra ? ` ${extra}` : ""}`);
}

if (ON) {
  console.log(`[perf-epoch] ${t0}`);
  let last = Date.now(), worst = 0, total = 0, long = 0;
  setInterval(() => {
    const now = Date.now(), late = now - last - 100;
    last = now;
    if (late > 32) { total += late; long++; if (late > worst) worst = late; if (late > 100) console.log(`[perf-stall] ${late}ms at ${now - t0}`); }
  }, 100);
  setInterval(() => console.log(`[perf-jank] t=${Date.now() - t0} stalls>32ms=${long} stalledMs=${total} worst=${worst}`), 5000);
}
