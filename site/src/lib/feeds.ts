/* eslint-disable @typescript-eslint/no-explicit-any */
// Bookmaker lines and value bets: the live file from GitHub (hourly), else the copy bundled with the site build.
import { isFixtureId } from "@/engine/lines.js";
import { saveLive } from "@/lib/live-cache";

const RAW = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out";
const CONFIG = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/config";
const ARCHIVE = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/archive";

async function bundled(file: string): Promise<any | null> { try { return await (await fetch(`/data/${file}`)).json(); } catch { return null; } }
async function live(file: string, ms: number): Promise<any | null> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(`${RAW}/${file}`, { cache: "no-cache", signal: ctl.signal }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
}

/** The live book file is a faster-than-the-hour refresh of the bundled copy, never a requirement: past this it is given up on and the page goes with the bundle. */
export const LINES_LIVE_MS = 1500;

/** The newer of the bundled lines file and the live one (a tie goes to the live one); a live file from before `events` / `fancy` existed keeps the bundled lists. */
export function newerLines(bundle: any | null, fresh: any | null): any {
  if (fresh && (!bundle || (fresh.generated_at_utc || "") >= (bundle.generated_at_utc || ""))) return { ...fresh, events: fresh.events ?? bundle?.events ?? [], fancy: fresh.fancy ?? bundle?.fancy ?? [] };
  return bundle || { lines: [], events: [], fancy: [] };
}

/** Both files are fetched at once (the page waits for the slower of the two, at most LINES_LIVE_MS for the live one), not the live one after the bundle. */
export async function loadLines(): Promise<any> {
  const [bundle, fresh] = await Promise.all([bundled("lines.json"), live("book_lines.json", LINES_LIVE_MS)]);
  return newerLines(bundle, fresh);
}

/** The home rail's published settings (config/home_rail.json, read at view time so a change needs no deploy); null when it cannot be read, and the built-in ones apply. */
export async function loadRail(): Promise<any | null> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3500);
  try { const r = await fetch(`${CONFIG}/home_rail.json`, { cache: "no-cache", signal: ctl.signal }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
}

/** One match's permanent archive file (every line the books priced for it, never deleted), by fixture id; null if there is none. */
export async function loadArchive(id: string): Promise<any | null> {
  if (!isFixtureId(id)) return null;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  try { const r = await fetch(`${ARCHIVE}/${id.slice(0, 7)}/${id}.json`, { signal: ctl.signal }); const d = r.ok ? await r.json() : null; return d?.id === id ? d : null; } catch { return null; } finally { clearTimeout(t); }
}

export async function loadProps(): Promise<{ snap: any | null; live: boolean }> {
  let snap = await bundled("props.json"), isLive = false;
  const d = await live("value_bets_latest.json", 6000);
  if (d && (!snap || (d.generated_at_utc || "") >= (snap.generated_at_utc || ""))) { snap = { ...snap, ...d, value_bets: d.value_bets, recent_alerts: snap?.recent_alerts || [] }; isLive = true; }
  return { snap, live: isLive };
}


/** Live scores + player so-far from /api/live (Source A schedule, match and scorecard pages, ~15 s). Null if the route is down. */
export async function loadLive(): Promise<any | null> {
  try {
    const r = await fetch("/api/live", { headers: { accept: "application/json" } });
    const body = r.ok ? await r.json() : null;
    saveLive(body);
    return body;
  } catch { return null; }
}
