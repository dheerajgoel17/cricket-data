import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Store } from "@cricket/engine/store.js";
import { InplayHistory } from "./inplay-history";

// Alpha (team 0) bats first at a steady c an over: 3 innings at 9 (54 after 6 overs, 180), 4 at 10 (60, 200), 2 at 11 (66, 220), 2 at 7 (42, 140), 1 at 13 (78, 260).
const PACES = [9, 9, 9, 10, 10, 10, 10, 11, 11, 7, 7, 13];
const steady = (c: number) => Array.from({ length: 20 }, (_, i) => c * (i + 1));
const store = (() => {
  const n = PACES.length;
  const M = { id: PACES.map((_, m) => `m${m}`), f: PACES.map(() => 0), q: PACES.map(() => 1), g: PACES.map(() => 0), d: PACES.map((_, m) => `2026-01-${String(m + 1).padStart(2, "0")}`),
    i: PACES.map(() => 1), e: PACES.map(() => 0), v: PACES.map(() => 0), a: PACES.map(() => 0), b: PACES.map(() => 1), fi: PACES.map(() => 0), pv: PACES.map(() => 0),
    inn: PACES.map((c) => [[0, 20 * c, 6, 120], [1, 100, 5, 120]]), ov: PACES.map((c) => [steady(c), steady(8)]), h: PACES.map(() => -1) };
  const index = { players: { nm: [], id: [] }, teams: [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }], venues: ["Ground, City"], events: [], hosts: [], nshard: 0 };
  const s = new Store({}, index, M, async () => { throw new Error("no shards"); });
  s.n = n;
  return s;
})();
// Alpha 'Opener': innings of 40 balls, runs after 20 balls then the final score: 30 -> 55, 28 -> 62, 33 -> 41 (three of his own in the 25-35 band at 20 balls)
const progression = [[30, 55], [28, 62], [33, 41]].map(([at20, fin], m) => ({ m, i: 1, b: 40, r: fin, x: [Math.round(at20 / 2), at20, Math.round((at20 + fin) / 2)] }));
(store as any).playerProgression = async () => progression;
vi.mock("@/lib/data", () => ({ useData: () => ({ store, rz: { players: () => [{ idx: 0, score: 10 }] } }) }));
// the in-play lines the route would give: Alpha's innings total 190.5 at 1.90 / 1.90 and the batter "Opener" at 49.5
const DOC = { matches: [{ home: "Alpha", away: "Beta", lines: [
  { kind: "team_runs", team: "Alpha", inn: 1, line: 190.5, over: 1.9, under: 1.9 },
  { kind: "team_runs", team: "Alpha", inn: 1, line: 185.5, over: 1.87, under: 1.91, book: "Puntit" },
  { kind: "player_runs", player: "Opener", line: 49.5, over: 1.8, under: 2 },
] }] };
vi.mock("@/lib/queries", () => ({ inplayQuery: { queryKey: ["inplay-lines"], queryFn: async () => DOC } }));
const wrap = (ui: React.ReactElement) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

const live = (o = {}) => ({ status: "live", innings: [{ n: 1, team: "Alpha", runs: 60, wkts: 1, overs: 6 }], ...o });
const sides: [string, number][] = [["Alpha", 0], ["Beta", 1]];
const now = Date.parse("2026-06-01T00:00:00Z");

describe("InplayHistory", () => {
  beforeAll(() => { Element.prototype.scrollTo = () => {}; }); // jsdom has no scrollTo; the pill group scrolls its active item into view
  it("counts how the similar innings went: 60 after 6 overs, 6 of the 9 within 54-66 passed 190.5", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    render(wrap(<InplayHistory match={live()} fmt="T20" gender="male" teams={sides} />));
    expect(screen.getByText(/9 past T20 innings were between 54 and 66 after 6.0 overs/)).toBeInTheDocument();
    expect(screen.getByText("190.5")).toBeInTheDocument();
    expect(screen.getAllByText("Over 6/9").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Under 3/9").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Small sample/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("puts the book's live innings line first with its prices, scored on the same nine innings", async () => {
    render(wrap(<InplayHistory match={live({ teams: [{ name: "Alpha" }, { name: "Beta" }] })} fmt="T20" gender="male" teams={sides} />));
    expect(await screen.findByText(/Book line now · Over 1.90 · Under 1.90/)).toBeInTheDocument();
    expect(screen.getByText(/Puntit · Over 1.87 · Under 1.91/)).toBeInTheDocument();
    expect(screen.getAllByText("190.5")).toHaveLength(1); // the book's line is not repeated by the ladder
  });

  it("is hidden when the match is not live, or the format has no over limit", () => {
    const a = render(wrap(<InplayHistory match={live({ status: "final" })} fmt="T20" gender="male" teams={sides} />));
    expect(a.container).toBeEmptyDOMElement();
    const b = render(wrap(<InplayHistory match={live()} fmt="Test" gender="male" teams={sides} />));
    expect(b.container).toBeEmptyDOMElement();
  });

  it("says so when nothing in the history was in that spot", () => {
    render(wrap(<InplayHistory match={live({ innings: [{ n: 1, team: "Alpha", runs: 120, wkts: 0, overs: 6 }] })} fmt="T20" gender="male" teams={sides} />));
    expect(screen.getByText(/No past T20 innings were between 108 and 132/)).toBeInTheDocument();
  });

  it("adds a batter's own innings once he is 10 to 30 balls in: three innings in the band, counted against his final scores", async () => {
    const batting = live({ teams: [{ name: "Alpha" }, { name: "Beta" }], players: [{ name: "Opener", team: "Alpha", runs: 30, balls: 20, out: false, strike: true }] });
    render(wrap(<InplayHistory match={batting} fmt="T20" gender="male" teams={sides} />));
    expect(await screen.findByText("Opener")).toBeInTheDocument();
    expect(await screen.findByText(/Book line now · Over 1.80 · Under 2.00/)).toBeInTheDocument(); // his listed 49.5: 55, 62 over, 41 under
    expect(screen.getByText("49.5")).toBeInTheDocument();
    expect(screen.getByText(/3 of his innings were between 25 and 35 after 20 balls/)).toBeInTheDocument();
    expect(screen.getAllByText(/Small sample/).length).toBeGreaterThan(0); // 3 < 6
  });

  it("shows no batter section before ten balls", () => {
    const batting = live({ players: [{ name: "Opener", team: "Alpha", runs: 8, balls: 6, out: false, strike: true }] });
    render(wrap(<InplayHistory match={batting} fmt="T20" gender="male" teams={sides} />));
    expect(screen.queryByText("Opener")).not.toBeInTheDocument();
  });
});
