// Odd / even of a side's score after N overs, read from the over tape (`ov`, cumulative runs at the end of each completed over) of the history. History only: no book prices it, so nothing here has an edge.
// The one definition for the web Odd / Even tab and the app's. A match with no tape, or one whose innings ended before over N without being all out (a chase that finished early, a shortened match), has no value and is not counted.
import { oversScore, selectMatches } from "./markets.js";
import { FORMATS } from "./util.js";

const IT = 0, IR = 1;
/** The overs a format is read at (a Test, the Hundred and 60-over cricket are not offered). */
export function parityOvers(fmt) {
  const name = typeof fmt === "number" ? FORMATS[fmt] : fmt;
  return name === "T20" ? [5, 10, 15, 20] : name === "ODI" ? [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] : name === "T10" ? [5, 10] : [];
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

/**
 * The odd / even results of one slice of history after `overs` overs: `{ n, odd, even, pOdd, typical, marks }` (`marks` oldest to newest, `{ m, odd, score, vs, date, k }`, `vs` the other side's index).
 * Pick the slice with `team` (a team index; its own innings) or leave it out for every side at a ground; `inn` is the innings number (1 or 2) or 0 for either; `venue` is venue indices; `opp` an opponent;
 * `lastN` keeps the newest N matches that have a value (not N matches of which some had none). A match decided by a weather adjustment is left out: its overs are not the format's.
 */
export function parityMarks(store, { fmt, gender = 0, team = null, inn = 0, overs, venue = null, opp = null, lastN = 10 } = {}) {
  const M = store?.M;
  if (!M?.ov || !(overs > 0)) return null;
  const ms = selectMatches(store, { fmt, gender, anyQ: true, team: team ?? undefined, opp: opp ?? undefined, venue: venue?.length ? venue : undefined });
  const marks = [];
  for (const m of ms) {
    if (M.dls?.[m]) continue;
    const innings = M.inn[m] || [];
    for (let k = 0; k < Math.min(innings.length, 2); k++) {
      if (inn && k !== inn - 1) continue;
      if (team != null && innings[k][IT] !== team) continue;
      const score = oversScore(M.ov[m]?.[k], innings[k], overs);
      if (score == null) continue;
      const batting = innings[k][IT];
      marks.push({ m, odd: score % 2 === 1, score, vs: M.a[m] === batting ? M.b[m] : M.a[m], date: M.d[m], k });
    }
  }
  const last = lastN > 0 ? marks.slice(-lastN) : marks;
  const odd = last.filter((x) => x.odd).length;
  return { n: last.length, odd, even: last.length - odd, pOdd: last.length ? odd / last.length : null, typical: median(last.map((x) => x.score)), marks: last };
}

/** Every block the Odd / Even page shows for one side of a fixture, after `overs` overs: the side in each innings, at this ground, at this ground in the other sides' innings 1 / 2, and against the other side. */
export function parityBlocks(store, { fmt, gender = 0, team, opp, venue = null, overs, lastN = 10 }) {
  const base = { fmt, gender, overs, lastN };
  return {
    first: parityMarks(store, { ...base, team, inn: 1 }),
    second: parityMarks(store, { ...base, team, inn: 2 }),
    here: venue?.length ? parityMarks(store, { ...base, team, venue }) : null,
    ground1: venue?.length ? parityMarks(store, { ...base, inn: 1, venue }) : null,
    ground2: venue?.length ? parityMarks(store, { ...base, inn: 2, venue }) : null,
    vs: opp != null && opp >= 0 ? parityMarks(store, { ...base, team, opp, lastN: 5 }) : null,
  };
}
