// The app's way into the site's gated data: ask /api/gate for the cookie and the unwrap key, send the cookie by hand (a native client has no browser cookie jar to lean on), unwrap what comes back.
import { isWrapped } from "@cricket/engine/wrap.js";
import { cacheGet, cachePut, cacheRetag, cacheTag } from "@/lib/body-cache";
import { unwrapText } from "@/lib/unwrap-fast";
import { SITE_URL, USER_AGENT } from "@/lib/config";
import { span } from "@/lib/perf";

let key: string | undefined;
let cookie: string | undefined;
let pending: Promise<string | undefined> | null = null;
let dataTag: string | undefined;

/**
 * The stats files that only change together, when the data is rebuilt (`meta.json` says which build is current). Once the app knows the build (`setDataBuild`), a kept copy that was
 * checked against the same build is used as it is, with no request; any other build, or a file never kept, is asked for as usual.
 */
const PINNED = /^\/data\/(?:index|matches|identity|names|p\/\d+)\.json$/;
export function setDataBuild(tag: string | undefined): void { dataTag = tag; }

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

/**
 * A data file or API route (`/data/fixtures.json`, `/api/live`) as JSON, unwrapped. Throws on a failed request. The decoded text is kept with the response's ETag and asked for again with
 * `If-None-Match`: a 304 means the kept copy is current (`lib/body-cache.ts`).
 */
export async function getJson(path: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const t0 = Date.now();
  if (!key) await gateKey();
  span(`gate ${path}`, t0);
  const kept = cacheGet(path);
  const pinned = !!dataTag && PINNED.test(path);
  if (kept && pinned && cacheTag(path) === dataTag) { const o = JSON.parse(kept.text); span(`get ${path} pinned`, t0, `chars=${kept.text.length}`); return o; }
  const ask = () => fetch(SITE_URL + path, { headers: { ...headers(), ...(kept ? { "if-none-match": kept.etag } : {}) }, credentials: "omit" });
  let r = await ask();
  if (r.status === 403) { await gateKey(true); r = await ask(); } // the cookie lapsed
  const t1 = Date.now();
  if (r.status === 304 && kept) { if (pinned) cacheRetag(path, dataTag!); const o = JSON.parse(kept.text); span(`get ${path} 304 parse`, t1, `net=${t1 - t0}ms chars=${kept.text.length}`); return o; }
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const text = await r.text();
  const t2 = Date.now();
  const doc = JSON.parse(text);
  let body = text, out = doc;
  if (isWrapped(doc)) {
    const k = await gateKey();
    if (!k) throw new Error(`${path}: no unwrap key`); // the gate gave no key: do not hand a wrapped body to the screens
    const t3 = Date.now();
    body = await unwrapText(doc, k);
    const t4 = Date.now();
    out = JSON.parse(body);
    span(`get ${path} 200 wrapped`, t0, `net=${t1 - t0}ms body=${t2 - t1}ms unwrap=${t4 - t3}ms parse=${Date.now() - t4}ms chars=${body.length}`);
  } else span(`get ${path} 200 plain`, t0, `net=${t1 - t0}ms body=${t2 - t1}ms parse=${Date.now() - t2}ms chars=${body.length}`);
  const etag = r.headers.get("etag");
  if (etag) cachePut(path, etag, body, pinned ? dataTag : undefined);
  return out;
}
