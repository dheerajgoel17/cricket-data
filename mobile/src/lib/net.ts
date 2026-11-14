// The app's way into the site's gated data: ask /api/gate for the cookie and the unwrap key, send the cookie by hand (a native client has no browser cookie jar to lean on), unwrap what comes back.
import { isWrapped } from "@cricket/engine/wrap.js";
import { cacheAge, cacheGet, cachePut, cacheTag, cacheTouch } from "@/lib/body-cache";
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

/** Same object identity for an unchanged body: a 304 / same ciphertext must not allocate a new parse, or every 15 s live poll re-renders the rail. */
const memo = new Map<string, { mark: string; obj: any }>(); // eslint-disable-line @typescript-eslint/no-explicit-any
function reuse(path: string, mark: string, text: string): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const hit = memo.get(path);
  if (hit && hit.mark === mark) return hit.obj;
  const obj = JSON.parse(text);
  memo.set(path, { mark, obj });
  return obj;
}

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
 * `If-None-Match`: a 304 means the kept copy is current (`lib/body-cache.ts`). Wrapped bodies whose ciphertext matches the last one skip the unwrap and return the same object.
 */
export async function getJson(path: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const t0 = Date.now();
  if (!key) await gateKey();
  span(`gate ${path}`, t0);
  const kept = cacheGet(path);
  const pinned = !!dataTag && PINNED.test(path);
  if (kept && pinned && cacheTag(path) === dataTag) {
    const o = reuse(path, `etag:${kept.etag}`, kept.text);
    span(`get ${path} pinned`, t0, `chars=${kept.text.length}`);
    return o;
  }
  const ask = () => fetch(SITE_URL + path, { headers: { ...headers(), ...(kept ? { "if-none-match": kept.etag } : {}) }, credentials: "omit" });
  let r = await ask();
  if (r.status === 403) { await gateKey(true); r = await ask(); } // the cookie lapsed
  const t1 = Date.now();
  if (r.status === 304 && kept) {
    cacheTouch(path, pinned ? dataTag : undefined);
    const o = reuse(path, `etag:${kept.etag}`, kept.text);
    span(`get ${path} 304 parse`, t1, `net=${t1 - t0}ms chars=${kept.text.length}`);
    return o;
  }
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const text = await r.text();
  const t2 = Date.now();
  const doc = JSON.parse(text);
  const etag = r.headers.get("etag");
  let body = text, out = doc;
  if (isWrapped(doc)) {
    const ctMark = `ct:${doc.ct}`;
    const hit = memo.get(path);
    if (hit && hit.mark === ctMark) {
      // Same ciphertext as last poll: skip unwrap (hundreds of ms on Hermes) and keep object identity so react-query subscribers do not re-render.
      if (etag && kept) cachePut(path, etag, kept.text, pinned ? dataTag : undefined);
      else if (kept) cacheTouch(path, pinned ? dataTag : undefined);
      span(`get ${path} 200 wrapped-fp`, t0, `net=${t1 - t0}ms body=${t2 - t1}ms`);
      return hit.obj;
    }
    const k = await gateKey();
    if (!k) throw new Error(`${path}: no unwrap key`); // the gate gave no key: do not hand a wrapped body to the screens
    const t3 = Date.now();
    body = await unwrapText(doc, k);
    const t4 = Date.now();
    out = JSON.parse(body);
    memo.set(path, { mark: ctMark, obj: out });
    span(`get ${path} 200 wrapped`, t0, `net=${t1 - t0}ms body=${t2 - t1}ms unwrap=${t4 - t3}ms parse=${Date.now() - t4}ms chars=${body.length}`);
  } else {
    // Mark by ETag (or the full body) — never by length: `{"v":1}` and `{"v":2}` are the same size.
    out = reuse(path, etag ? `etag:${etag}` : `body:${body}`, body);
    span(`get ${path} 200 plain`, t0, `net=${t1 - t0}ms body=${t2 - t1}ms parse=${Date.now() - t2}ms chars=${body.length}`);
  }
  if (etag) cachePut(path, etag, body, pinned ? dataTag : undefined);
  return out;
}

/**
 * The kept copy of a file if it was current within `maxAgeMs`, parsed, else undefined; no request. For a screen that paints from what the last launch saw while the real answer is
 * being asked for (react-query `initialData`, which marks it stale so it is asked for at once).
 */
export function peekJson(path: string, maxAgeMs: number): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (cacheAge(path) > maxAgeMs) return undefined;
  const kept = cacheGet(path);
  if (!kept) return undefined;
  try { return reuse(path, `etag:${kept.etag}`, kept.text); } catch { return undefined; }
}

/** Whether a kept copy of the file, current within `maxAgeMs`, is on the device. */
export const hasKept = (path: string, maxAgeMs: number): boolean => cacheAge(path) <= maxAgeMs;
