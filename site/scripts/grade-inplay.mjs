import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { identityIndex } from "../packages/engine/identity.js";
import { batterHistoryKey } from "../packages/engine/inplay-history.js";
import { pairOf } from "../packages/engine/inplay-log.js";
import { namesMatch, teamKey } from "../packages/engine/live.js";
import { FORMATS } from "../packages/engine/util.js";
import { historyStorage } from "./inplay-storage.mjs";

export function gradeOffers(offers, matches, players, identity) {
  const observations = new Map();
  for (const offer of offers) {
    if (offer.kind !== "player_runs" || offer.inn !== 1 || offer.ctx?.status !== "live") continue;
    const kickoff = Date.parse(offer.kickoff), at = Date.parse(offer.at), scoreAt = Date.parse(offer.score_at);
    if (!Number.isFinite(kickoff) || !Number.isFinite(at - scoreAt) || Math.abs(at - scoreAt) > 90_000) continue;
    const key = [offer.pair, offer.fmt, offer.kickoff.slice(0, 10)].join("|");
    const candidates = matches.get(key) || [];
    if (candidates.length !== 1 || !candidates[0].qualified) continue;
    const match = candidates[0];
    const batters = players.get(match.index) || [];
    const sameSide = batters.filter((b) => b.inn === offer.cur_inn && teamKey(b.team) === teamKey(offer.bat_team));
    const linked = sameSide.filter((b) => identity.bookNames(b.pid).some((name) => name.toLowerCase() === offer.subject?.toLowerCase()));
    const hits = linked.length ? linked : sameSide.filter((b) => namesMatch(b.name, offer.subject));
    if (hits.length !== 1) continue;
    const batter = hits[0];
    const band = batterHistoryKey({ fmt: offer.fmt, gender: match.gender, balls: offer.b_balls, runs: offer.b_runs, line: offer.line });
    if (!band || batter.runs < offer.b_runs || batter.balls < offer.b_balls) continue;
    const id = JSON.stringify([match.index, batter.pid, batter.inn, band]);
    const previous = observations.get(id);
    if (!previous || offer.at < previous.at || (offer.at === previous.at && offer.line_key < previous.line_key)) {
      observations.set(id, { band, at: offer.at, line_key: offer.line_key, verdict: batter.runs > offer.line ? "over" : batter.runs < offer.line ? "under" : "push" });
    }
  }
  const summaries = {};
  for (const { band, verdict } of observations.values()) {
    const counts = summaries[band] ??= { over: 0, under: 0, push: 0 };
    counts[verdict]++;
  }
  return summaries;
}

async function main(dir, storage, now = Date.now()) {
  const read = async (file) => JSON.parse(await readFile(join(dir, file), "utf8"));
  const file = join(dir, "inplay-history.json");
  const cached = await storage.loadSummary();
  if (cached.counts && now - Date.parse(cached.at) < 12 * 3600e3) {
    await writeFile(file, JSON.stringify(cached.counts));
    return;
  }
  const publish = async (counts) => {
    await storage.saveSummary({ at: new Date(now).toISOString(), counts });
    await writeFile(file, JSON.stringify(counts));
  };
  const offers = [];
  for (let day = 2; day >= 0; day--) {
    for await (const rows of storage.chunks(new Date(now - day * 864e5).toISOString().slice(0, 10))) {
      for (const row of rows) if (row.kind === "player_runs" && ["T20", "ODI"].includes(row.fmt)) offers.push(row);
    }
  }
  if (!offers.length) return publish({});
  const [M, index, identities] = await Promise.all([read("matches.json"), read("index.json"), read("identity.json")]);
  const wanted = new Set(offers.map((r) => [r.pair, r.fmt, r.kickoff?.slice(0, 10)].join("|")));
  const matches = new Map(), needed = new Set(), players = new Map();
  for (let m = 0; m < M.id.length; m++) {
    const key = [pairOf(index.teams[M.a[m]].n, index.teams[M.b[m]].n), FORMATS[M.f[m]], M.d[m]].join("|");
    if (!wanted.has(key)) continue;
    const list = matches.get(key) || [];
    const qualified = M.q[m] === 1 && [0, 1].includes(M.r[m]) && !M.dls?.[m];
    list.push({ index: m, gender: M.g[m], qualified });
    matches.set(key, list);
    if (qualified) needed.add(m);
  }
  for (let shard = 0; needed.size && shard < index.nshard; shard++) {
    const { bat } = await read(`p/${String(shard).padStart(2, "0")}.json`).catch((err) => {
      if (err.code === "ENOENT") return {};
      throw err;
    });
    for (let k = 0; k < (bat?.p?.length || 0); k++) {
      const m = bat.m[k];
      if (!needed.has(m)) continue;
      const p = bat.p[k], list = players.get(m) || [];
      list.push({ pid: index.players.id[p], name: index.players.nm[p], team: index.teams[bat.t[k]].n, inn: bat.i[k], runs: bat.r[k], balls: bat.b[k] });
      players.set(m, list);
    }
  }
  await publish(gradeOffers(offers, matches, players, identityIndex(identities)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Storage configuration missing");
  await main(process.argv[2], historyStorage({ base: SUPABASE_URL.replace(/\/+$/, ""), key: SUPABASE_SERVICE_KEY }));
}
