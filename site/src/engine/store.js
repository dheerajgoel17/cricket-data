// Loads the generated data files and joins player rows to their match. Works in the browser and in node tests:
// pass `fetchJson(relativePath)`; the default uses fetch().
import { norm } from "./util.js";

export async function createStore({ base = "data/", fetchJson } = {}) {
  const get = fetchJson || (async (p) => {
    const r = await fetch(base + p);
    if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
    return r.json();
  });
  const [meta, index, M] = await Promise.all([get("meta.json"), get("index.json"), get("matches.json")]);
  return new Store(meta, index, M, get);
}

export class Store {
  constructor(meta, index, M, get) {
    this.meta = meta;
    this.index = index;
    this.M = M;
    this.P = index.players;
    this.get = get;
    this.shards = new Map();
    this.nshard = index.nshard;
    this.teams = index.teams;
    this.venues = index.venues;
    this.events = index.events;
    this.n = M.id.length;
    this.fixtures = null;
    this._eventNorm = this.events.map(norm);
  }

  teamName(i, short = false) {
    const t = this.teams[i];
    if (!t) return "?";
    return t.g && !short ? `${t.n} (W)` : t.n;
  }
  venueName(i) { return this.venues[i]; }
  playerName(i) { return this.P.nm[i]; }
  genderOfTeam(i) { return this.teams[i]?.g ?? 0; }

  /** home / away / neutral for team `t` in match `m`; null when the host is unknown. */
  venueType(m, t) {
    const h = this.M.h[m];
    if (h === -1) return "neutral";
    if (h === -2 || h == null) return null;
    const host = this.index.hosts[h];
    if (this.teams[t].n === host) return "home";
    const other = this.M.a[m] === t ? this.M.b[m] : this.M.a[m];
    return this.teams[other].n === host ? "away" : "neutral";
  }

  /** true when `t` batted first in match m, null if unknown (provisional data has no innings). */
  battedFirst(m, t) {
    const fi = this.M.fi[m];
    return fi < 0 ? null : fi === t;
  }

  matchMeta(m) {
    const M = this.M;
    return { m, id: M.id[m], date: M.d[m], fmt: M.f[m], g: M.g[m], intl: M.i[m], e: M.e[m], v: M.v[m], a: M.a[m],
      b: M.b[m], w: M.w[m], r: M.r[m], pv: M.pv[m], q: M.q[m] };
  }

  shardOf(pidx) {
    const id = this.P.id[pidx];
    const n = parseInt(id, 16);
    return Number.isNaN(n) ? 0 : n % this.nshard;
  }

  async shard(n) {
    if (!this.shards.has(n)) this.shards.set(n, this.get(`p/${String(n).padStart(2, "0")}.json`));
    return this.shards.get(n);
  }

  _row(m, t, extra) {
    const M = this.M;
    return { m, date: M.d[m], fmt: M.f[m], g: M.g[m], intl: M.i[m], e: M.e[m], v: M.v[m], pv: M.pv[m], q: M.q[m],
      home: this.venueType(m, t), bf: this.battedFirst(m, t), ...extra };
  }

  /** Every batting innings and bowling spell of one player, joined to its match, oldest first. */
  async playerRows(pidx) {
    const d = await this.shard(this.shardOf(pidx));
    const bat = [], bowl = [];
    const b = d.bat || {};
    for (let k = 0; k < (b.p?.length || 0); k++) {
      if (b.p[k] !== pidx) continue;
      bat.push(this._row(b.m[k], b.t[k], { i: b.i[k], t: b.t[k], opp: b.q[k], o: b.o[k], r: b.r[k], b: b.b[k], f: b.f[k],
        s: b.s[k], k: b.k[k], tb: b.tb[k], mt: b.mt[k] }));
    }
    const w = d.bowl || {};
    for (let k = 0; k < (w.p?.length || 0); k++) {
      if (w.p[k] !== pidx) continue;
      bowl.push(this._row(w.m[k], w.t[k], { i: w.i[k], t: w.t[k], opp: w.q[k], w: w.w[k], c: w.c[k], n: w.n[k] }));
    }
    const xi = new Set();
    const x = d.xi || {};
    for (let k = 0; k < (x.p?.length || 0); k++) if (x.p[k] === pidx) xi.add(x.m[k]);
    const ord = (x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.m - y.m || x.i - y.i);
    return { bat: bat.sort(ord), bowl: bowl.sort(ord), xi };
  }

  /** Partnerships between two players (any order), oldest first. */
  async pairRows(p1, p2) {
    const [a, b] = p1 < p2 ? [p1, p2] : [p2, p1];
    const d = await this.shard(this.shardOf(a));
    const t = d.pt || {};
    const out = [];
    for (let k = 0; k < (t.a?.length || 0); k++) {
      if (t.a[k] !== a || t.b[k] !== b) continue;
      const m = t.m[k];
      // the batting team is whichever team both players belong to in that match: read from the innings array
      const inn = this.M.inn[m][t.i[k] - 1];
      const team = inn ? inn[0] : -1;
      out.push(this._row(m, team, { i: t.i[k], t: team, open: t.o[k], w: t.w[k], r: t.r[k], n: t.n[k], ra: t.ra[k],
        rb: t.rb[k], x: t.x[k], kd: t.kd[k], a, b, opp: inn ? (this.M.a[m] === team ? this.M.b[m] : this.M.a[m]) : -1 }));
    }
    return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.m - y.m || x.i - y.i));
  }

  async loadFixtures() {
    if (!this.fixtures) this.fixtures = await this.get("fixtures.json").catch(() => []);
    return this.fixtures;
  }

  freshness() {
    const me = this.meta;
    return { newestBase: me.newest_base, provisionalIncluded: !!me.provisional_included,
      provisionalMatches: me.provisional_matches || 0, newestProvisional: me.newest_provisional || null,
      builtAt: me.built_at };
  }
}
