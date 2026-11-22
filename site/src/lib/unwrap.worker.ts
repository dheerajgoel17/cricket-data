import { sha256 } from "@noble/hashes/sha256";
import { unwrap } from "@cricket/engine/wrap.js";

self.onmessage = async ({ data }: MessageEvent<{ id: number; doc: unknown; secret: string }>) => {
  try {
    self.postMessage({ id: data.id, value: await unwrap(data.doc, data.secret, sha256) });
  } catch {
    self.postMessage({ id: data.id, failed: true });
  }
};
