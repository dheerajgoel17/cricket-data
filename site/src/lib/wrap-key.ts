// Wrap key for the small JSON files and /api/live. Comes from /api/gate as the X-Cd-K header (never from the JS bundle).
import { isWrapped, unwrap } from "@cricket/engine/wrap.js";

let key: string | undefined;

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
    const r = await fetch("/api/gate", { credentials: "same-origin", cache: "no-store" });
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
  const secret = isWrapped(doc) ? await gateKey() : key;
  return unwrap(doc, secret);
}
