// The app's unwrap for the gated data files: the same XOR-SHA256 stream as `@cricket/engine/wrap.js`, without its cost. The engine hashes `key(32) | iv(16) | counter(4)` once per 32 bytes of
// body through `crypto.subtle.digest`, one promise and several allocations per block, which on a phone is seconds for a few hundred KB. That input is 52 bytes, so each keystream block is ONE
// SHA-256 compression of a block that is the same except for four counter bytes. Here the 15 words that do not change are set once, the compression runs on preallocated arrays with no
// allocation, and the loop hands the thread back for a turn after every `SLICE_MS` so touches and scrolls never wait on a file.
import { sha256 } from "@noble/hashes/sha2.js";
import { decodeUtf8 } from "@/lib/polyfills";

const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const H0 = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

const W = new Int32Array(64);
const M = new Int32Array(16); // the message block: words 0-12 are key | iv | counter; word 13 is 0x80 padding after the 52 bytes; 14-15 the bit length (416)

/** One keystream block: SHA-256 of the prepared 52-byte message with `ctr` in word 12, as 8 big-endian words into `out`. */
function block(ctr: number, out: Int32Array): void {
  M[12] = ctr | 0;
  for (let i = 0; i < 16; i++) W[i] = M[i];
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15], b = W[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = H0[0], b = H0[1], c = H0[2], d = H0[3], e = H0[4], f = H0[5], g = H0[6], h = H0[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  out[0] = (H0[0] + a) | 0; out[1] = (H0[1] + b) | 0; out[2] = (H0[2] + c) | 0; out[3] = (H0[3] + d) | 0;
  out[4] = (H0[4] + e) | 0; out[5] = (H0[5] + f) | 0; out[6] = (H0[6] + g) | 0; out[7] = (H0[7] + h) | 0;
}

const SLICE_MS = 8;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const B64 = new Uint8Array(128).fill(255);
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("").forEach((c, i) => { B64[c.charCodeAt(0)] = i; });

/** Base64 to bytes without `atob` and a string of the whole file in between. */
function b64decode(s: string): Uint8Array {
  let n = s.length;
  while (n > 0 && s.charCodeAt(n - 1) === 61) n--; // "="
  const out = new Uint8Array(Math.floor((n * 3) / 4));
  let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < n; i++) {
    acc = (acc << 6) | B64[s.charCodeAt(i) & 127];
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; }
  }
  return out;
}

const word = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) | 0;

/** The decoded text of a wrapped body (`{ v: 1, iv, ct }`) for `secret`; the XOR-SHA256 stream of `@cricket/engine/wrap.js`, byte for byte. */
export async function unwrapText(doc: { iv: string; ct: string }, secret: string): Promise<string> {
  const key = sha256(new TextEncoder().encode(secret));
  const iv = b64decode(doc.iv), ct = b64decode(doc.ct);
  for (let i = 0; i < 8; i++) M[i] = word(key, i * 4);
  for (let i = 0; i < 4; i++) M[8 + i] = word(iv, i * 4);
  M[13] = 0x80000000 | 0; M[14] = 0; M[15] = 52 * 8;
  const ks = new Int32Array(8);
  const raw = ct; // decoded in place
  const n = raw.length, blocks = Math.ceil(n / 32);
  let t = Date.now();
  for (let bi = 0; bi < blocks; bi++) {
    block(bi, ks);
    const off = bi * 32, end = Math.min(32, n - off);
    for (let j = 0; j < end; j++) raw[off + j] ^= (ks[j >> 2] >>> (24 - 8 * (j & 3))) & 255;
    if ((bi & 63) === 63 && Date.now() - t >= SLICE_MS) { await tick(); t = Date.now(); }
  }
  return decodeUtf8(raw);
}
