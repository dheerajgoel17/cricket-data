import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { dbHeaders } from "./inplay-log.mjs";

const bucket = "inplay-history";
const pairKey = (pair) => createHash("sha256").update(pair).digest("hex");

export function historyStorage({ base, key, fetchImpl = fetch }) {
  async function request(path, { method = "GET", body, type = "application/json", upsert = false } = {}) {
    return fetchImpl(`${base}/storage/v1/object/${path}`, {
      method, body, signal: AbortSignal.timeout(15_000),
      headers: { ...dbHeaders(key), "Content-Type": type, ...(upsert ? { "x-upsert": "true" } : {}) },
    });
  }

  async function read(path, missing = false) {
    const res = await request(`authenticated/${bucket}/${path}`);
    if (missing && res.status === 404) return [];
    if (missing && res.status === 400) {
      const err = await res.json().catch(() => null);
      if (String(err?.statusCode) === "404") return [];
    }
    if (!res.ok) throw new Error(`history read HTTP ${res.status}`);
    return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString());
  }

  async function write(path, body, upsert = false) {
    const res = await request(`${bucket}/${path}`, { method: "POST", body, type: "application/gzip", upsert });
    if (res.ok) return;
    if (!upsert && res.status === 409) return;
    if (!upsert && res.status === 400) {
      const err = await res.json().catch(() => null);
      if (err?.error === "Duplicate" || String(err?.statusCode) === "409") return;
    }
    throw new Error(`history upload HTTP ${res.status}`);
  }

  async function* chunks(day) {
    const prefix = `rounds/${day}`;
    for (let offset = 0; ; offset += 100) {
      const res = await request(`list/${bucket}`, {
        method: "POST", body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!res.ok) throw new Error(`history listing HTTP ${res.status}`);
      const files = await res.json();
      for (let i = 0; i < files.length; i += 8) {
        yield* await Promise.all(files.slice(i, i + 8).map(({ name }) => read(`${prefix}/${name}`)));
      }
      if (files.length < 100) return;
    }
  }

  const latest = new Map();
  const statePath = (pair) => `latest/${pairKey(pair)}.json.gz`;
  return {
    chunks,
    loadSummary: () => read("summaries/batters.json.gz", true),
    saveSummary: (summary) => write("summaries/batters.json.gz", gzipSync(JSON.stringify(summary)), true),
    async load({ pairs, since }) {
      const rows = await Promise.all(pairs.map(async (pair) => {
        const rows = (await read(statePath(pair), true)).filter((r) => r.at >= since);
        latest.set(pair, rows);
        return rows;
      }));
      return rows.flat();
    },
    async append({ rows }) {
      const at = rows[0].at;
      const body = gzipSync(JSON.stringify(rows));
      const stamp = at.slice(11).replace(/[^0-9]/g, "");
      const hash = createHash("sha256").update(body).digest("hex");
      await write(`rounds/${at.slice(0, 10)}/${stamp}-${hash}.json.gz`, body);

      // The history is durable before the checkpoint advances. A failed checkpoint can
      // cause another observation on retry. Grading counts each player innings once per situation.
      for (const pair of new Set(rows.map((r) => r.pair))) {
        const updates = rows.filter((r) => r.pair === pair);
        const byLine = new Map();
        for (const r of [...(latest.get(pair) || []), ...updates]) {
          const { at, match_key, line_key, kickoff, kind, over_price, under_price, outcomes } = r;
          byLine.set(JSON.stringify([match_key, line_key]), { at, pair, match_key, line_key, kickoff, kind, over_price, under_price, outcomes });
        }
        const checkpoint = [...byLine.values()];
        await write(statePath(pair), gzipSync(JSON.stringify(checkpoint)), true);
        latest.set(pair, checkpoint);
      }
      return rows.length;
    },
  };
}
