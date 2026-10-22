// Row filters shared by player pages, the chat box and tests. Rows come from Store.playerRows().
// Returns the kept rows plus how many were dropped for lack of detail (provisional matches have no innings detail).

/**
 * filters: { fmt (0|1|2, required), gender, opp, venue, team, venueType, innings ('first'|'second'),
 *            pos [lo, hi], since, until, lastN, intl (0|1), event (event idx list), full (bool) }
 */
export function applyFilters(rows, f, store) {
  const dropped = { provisional_no_detail: 0, host_unknown: 0 };
  const M = store.M;
  let out = rows.filter((r) => {
    if (f.fmt != null && r.fmt !== f.fmt) return false;
    if (f.gender != null && r.g !== f.gender) return false;
    if (f.since && r.date < f.since) return false;
    if (f.until && r.date > f.until) return false;
    if (f.intl != null && r.intl !== f.intl) return false;
    if (f.event && !f.event.includes(r.e)) return false;
    if (f.venue != null && !asList(f.venue).includes(r.v)) return false;
    if (f.team != null && !asList(f.team).includes(r.t)) return false;
    if (f.opp != null) {
      const opp = M.a[r.m] === r.t ? M.b[r.m] : M.a[r.m];
      if (!asList(f.opp).includes(opp)) return false;
    }
    if (f.venueType) {
      if (r.home == null) { dropped.host_unknown++; return false; }
      if (r.home !== f.venueType) return false;
    }
    if (f.innings) {
      if (r.bf == null) { dropped.provisional_no_detail++; return false; }
      if ((f.innings === "first") !== r.bf) return false;
    }
    if (f.pos) {
      if (!r.o) { dropped.provisional_no_detail++; return false; }
      if (r.o < f.pos[0] || r.o > f.pos[1]) return false;
    }
    if (f.full && r.q !== 1) return false;
    return true;
  });
  if (f.lastN > 0) out = out.slice(-f.lastN);
  return { rows: out, dropped };
}

const asList = (x) => (Array.isArray(x) ? x : [x]);

/** Test matches have two innings per player: markets on "match runs" aggregate them. */
export function aggregateByMatch(rows, keys) {
  const by = new Map();
  for (const r of rows) {
    const cur = by.get(r.m);
    if (!cur) by.set(r.m, { ...r, innings: 1 });
    else {
      for (const k of keys) cur[k] += r[k];
      cur.innings += 1;
    }
  }
  return [...by.values()];
}

/** Guard for "never mix formats": throws when rows span more than one format. */
export function assertSingleFormat(rows) {
  const s = new Set(rows.map((r) => r.fmt));
  if (s.size > 1) throw new Error("refusing to mix formats");
}
