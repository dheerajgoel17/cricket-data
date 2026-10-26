// Prop Hunter snapshot: the bundled file plus the hourly GitHub feed.
// One in-flight request is shared by the home rail and the Prop Hunter page, and the
// result is reused for `ttl` ms. After that the GitHub file is revalidated (cache: "no-cache"),
// which matches an hourly pipeline without refetching on every navigation.
export const PROPS_RAW = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/value_bets_latest.json";
export const PROPS_TTL = 5 * 60 * 1000;

export function createPropsFeed({ fetchImpl = globalThis.fetch, now = () => Date.now(), ttl = PROPS_TTL, raw = PROPS_RAW, base = "data/props.json" } = {}) {
  let mem = null;
  let at = 0;
  let flight = null;

  async function load() {
    if (mem && now() - at < ttl) return mem;
    if (flight) return flight;
    flight = (async () => {
      let snap = null;
      let live = false;
      try {
        const r = await fetchImpl(base);
        if (r?.ok) snap = await r.json();
      } catch { /* bundled file missing */ }
      try {
        const r = await fetchImpl(raw, { cache: "no-cache" });
        if (r?.ok) {
          const d = await r.json();
          if (!snap || (d.generated_at_utc || "") >= (snap.generated_at_utc || "")) {
            snap = { ...snap, ...d, value_bets: d.value_bets, recent_alerts: snap?.recent_alerts || d.recent_alerts || [] };
            live = true;
          }
        }
      } catch { /* offline or blocked: bundled snapshot */ }
      mem = { snap, live };
      at = now();
      return mem;
    })();
    try { return await flight; } finally { flight = null; }
  }

  return {
    load,
    peek() { return mem && now() - at < ttl ? mem : null; },
  };
}
