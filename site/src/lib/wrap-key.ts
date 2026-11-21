// Wrap key for the small JSON files and /api/live. Comes from /api/gate as the X-Cd-K header (never from the JS bundle).
import { isWrapped, unwrap } from "@cricket/engine/wrap.js";

let key: string | undefined;
let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: () => void }>();

function offThread(doc: unknown, secret: string): Promise<unknown> {
  if (!worker) {
    worker = new Worker(new URL("./unwrap.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      pending.delete(data.id);
      if (data.failed) request?.reject();
      else request?.resolve(data.value);
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = undefined;
      for (const request of pending.values()) request.reject();
      pending.clear();
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try { worker?.postMessage({ id, doc, secret }); }
    catch (e) { pending.delete(id); reject(e); }
  });
}

export function setWrapKey(v?: string) {
  key = v || undefined;
}

export function getWrapKey() {
  return key;
}

/** The gate cookie plus the wrap key. Safe to call more than once; the key is kept for later unwraps. */
export async function gateKey(): Promise<string | undefined> {
  if (key) return key;
  try {
    // the page's head already asked (`scripts/data-manifest.mjs` `headScript`): use that answer once, ask again only if it failed
    const early = typeof window !== "undefined" ? window.__gate : undefined;
    if (typeof window !== "undefined") window.__gate = undefined;
    const r = (early && (await early)) || (await fetch("/api/gate", { credentials: "same-origin", cache: "no-store" }));
    if (!r.ok) return undefined;
    const body = await r.json().catch(() => ({} as { k?: string }));
    key = r.headers.get("x-cd-k") || body.k || undefined;
    return key;
  } catch {
    return undefined;
  }
}

/** JSON from a same-origin fetch: unwrap when the body is `{v,iv,ct}`. */
export async function readJson(r: Response): Promise<unknown> {
  const doc = await r.json();
  if (!isWrapped(doc)) return doc;
  const secret = await gateKey();
  if (!secret || typeof Worker === "undefined") return unwrap(doc, secret);
  try { return await offThread(doc, secret); }
  catch { return unwrap(doc, secret); }
}
