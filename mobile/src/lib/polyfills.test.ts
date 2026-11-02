import { createHash } from "node:crypto";
import { TextDecoder as NodeTextDecoder } from "node:util";
import { unwrap } from "@cricket/engine/wrap.js";
import { decodeUtf8, digest } from "@/lib/polyfills";

const hex = (b: ArrayBuffer) => Buffer.from(b).toString("hex");
const node = new NodeTextDecoder();

describe("decodeUtf8", () => {
  test.each([
    "Abhishek Sharma",
    "Jayasuriya Ñoño Zürich",
    "日本語 मुंबई",
    "bat 🏏 😀 ball",
    "x".repeat(9000) + "é" + "y".repeat(5000),
  ])("matches the platform decoder for %#", (s) => {
    const bytes = new Uint8Array(Buffer.from(s, "utf8"));
    expect(decodeUtf8(bytes)).toBe(node.decode(bytes));
    expect(decodeUtf8(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).toBe(s);
  });

  test("a stray byte becomes the replacement character", () => {
    expect(decodeUtf8(new Uint8Array([0x61, 0xff, 0x62]))).toBe("a�b");
    expect(() => decodeUtf8(new Uint8Array([0x61, 0xe2, 0x82]))).not.toThrow(); // a cut-off sequence is not decoded exactly as the platform does (one replacement per byte), and the data is always whole UTF-8
  });
});

describe("digest", () => {
  test("SHA-256 of abc", async () => {
    expect(hex(await digest("SHA-256", new TextEncoder().encode("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("agrees with node:crypto on a data-file-sized block, from a view with an offset", async () => {
    const big = new Uint8Array(200).map((_, i) => (i * 31 + 7) & 0xff);
    const view = big.subarray(13, 65);
    expect(hex(await digest({ name: "SHA-256" }, view))).toBe(createHash("sha256").update(view).digest("hex"));
  });

  test("another algorithm is refused rather than answered wrongly", async () => {
    await expect(digest("SHA-1", new Uint8Array(1))).rejects.toThrow(/not supported/);
  });
});

describe("unwrap with the polyfills", () => {
  // The scheme (engine/wrap.js): key = SHA-256(secret); keystream block i = SHA-256(key || iv || i as 4 bytes big-endian); ciphertext = plaintext XOR keystream.
  // Built here with node:crypto alone, so the engine and the polyfilled digest are checked against an independent copy of the scheme.
  test("opens a document wrapped with node:crypto", async () => {
    const plain = Buffer.from(JSON.stringify({ players: ["Jayasuriya", "Ñoño 🏏"], n: Array.from({ length: 400 }, (_, i) => i) }), "utf8");
    const key = createHash("sha256").update("secret").digest();
    const iv = Buffer.from(Array.from({ length: 16 }, (_, i) => i * 7));
    const ct = Buffer.alloc(plain.length);
    for (let i = 0; i < Math.ceil(plain.length / 32); i++) {
      const ctr = Buffer.alloc(4); ctr.writeUInt32BE(i);
      const block = createHash("sha256").update(Buffer.concat([key, iv, ctr])).digest();
      for (let j = 0; j < 32 && i * 32 + j < plain.length; j++) ct[i * 32 + j] = plain[i * 32 + j] ^ block[j];
    }
    const doc = { v: 1, iv: iv.toString("base64"), ct: ct.toString("base64") };
    expect(await unwrap(doc, "secret")).toEqual(JSON.parse(plain.toString("utf8")));
  });
});
