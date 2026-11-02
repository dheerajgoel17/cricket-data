// The app's way into the site's gated data: ask /api/gate for the cookie and the unwrap key, send the cookie by hand (a native client has no browser cookie jar to lean on), unwrap what comes back.
import { isWrapped, unwrap } from "@cricket/engine/wrap.js";
import { SITE_URL, USER_AGENT } from "@/lib/config";

let key: string | undefined;
let cookie: string | undefined;
let pending: Promise<string | undefined> | null = null;

const headers = () => ({ "user-agent": USER_AGENT, accept: "application/json", ...(cookie ? { cookie } : {}) });

/** The unwrap key, fetched once (`force` asks again after the 12-hour cookie has lapsed). */
export function gateKey(force = false): Promise<string | undefined> {
  if (key && !force) return Promise.resolve(key);
  pending ??= (async () => {
    try {
      const r = await fetch(`${SITE_URL}/api/gate`, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, credentials: "omit" });
      if (!r.ok) return undefined;
      cookie = /(?:^|[\s,;])(cdg=[^;,\s]+)/.exec(r.headers.get("set-cookie") ?? "")?.[1] ?? cookie;
      key = r.headers.get("x-cd-k") ?? key;
      return key;
    } catch { return undefined; } finally { pending = null; }
  })();
  return pending;
}

/** A data file or API route (`/data/fixtures.json`, `/api/live`) as JSON, unwrapped. Throws on a failed request. */
export async function getJson(path: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!key) await gateKey();
  let r = await fetch(SITE_URL + path, { headers: headers(), credentials: "omit" });
  if (r.status === 403) { await gateKey(true); r = await fetch(SITE_URL + path, { headers: headers(), credentials: "omit" }); } // the cookie lapsed
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const doc = await r.json();
  const out = await unwrap(doc, isWrapped(doc) ? await gateKey() : key);
  if (isWrapped(out)) throw new Error(`${path}: no unwrap key`); // the gate gave no key: do not hand a wrapped body to the screens
  return out;
}
