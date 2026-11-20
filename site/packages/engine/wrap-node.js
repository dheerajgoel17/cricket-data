// The same XOR-SHA256 wrap as wrap.js, for the Node functions only (api/live, api/inplay, api/state): one synchronous SHA-256 per block from node:crypto and Buffers, not one
// awaited Web Crypto digest per 32 bytes. The output is byte-for-byte what `wrap` gives for the same iv, so every browser and app reads it with `unwrap` as before; only the
// server's CPU differs (a 200 KB /api/live body: ~7 ms here, ~40-75 ms with wrap.js). The browser and the Cloudflare Worker keep wrap.js (no node:crypto there).
import crypto from "node:crypto";

export function wrapSync(obj, secret, ivBytes) {
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = Buffer.from(ivBytes || crypto.randomBytes(16));
  const raw = Buffer.from(JSON.stringify(obj));
  const out = Buffer.allocUnsafe(raw.length);
  const ctr = Buffer.alloc(4);
  for (let i = 0, off = 0; off < raw.length; i++, off += 32) {
    ctr.writeUInt32BE(i);
    const h = crypto.createHash("sha256").update(key).update(iv).update(ctr).digest();
    const n = Math.min(32, raw.length - off);
    for (let k = 0; k < n; k++) out[off + k] = raw[off + k] ^ h[k];
  }
  return { v: 1, iv: iv.toString("base64"), ct: out.toString("base64") };
}

/** `wire` for the Node functions: wrap when a key is set, else leave the object as JSON (local builds, tests). */
export function wireSync(obj, secret) {
  const s = String(secret || "").trim();
  return s ? wrapSync(obj, s) : obj;
}
