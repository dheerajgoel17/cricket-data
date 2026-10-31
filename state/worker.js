// The match-state writer, as a Cloudflare Worker on a one-minute Cron Trigger (GitHub's own cron slips by minutes and cannot be relied on). Each run reads the live feed with the
// same code the site uses (site/packages/engine/feed.js) and writes the match-state table through apply_match_state (site/packages/engine/state-sync.js).
// Worker secrets (never in this file): LIVE_SOURCE_BASE, SUPABASE_URL, SUPABASE_ANON_KEY (the public key) and STATE_WRITE_TOKEN (a random token; the database stores only its hash).
import { createFeed } from "../site/packages/engine/feed.js";
import { NO_IDENTITY } from "../site/packages/engine/identity.js";
import { syncState } from "../site/packages/engine/state-sync.js";

const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
const HTML_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_MS = 8000;

const get = (ua, accept) => async (url, as) => {
  const r = await fetch(url, { headers: { "user-agent": ua, accept }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return as === "json" ? r.json() : r.text();
};
const json = get(UA, "application/json"), text = get(UA, "*/*"), html = get(HTML_UA, "text/html");

export async function run(env) {
  for (const k of ["LIVE_SOURCE_BASE", "SUPABASE_URL", "SUPABASE_ANON_KEY", "STATE_WRITE_TOKEN"]) if (!env?.[k]) throw new Error(`${k} is not set`);
  const base = String(env.LIVE_SOURCE_BASE).replace(/\/+$/, "");
  const feed = createFeed({ base: () => base, getJson: (u) => json(u, "json"), getText: (u) => text(u), getHtml: (u) => html(u), loadIdentity: async () => NO_IDENTITY });
  const { matches } = await feed.snapshot();
  return syncState({ matches, base: String(env.SUPABASE_URL).replace(/\/+$/, ""), key: env.SUPABASE_ANON_KEY, token: env.STATE_WRITE_TOKEN });
}

/** Constant-time string compare (the manual trigger below is guarded by the write token). */
const same = (a, b) => {
  const enc = new TextEncoder(), x = enc.encode(String(a)), y = enc.encode(String(b));
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
};

export default {
  /** By hand: GET with the header x-state-key equal to the write token runs one sync now and says what happened (for checking and for an uptime monitor). Anything else is a 404. */
  async fetch(request, env) {
    if (!env?.STATE_WRITE_TOKEN || !same(request.headers.get("x-state-key") || "", env.STATE_WRITE_TOKEN)) return new Response("not found", { status: 404 });
    const t0 = Date.now();
    try { return Response.json({ ok: true, ms: Date.now() - t0, ...(await run(env)) }); }
    catch (e) { return Response.json({ ok: false, ms: Date.now() - t0, error: String(e.message || e).slice(0, 160) }, { status: 500 }); }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env).then((out) => console.log(JSON.stringify({ ok: true, ...out })), (e) => { console.error(`match-state run failed: ${String(e.message || e).slice(0, 120)}`); throw e; }));
  },
};
