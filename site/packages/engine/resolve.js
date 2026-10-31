// Entity resolution with typo tolerance: players, teams, venues, competitions.
// Names in the data are Base-style ("HC Brook", "BM Duckett"); people type "Harry Brook", "duckett", "brok".
import { norm, lev, SURNAME_ALIAS } from "./util.js";

const TEAM_ABBR = {
  eng: "england", aus: "australia", ind: "india", pak: "pakistan", sa: "south africa", rsa: "south africa", nz: "new zealand",
  wi: "west indies", sl: "sri lanka", ban: "bangladesh", afg: "afghanistan", zim: "zimbabwe", ire: "ireland", scot: "scotland",
  ned: "netherlands", uae: "united arab emirates", usa: "united states of america", nep: "nepal", nam: "namibia",
  csk: "chennai super kings", mi: "mumbai indians", rcb: "royal challengers bengaluru", kkr: "kolkata knight riders",
  srh: "sunrisers hyderabad", dc: "delhi capitals", rr: "rajasthan royals", pbks: "punjab kings", lsg: "lucknow super giants",
  gt: "gujarat titans",
};
const EVENT_ALIAS = {
  ipl: /indian premier league/, bbl: /big bash/, wbbl: /women'?s big bash/, psl: /pakistan super league/, cpl: /caribbean premier/,
  sa20: /sa20/, ilt20: /international league t20|ilt20/, blast: /t20 blast|vitality/, lpl: /lanka premier/, bpl: /bangladesh premier/,
  "world cup": /world cup/, wc: /world cup/, "champions trophy": /champions trophy/, "asia cup": /asia cup/, ashes: /ashes/,
  "t20 world cup": /t20 world cup/, "odi world cup": /(odi|cricket) world cup/, mlc: /major league cricket/, wpl: /women'?s premier league/,
};

export class Resolver {
  constructor(store) {
    this.s = store;
    const P = store.P;
    this.bySurname = new Map();
    this.info = [];
    this.fuzzyKeys = null;
    for (let i = 0; i < P.id.length; i++) {
      const raw = P.nm[i];
      const toks = raw.split(/\s+/);
      let k = 0;
      while (k < toks.length - 1 && /^[A-Z]{1,4}$/.test(toks[k])) k++;
      const initials = toks.slice(0, k).join("");
      const rest = toks.slice(k);
      const given = initials ? "" : norm(rest.slice(0, -1).join(" "));
      const sur = norm(rest.join(" ")).length ? norm(initials ? rest.join(" ") : rest[rest.length - 1]) : norm(raw);
      this.info.push({ initials: initials.toLowerCase(), given, sur, full: norm(raw) });
      this._indexSur(sur, i);
      const last = norm(rest[rest.length - 1] || raw);
      if (last !== sur) this._indexSur(last, i);
    }
    for (const [ix, names] of Object.entries(store.index.aliases || {})) {
      for (const nm of names) {
        const t = norm(nm).split(" ");
        this._indexSur(t[t.length - 1], +ix);
      }
    }
    // activity counts for tie-breaks (venues, teams)
    this.venueCount = new Array(store.venues.length).fill(0);
    for (let m = 0; m < store.n; m++) this.venueCount[store.M.v[m]]++;
    this.teamCount = new Array(store.teams.length).fill(0);
    for (let m = 0; m < store.n; m++) { this.teamCount[store.M.a[m]]++; this.teamCount[store.M.b[m]]++; }
    this.venueNorm = store.venues.map(norm);
    this.teamNorm = store.teams.map((t) => norm(t.n));
  }

  _add(key, i) {
    if (!key) return;
    const a = this.bySurname.get(key);
    a ? (a.includes(i) || a.push(i)) : this.bySurname.set(key, [i]);
  }

  _indexSur(sur, i) {
    this._add(sur, i);
    for (const al of SURNAME_ALIAS[sur] || []) this._add(al, i);
  }

  _candidates(sur) {
    const exact = this.bySurname.get(sur);
    const out = [];
    if (exact) for (const i of exact) out.push([i, 0]);
    if (sur.length < 3) return out;
    if (!this.fuzzyKeys) this.fuzzyKeys = [...this.bySurname.keys()];
    for (const k of this.fuzzyKeys) {
      if (k === sur) continue;
      // short fragments ("sha") match prefixes (Sharma, Shah) instead of one-edit neighbours only
      if (k.startsWith(sur) || (sur.startsWith(k) && k.length >= 4)) {
        for (const i of this.bySurname.get(k)) out.push([i, Math.min(1.2, Math.abs(k.length - sur.length) * 0.2)]);
        continue;
      }
      if (sur.length < 4) continue;
      const max = sur.length >= 8 ? 2 : 1;
      if (Math.abs(k.length - sur.length) > max) continue;
      const d = lev(k, sur, max);
      if (d <= max) for (const i of this.bySurname.get(k)) out.push([i, d]);
    }
    return out;
  }

  _bias(i, opts, givenOk) {
    const P = this.s.P;
    let sc = Math.min(givenOk ? 7 : 1.5, Math.log2(1 + P.n[i]) * (givenOk ? 0.75 : 0.2));
    if (P.last[i] >= this._cutoff()) sc += 1.2;
    if (opts.gender != null) sc += P.g[i] === opts.gender ? 1.5 : -6;
    if (opts.team != null && P.tm[i] === opts.team) sc += 3;
    if (opts.fmt != null && (P.fm[i] >> opts.fmt) & 1) sc += 1;
    return sc;
  }

  /**
   * Rank players for a free-text name. opts: { gender (0|1), team (team idx), fmt }
   * Returns [{idx, name, score, team, last}] best first.
   */
  players(text, opts = {}, limit = 5) {
    const toks = norm(text).split(" ").filter(Boolean);
    if (!toks.length) return [];
    const P = this.s.P;
    const seen = new Map();
    const put = (i, sc, surWords, givenOk) => {
      sc += this._bias(i, opts, givenOk);
      const prev = seen.get(i);
      if (!prev || prev.score < sc) seen.set(i, { idx: i, name: P.nm[i], score: Math.round(sc * 100) / 100, team: P.tm[i], last: P.last[i], surnameLen: surWords });
    };
    const qn = norm(text);
    // the surname is the last token, or the last two when the data uses particles ("van der Merwe", "de Kock")
    const tries = [[toks.slice(-1).join(" "), toks.slice(0, -1)]];
    if (toks.length >= 2) tries.push([toks.slice(-2).join(" "), toks.slice(0, -2)]);
    if (toks.length >= 3) tries.push([toks.slice(-3).join(" "), toks.slice(0, -3)]);
    for (const [sur, givenToks] of tries) {
      for (const [i, d] of this._candidates(sur)) {
        const inf = this.info[i];
        let sc = 10 - d * 3, givenOk = !givenToks[0];
        const g = givenToks[0];
        if (g) {
          if (inf.initials) {
            const g0 = g[0], joined = givenToks.map((x) => x[0]).join("");
            if (inf.initials[0] === g0) { sc += (g.length === 1 || inf.initials === joined) ? 3 : 2; givenOk = true; }
            else if (inf.initials.includes(g0)) { sc += 2; givenOk = true; } // Chamari vs AC Jayangani
            else sc -= 5;
          } else if (inf.given) {
            const hit = inf.given === norm(givenToks.join(" ")) ? 4 : inf.given.startsWith(g) || g.startsWith(inf.given.split(" ")[0]) ? 2.5 : lev(inf.given.split(" ")[0], g, 1) <= 1 ? 1 : -4;
            sc += hit; givenOk = hit > 0;
          } else sc -= 1;
          const al = this.s.index.aliases?.[i];
          if (al && al.some((a) => norm(a) === qn)) { sc += 5; givenOk = true; }
        }
        if (inf.full === qn) sc += 2;
        put(i, sc, sur.split(" ").length, givenOk);
      }
    }
    // given-name and in-order word starts ("abhishek", "abhishek sha") so a first name is enough
    const aliases = this.s.index.aliases || {};
    for (let i = 0; i < this.info.length; i++) {
      const bags = [this.info[i].full, ...(aliases[i] || []).map(norm)];
      let best = 0;
      for (const nm of bags) {
        const nt = nm.split(" ").filter(Boolean);
        const used = new Set();
        let ok = true, bonus = 0;
        for (const q of toks) {
          const j = nt.findIndex((w, k) => !used.has(k) && (w === q || (q.length >= 2 && w.startsWith(q))));
          if (j < 0) { ok = false; break; }
          used.add(j);
          bonus += nt[j] === q ? 2 : 1;
        }
        if (ok) best = Math.max(best, 8 + bonus + (toks.length > 1 ? 4 : 0) + (toks.length === nt.length ? 2 : 0));
      }
      if (best) put(i, best, toks.length, true);
    }
    return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  _cutoff() {
    const y = Number((this.s.freshness?.().newestBase || this.s.meta.newest_base || "2026").slice(0, 4));
    return `${y - 2}-01-01`;
  }

  /** Best player or null; `ambiguous` lists near-ties so the UI can ask. */
  player(text, opts = {}) {
    const c = this.players(text, opts, 5);
    if (!c.length || c[0].score < 8) return null;
    const near = c.filter((x) => x.score >= c[0].score - 1.5 && x.idx !== c[0].idx);
    return { ...c[0], ambiguous: near };
  }

  team(text, gender = null) {
    let q = norm(text);
    const women = /\bwomen(s)?\b|\bw\b/.test(q);
    q = q.replace(/\b(women s|women|womens|w)\b/g, "").replace(/\s+/g, " ").trim();
    q = TEAM_ABBR[q] || q;
    if (!q) return null;
    const want = gender != null ? gender : women ? 1 : 0;
    let best = null;
    for (let i = 0; i < this.teamNorm.length; i++) {
      const t = this.teamNorm[i];
      let sc = 0;
      if (t === q) sc = 10;
      else if (t.includes(q) && q.length >= 3) sc = 6;
      else if (q.includes(t) && t.length >= 4) sc = 5;
      else if (q.length >= 4 && lev(t, q, 1) <= 1) sc = 4;
      if (!sc) continue;
      sc += this.s.teams[i].g === want ? 3 : -3;
      sc += Math.min(2, Math.log10(1 + this.teamCount[i]) * 0.5);
      if (!best || sc > best.score) best = { idx: i, name: this.s.teamName(i), score: sc };
    }
    return best && best.score >= 5 ? best : null;
  }

  venues(text, limit = 5) {
    const toks = norm(text).split(" ").filter((t) => t.length > 1 && !["the", "at", "in"].includes(t));
    if (!toks.length) return [];
    const out = [];
    for (let i = 0; i < this.venueNorm.length; i++) {
      const v = this.venueNorm[i], words = v.split(" ");
      let hit = 0;
      for (const t of toks) {
        if (v.includes(t) || words.some((w) => w.startsWith(t) && t.length >= 2) || words.some((w) => w.length > 3 && lev(w, t, 1) <= 1)) hit++;
      }
      if (!hit || (toks.length > 1 && hit < toks.length)) continue;
      out.push({ idx: i, name: this.s.venues[i], score: hit * 10 + Math.log10(1 + this.venueCount[i]) - v.length * 0.01 });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  venue(text) {
    return this.venues(text, 1)[0] || null;
  }

  /** Competition names → event indices (regex alias or substring). */
  event(text) {
    const q = norm(text);
    const rx = EVENT_ALIAS[q];
    const out = [];
    this.s.events.forEach((e, i) => {
      const en = norm(e);
      if (!en) return;
      if (rx ? rx.test(en) : en.includes(q) && q.length >= 3) out.push(i);
    });
    return out.length ? { idx: out, name: text } : null;
  }
}
