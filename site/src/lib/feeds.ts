/* eslint-disable @typescript-eslint/no-explicit-any */
// Bookmaker lines and value bets: the live file from GitHub (hourly), else the copy bundled with the site build.
const RAW = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out";

async function bundled(file: string): Promise<any | null> { try { return await (await fetch(`/data/${file}`)).json(); } catch { return null; } }
async function live(file: string, ms: number): Promise<any | null> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(`${RAW}/${file}`, { cache: "no-cache", signal: ctl.signal }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
}

export async function loadLines(): Promise<any> {
  let doc = await bundled("lines.json");
  const d = await live("book_lines.json", 3500);
  if (d && (!doc || (d.generated_at_utc || "") >= (doc.generated_at_utc || ""))) doc = { ...d, events: d.events ?? doc?.events ?? [], fancy: d.fancy ?? doc?.fancy ?? [] }; // a live file from before `events` / `fancy` existed keeps the bundled lists
  return doc || { lines: [], events: [], fancy: [] };
}

export async function loadProps(): Promise<{ snap: any | null; live: boolean }> {
  let snap = await bundled("props.json"), isLive = false;
  const d = await live("value_bets_latest.json", 6000);
  if (d && (!snap || (d.generated_at_utc || "") >= (snap.generated_at_utc || ""))) { snap = { ...snap, ...d, value_bets: d.value_bets, recent_alerts: snap?.recent_alerts || [] }; isLive = true; }
  return { snap, live: isLive };
}

/** The engine's question parser + the optional LLM route (api/ask only turns the question into a validated plan). */
export async function askApi(question: string): Promise<any | null> {
  try { const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) }); return r.ok ? await r.json() : null; } catch { return null; }
}

/** Live scores + player so-far from /api/live (Source A schedule, match and scorecard pages, ~15 s). Null if the route is down. */
export async function loadLive(): Promise<any | null> {
  try {
    const r = await fetch("/api/live", { headers: { accept: "application/json" } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
