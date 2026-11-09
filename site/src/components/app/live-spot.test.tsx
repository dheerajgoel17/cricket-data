import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { Store } from "@cricket/engine/store.js";
import { BatterSpot, LiveTag, TeamSpot } from "./live-spot";
import { LiveMarketRow } from "./live-markets";

// Alpha (team 0) bats first at a steady c an over: 3 innings at 9 (54 after 6 overs, 180), 4 at 10 (60, 200), 2 at 11 (66, 220), 2 at 7 (42, 140), 1 at 13 (78, 260).
const PACES = [9, 9, 9, 10, 10, 10, 10, 11, 11, 7, 7, 13];
const steady = (c: number) => Array.from({ length: 20 }, (_, i) => c * (i + 1));
const store = (() => {
  const M = { id: PACES.map((_, m) => `m${m}`), f: PACES.map(() => 0), q: PACES.map(() => 1), g: PACES.map(() => 0), d: PACES.map((_, m) => `2026-01-${String(m + 1).padStart(2, "0")}`),
    i: PACES.map(() => 1), e: PACES.map(() => 0), v: PACES.map(() => 0), a: PACES.map(() => 0), b: PACES.map(() => 1), fi: PACES.map(() => 0), pv: PACES.map(() => 0),
    inn: PACES.map((c) => [[0, 20 * c, 6, 120], [1, 100, 5, 120]]), ov: PACES.map((c) => [steady(c), steady(8)]), h: PACES.map(() => -1) };
  const index = { players: { nm: ["Opener"], id: ["pid1"] }, teams: [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }], venues: ["Ground, City"], events: [], hosts: [], nshard: 1 };
  const s = new Store({}, index, M, async () => { throw new Error("no shards"); });
  s.n = PACES.length;
  // Opener's own innings: runs after 20 balls then the final score: 30 -> 55, 28 -> 62, 33 -> 41
  (s as any).playerProgression = async () => [[30, 55], [28, 62], [33, 41]].map(([at20, fin], m) => ({ m, i: 1, b: 40, r: fin, x: [Math.round(at20 / 2), at20, Math.round((at20 + fin) / 2), null, null, null, null] }));
  return s;
})();
let match: any = null;
vi.mock("@/lib/data", () => ({ useData: () => ({ store }) }));
vi.mock("@/hooks/useLive", () => ({ useLiveMatch: () => ({ match }) }));

const live = (o = {}) => ({ status: "live", teams: [{ name: "Alpha" }, { name: "Beta" }], innings: [{ n: 1, team: "Alpha", runs: 60, wkts: 1, overs: 6 }], ...o });
const fx = { a: "Alpha", b: "Beta", fmt: "T20", gender: "male" };
const sides: [string, number][] = [["Alpha", 0], ["Beta", 1]];
const wrap = (ui: React.ReactElement) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;
const row = (o = {}) => ({ live: true, key: "team_total_runs", team: "Alpha", inn: 1, line: 190.5, ...o });

describe("TeamSpot", () => {
  it("counts the past innings in the same spot against the row's line: 60 after 6 overs, 6 of the 9 within 54-66 went over 190.5", () => {
    match = live();
    render(<TeamSpot r={row()} fx={fx} teams={sides} />);
    expect(screen.getByText(/Same spot \(60\/1 after 6.0 ov, 54–66 runs in 9 past T20 innings\)/)).toBeInTheDocument();
    expect(screen.getByText("6 over, 3 under 190.5")).toBeInTheDocument();
    expect(screen.queryByText(/small sample/)).not.toBeInTheDocument();
  });

  it("shows nothing for a row that is not live, not the side batting, or not this innings, nor when no innings was in that spot", () => {
    match = live();
    for (const r of [row({ live: false }), row({ team: "Beta" }), row({ inn: 2 }), row({ key: "match_runs" })]) {
      const { container, unmount } = render(<TeamSpot r={r} fx={fx} teams={sides} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    match = live({ innings: [{ n: 1, team: "Alpha", runs: 150, wkts: 0, overs: 6 }] });
    const { container } = render(<TeamSpot r={row()} fx={fx} teams={sides} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("BatterSpot", () => {
  it("counts the batter's own past innings in the same spot: 30 off 20, 3 innings in the band, 2 over 49.5 and 1 under", async () => {
    match = live({ players: [{ name: "Opener", team: "Alpha", runs: 30, balls: 20, out: false, strike: true }] });
    render(wrap(<BatterSpot r={{ pid: "pid1", name: "Opener", team: "Alpha", opp: "Beta", fmt: "T20", start: "2026-11-09T10:00:00Z", line: 49.5 }} />));
    expect(await screen.findByText(/Same spot \(30 off 20, 3 of his innings\)/)).toBeInTheDocument();
    expect(screen.getByText("2 over, 1 under 49.5")).toBeInTheDocument();
    expect(screen.getByText(/small sample/)).toBeInTheDocument(); // 3 < 6
  });

  it("shows nothing before he has faced ten balls", () => {
    match = live({ players: [{ name: "Opener", team: "Alpha", runs: 8, balls: 6, out: false, strike: true }] });
    const { container } = render(wrap(<BatterSpot r={{ pid: "pid1", name: "Opener", team: "Alpha", opp: "Beta", fmt: "T20", line: 49.5 }} />));
    expect(container).toBeEmptyDOMElement();
  });
});

describe("live rows", () => {
  it("the tag, an over / under market with both prices and a pick with its outcomes", () => {
    render(<><LiveTag /><LiveMarketRow m={{ kind: "ou", market: "Runs at Fall of 3rd Wicket", line: 81.5, over: 1.9, under: 1.8, book: "BookK" }} /><LiveMarketRow m={{ kind: "pick", market: "To Score Most Runs", outcomes: [{ label: "A", price: 2.5 }, { label: "B", price: 3, sub: "Pakistan" }] }} /></>);
    expect(screen.getAllByText("Live").length).toBe(3);
    expect(screen.getByText("Runs at Fall of 3rd Wicket")).toBeInTheDocument();
    expect(screen.getByText("O/U 81.5")).toBeInTheDocument();
    expect(document.querySelector('[data-book="BookK"]')).not.toBeNull(); // the row names its book
    expect(screen.getByText("1.90")).toBeInTheDocument();
    expect(screen.getByText("1.80")).toBeInTheDocument();
    expect(screen.getByText("2.50")).toBeInTheDocument();
    expect(screen.getByText("B (Pakistan)")).toBeInTheDocument();
  });
});
