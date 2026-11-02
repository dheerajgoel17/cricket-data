// The shared engine (`@cricket/engine/wrap.js`) unwraps the gated data files with `TextDecoder` and `crypto.subtle.digest`; Hermes has neither.
import { sha256 } from "@noble/hashes/sha2.js";

type Bytes = ArrayBuffer | ArrayBufferView;

const toBytes = (b: Bytes | undefined): Uint8Array =>
  !b ? new Uint8Array(0) : b instanceof Uint8Array ? b : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b);

/** UTF-8 to string (the data files are valid UTF-8; a stray byte becomes U+FFFD). */
export function decodeUtf8(input?: Bytes): string {
  const b = toBytes(input);
  const units: number[] = [];
  let out = "";
  const cont = (i: number) => (b[i] & 0xc0) === 0x80;
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp = 0xfffd;
    if (c < 0x80) cp = c;
    else if (c >= 0xc2 && c < 0xe0 && cont(i)) cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
    else if (c >= 0xe0 && c < 0xf0 && cont(i) && cont(i + 1)) cp = ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    else if (c >= 0xf0 && c < 0xf5 && cont(i) && cont(i + 1) && cont(i + 2)) cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    if (cp > 0xffff) { cp -= 0x10000; units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); } else units.push(cp);
    if (units.length >= 4096) { out += String.fromCharCode.apply(null, units); units.length = 0; }
  }
  return out + String.fromCharCode.apply(null, units);
}

// The unwrap awaits one digest per 32-byte block, thousands in a row. Hashing is synchronous, so left alone a big file holds the main thread for hundreds of milliseconds; after
// FRAME_MS of work the digest hands the thread back for a turn so touches and scrolls stay at 60 fps.
const FRAME_MS = 8;
let sliceStart = Date.now();

/** `crypto.subtle.digest("SHA-256", data)`: the only call the unwrap makes. Synchronous inside, so thousands of small blocks do not each cross into native code. */
export async function digest(algorithm: string | { name: string }, data: Bytes): Promise<ArrayBuffer> {
  const name = typeof algorithm === "string" ? algorithm : algorithm.name;
  if (name.toUpperCase() !== "SHA-256") throw new Error(`digest: ${name} is not supported`);
  if (Date.now() - sliceStart >= FRAME_MS) { await new Promise<void>((r) => setTimeout(r, 0)); sliceStart = Date.now(); }
  const h = sha256(toBytes(data));
  return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength) as ArrayBuffer;
}

export function installPolyfills(g: Record<string, any> = globalThis as any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof g.TextDecoder === "undefined") {
    g.TextDecoder = class { decode(input?: Bytes) { return decodeUtf8(input); } };
  }
  if (!g.crypto?.subtle) g.crypto = Object.assign(g.crypto ?? {}, { subtle: { digest } });
}

installPolyfills();
