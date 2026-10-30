// XOR-SHA256 unwrap for identity/index/fixtures JSON that assets_sync wrapped at deploy.
// The key comes from /api/gate, never from the JS bundle. Plain JSON (tests, local builds) is returned as-is.
const te = new TextEncoder();

async function sha256(buf) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

function b64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function stream(key, iv, n) {
  const out = new Uint8Array(n);
  let off = 0, i = 0;
  const ctr = new Uint8Array(4);
  while (off < n) {
    new DataView(ctr.buffer).setUint32(0, i);
    const block = new Uint8Array(key.length + iv.length + 4);
    block.set(key, 0); block.set(iv, key.length); block.set(ctr, key.length + iv.length);
    const h = await sha256(block);
    out.set(h.subarray(0, Math.min(32, n - off)), off);
    off += 32; i += 1;
  }
  return out;
}

export function isWrapped(doc) {
  return !!(doc && doc.v === 1 && doc.ct && doc.iv);
}

function b64enc(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export async function wrap(obj, secret, ivBytes) {
  const key = await sha256(te.encode(secret));
  const iv = ivBytes || crypto.getRandomValues(new Uint8Array(16));
  const raw = te.encode(JSON.stringify(obj));
  const ks = await stream(key, iv, raw.length);
  const ct = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) ct[i] = raw[i] ^ ks[i];
  return { v: 1, iv: b64enc(iv), ct: b64enc(ct) };
}

export async function unwrap(doc, secret) {
  if (!isWrapped(doc) || !secret) return doc;
  const key = await sha256(te.encode(secret));
  const iv = b64(doc.iv), ct = b64(doc.ct);
  const ks = await stream(key, iv, ct.length);
  const raw = new Uint8Array(ct.length);
  for (let i = 0; i < ct.length; i++) raw[i] = ct[i] ^ ks[i];
  return JSON.parse(new TextDecoder().decode(raw));
}
