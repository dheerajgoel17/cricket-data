/* eslint-disable @typescript-eslint/no-explicit-any */
import { Store } from "@cricket/engine/store.js";
import { MIN_MATCHES, competitions, leagueData } from "@/lib/league";

// Twenty T20s between Alpha (team 0) and Beta (team 1) in event 1 ("Test League"); Alpha wins the first twelve, Beta the other eight. A second event has too few matches to be listed.
function synthetic() {
  const n = 22, ids = Array.from({ length: n }, (_, m) => m), main = (m: number) => m < 20;
  const inn = ids.map(() => [[0, 150, 5, 0, 0, 0], [1, 140, 5, 0, 0, 0]]);
  const M = {
    id: ids.map((m) => `m${m}`), f: ids.map(() => 0), q: ids.map(() => 1), g: ids.map(() => 0), d: ids.map((m) => `2026-01-${String(m + 1).padStart(2, "0")}`),
    i: ids.map(() => 1), e: ids.map((m) => (main(m) ? 1 : 2)), v: ids.map(() => 0), a: ids.map(() => 0), b: ids.map(() => 1), fi: ids.map(() => 0), pv: ids.map(() => 0),
    w: ids.map((m) => (m < 12 ? 0 : 1)), r: ids.map(() => 0), inn, ho: ids.map(() => 15), mc: ids.map(() => 40), mw: ids.map(() => 3), ts: ids.map(() => 60), ov: ids.map(() => []), h: ids.map(() => -1),
  };
  const index = { players: { nm: [], id: [] }, teams: [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }], venues: ["Ground, City"], events: ["", "Test League", "Small Cup"], hosts: [], nshard: 0 };
  return new (Store as any)({}, index, M, async () => { throw new Error("no shards"); });
}

describe("competitions", () => {
  test("lists those with enough matches, the biggest first", () => {
    const store = synthetic();
    expect(MIN_MATCHES).toBe(8);
    expect(competitions(store)).toEqual([[1, 20]]); // event 2 has two matches: left out
  });
});

describe("leagueData", () => {
  const store = synthetic(), d = leagueData(store, 1);

  test("its matches, format and seasons", () => {
    expect(d.ms).toHaveLength(20);
    expect(d.fmtName).toBe("T20");
    expect(d.seasons).toEqual(["2026"]);
  });

  test("each side's record: played, won, lost", () => {
    expect(d.tt.get(0)).toEqual({ n: 20, w: 12, l: 8 });
    expect(d.tt.get(1)).toEqual({ n: 20, w: 8, l: 12 });
    expect(d.teams.map(([t]) => t)).toEqual([0, 1]); // equal games: the lower index first
  });

  test("the latest results, newest first, with each innings' score", () => {
    expect(d.results).toHaveLength(15);
    expect(d.results[0]).toMatchObject({ date: "2026-01-20", match: "Alpha v Beta", score: "150/5 · 140/5", winner: "Beta" });
    expect(d.results[14].date).toBe("2026-01-06");
  });

  test("the summary markets are computed on its matches", () => {
    const runs = d.markets.find((m) => m.label.toLowerCase().includes("runs"));
    expect(runs?.n).toBe(20);
    expect(runs?.median).toBe("290"); // 150 + 140 in every match
  });
});
