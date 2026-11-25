// The app's way into the site's gated data: ask /api/gate for the cookie and the unwrap key, send the cookie by hand (a native client has no browser cookie jar to lean on), unwrap what comes back.
import { Platform } from "react-native";
import { isWrapped } from "@cricket/engine/wrap.js";
import { cacheAge, cacheGet, cachePut, cacheTag, cacheTouch } from "@/lib/body-cache";
import { unwrapText } from "@/lib/unwrap-fast";
import { SITE_URL, USER_AGENT } from "@/lib/config";
import { span } from "@/lib/perf";

/** Let the UI paint before a multi-MB JSON.parse on Hermes. */
const beforeBigParse = async (chars: number) => {
  if (Platform.OS === "android" && chars > 200_000) await new Promise<void>((r) => setTimeout(r, 16));
};

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

/**
 * The live routes are polled every ~3 s and answer `max-age=3`: the phone's own HTTP cache then hands back the same body for as long as the poll lands inside that window (every poll came back from it
 * in 1-7 ms with the same ciphertext, so a score and a match that had left the live feed stayed on screen). A `no-cache` request header makes it ask the server; the server's shared cache still answers.
 */
const headers = (path = "") => ({ "user-agent": USER_AGENT, accept: "application/json", ...(path.startsWith("/api/") ? { "cache-control": "no-cache" } : {}), ...(cookie ? { cookie } : {}) });

/** Same object identity for an unchanged body: a 304 / same ciphertext must not allocate a new parse, or every 15 s live poll re-renders the rail. */
const memo = new Map<string, { mark: string; obj: any; text?: string }>(); // eslint-disable-line @typescript-eslint/no-explicit-any
/**
 * The decoded text is kept beside its object (small files only) so a response that decodes to the very same text hands back the very same object. A wrapped file gets a new ETag and
 * a new ciphertext on every deploy even when nothing in it changed; without this the kept copy Home painted from is replaced by an equal one a second later and everything re-renders.
 */
const KEEP_TEXT = 1_500_000;
const textOf = (text: string) => (text.length <= KEEP_TEXT ? text : undefined);
function reuse(path: string, mark: string, text: string): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const hit = memo.get(path);
  if (hit && hit.mark === mark) return hit.obj;
  const obj = hit && hit.text === text ? hit.obj : JSON.parse(text);
  memo.set(path, { mark, obj, text: textOf(text) });
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
    await beforeBigParse(kept.text.length);
    const o = reuse(path, `etag:${kept.etag}`, kept.text);
    span(`get ${path} pinned`, t0, `chars=${kept.text.length}`);
    return o;
  }
  const ask = () => fetch(SITE_URL + path, { headers: { ...headers(path), ...(kept ? { "if-none-match": kept.etag } : {}) }, credentials: "omit" });
  let r = await ask();
  if (r.status === 403) { await gateKey(true); r = await ask(); } // the cookie lapsed
  const t1 = Date.now();
  if (r.status === 304 && kept) {
    cacheTouch(path, pinned ? dataTag : undefined);
    await beforeBigParse(kept.text.length);
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
    const was = memo.get(path); // read after the unwrap: another response may have landed while it ran
    const same = !!was && was.text === body;
    out = same ? was!.obj : JSON.parse(body);
    memo.set(path, { mark: ctMark, obj: out, text: textOf(body) });
    span(`get ${path} 200 wrapped${same ? " same" : ""}`, t0, `net=${t1 - t0}ms body=${t2 - t1}ms unwrap=${t4 - t3}ms parse=${Date.now() - t4}ms chars=${body.length}`);
  } else {
    // Mark by ETag (or the full body) — never by length: `{"v":1}` and `{"v":2}` are the same size.
    const mark = etag ? `etag:${etag}` : `body:${body}`;
    const hit = memo.get(path);
    out = hit && (hit.mark === mark || hit.text === body) ? hit.obj : doc;
    memo.set(path, { mark, obj: out, text: textOf(body) });
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
