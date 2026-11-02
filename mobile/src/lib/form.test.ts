/* eslint-disable @typescript-eslint/no-explicit-any */
import { Store } from "@cricket/engine/store.js";
import { recentForms } from "@/lib/form";

// Twenty T20s between Alpha (team 0) and Beta (team 1); Alpha wins the first twelve, Beta the last eight. Every match: Alpha 150/5 then Beta 140/5.
function synthetic() {
  const ids = Array.from({ length: 20 }, (_, m) => m);
  const M = {
    id: ids.map((m) => `m${m}`), f: ids.map(() => 0), q: ids.map(() => 1), g: ids.map(() => 0), d: ids.map((m) => `2026-01-${String(m + 1).padStart(2, "0")}`), i: ids.map(() => 1), e: ids.map(() => 1),
    v: ids.map(() => 0), a: ids.map(() => 0), b: ids.map(() => 1), fi: ids.map(() => 0), pv: ids.map(() => 0), w: ids.map((m) => (m < 12 ? 0 : 1)), r: ids.map(() => 0),
    inn: ids.map(() => [[0, 150, 5, 0, 0, 0], [1, 140, 5, 0, 0, 0]]), ov: ids.map(() => []), h: ids.map(() => -1),
  };
  const index = { players: { nm: [], id: [] }, teams: [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }], venues: ["Ground, City"], events: ["", "Test League"], hosts: [], nshard: 0 };
  return new (Store as any)({}, index, M, async () => { throw new Error("no shards"); });
}

describe("recentForms", () => {
  const store = synthetic();

  test("each side's last results, oldest first, with both innings scores", () => {
    const [a, b] = recentForms(store, [["Alpha", 0], ["Beta", 1]], "T20", 3);
    expect(a.games.map((g) => g.result)).toEqual(["L", "L", "L"]); // Beta won matches 12 to 19
    expect(b.games.map((g) => g.result)).toEqual(["W", "W", "W"]);
    expect(a.games.map((g) => g.date)).toEqual(["2026-01-18", "2026-01-19", "2026-01-20"]);
    expect(a.games[2]).toMatchObject({ own: "150/5", theirs: "140/5", opp: 1 });
    expect(b.games[2]).toMatchObject({ own: "140/5", theirs: "150/5", opp: 0 });
  });

  test("a side the data does not know is left out, and a format it never played has no games", () => {
    expect(recentForms(store, [["Nobody", -1], ["Alpha", 0]], "T20")).toHaveLength(1);
    expect(recentForms(store, [["Alpha", 0]], "Test")[0].games).toEqual([]);
  });
});
