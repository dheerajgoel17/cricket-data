import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Store } from "@cricket/engine/store.js";
import { TournamentStats } from "./tournament-stats";

Element.prototype.scrollTo = () => {}; // jsdom has none; the tab row scrolls its active chip into view

vi.mock("@/lib/analytics", () => ({ track: () => {} }));
vi.mock("./badges", () => ({ PlayerBadge: () => <span>pic</span>, TeamBadge: () => <span>crest</span> }));
vi.mock("./portrait", () => ({ PlayerAvatar: () => <span>shirt</span> }));
vi.mock("./player-name", () => ({ PlayerName: ({ idx }: { idx: number }) => <>{`Player ${idx}`}</> }));

// One men's T20 season of three matches in March 2025 and one match in September (its own season). Seven players bat in match 0 (90, 80, 70, 60, 50, 40, 30 runs), player 0 takes 3 wickets
// and player 5 takes 2 in it, so "Most runs" has seven rows and "Most wickets" two.
const M = {
  id: ["a", "b", "c", "d"], d: ["2025-03-01", "2025-03-05", "2025-03-10", "2025-09-01"], f: [0, 0, 0, 0], g: [0, 0, 0, 0], e: [0, 0, 0, 0], a: [0, 0, 0, 0], b: [1, 1, 1, 1],
  w: [0, 0, 0, 0], r: [0, 0, 0, 0], q: [1, 1, 1, 1], fi: [0, 0, 0, 0], pv: [0, 0, 0, 0],
  inn: [0, 1, 2, 3].map(() => [[0, 180, 5, 120, 10, 8], [1, 150, 10, 110, 9, 4]]),
};
const ids = [0, 1, 2, 3, 4, 5, 6].map((i) => `0000000${i}`);
const index = { players: { id: ids, nm: ids.map((_, i) => `Player ${i}`) }, teams: [{ n: "Reds", g: 0 }, { n: "Blues", g: 0 }], venues: [], events: ["League"], hosts: [], kinds: ["", "bowled", "caught"], formats: ["T20"], nshard: 1 };
const col = (cols: string[], rows: number[][]) => Object.fromEntries(cols.map((c, j) => [c, rows.map((r) => r[j])]));
const shard = {
  bat: col(["p", "m", "i", "t", "q", "o", "r", "b", "f", "s", "k", "tb", "mt"], [90, 80, 70, 60, 50, 40, 30].map((r, p) => [p, 0, 1, 0, 1, p + 1, r, 50, 4, 2, 0, 0, 0])),
  bowl: col(["p", "m", "i", "t", "q", "w", "c", "n"], [[0, 0, 1, 1, 0, 3, 20, 24], [5, 0, 1, 1, 0, 2, 30, 24]]),
  fld: {},
};
const store = new Store({}, index, M, async () => shard);
vi.mock("@/lib/data", () => ({ useData: () => ({ store }) }));

const view = (season = "", onSeason = () => {}) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><TournamentStats eventIdx={0} season={season} onSeason={onSeason} /></MemoryRouter>
  </QueryClientProvider>,
);

describe("TournamentStats", () => {
  it("leads with the top run-scorer and wicket-taker, lists five rows and shows the rest on request", async () => {
    view("2025");
    const runs = await screen.findByRole("region", { name: "Most runs" });
    expect(within(runs).getAllByRole("row")).toHaveLength(6); // the header and five players
    expect(within(runs).getByText("Player 0")).toBeInTheDocument();
    expect(within(runs).getByText("90")).toBeInTheDocument();
    fireEvent.click(within(runs).getByRole("button", { name: "Show all 7" }));
    expect(within(runs).getAllByRole("row")).toHaveLength(8);
    expect(within(runs).getByText("30")).toBeInTheDocument();
    // the leader cards: most runs 90 and most wickets 3 (hand count), both player 0, so no third card
    expect(screen.getAllByText("Most runs").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Most wickets")).toBeInTheDocument();
    expect(screen.queryByText("Top performer")).toBeNull();
  });

  it("states the season in four numbers and switches to the bowling lists", async () => {
    view("2025");
    await screen.findByRole("region", { name: "Most runs" });
    expect(screen.getByText("Avg 1st inns").nextSibling).toHaveTextContent("180"); // (180 + 180 + 180) / 3 matches of the March season
    expect(screen.getByText("Bat 1st won").nextSibling).toHaveTextContent("100%");
    fireEvent.click(screen.getByRole("radio", { name: "Bowling" }));
    const wk = await screen.findByRole("region", { name: "Most wickets" });
    expect(within(wk).getAllByRole("row")).toHaveLength(3); // the header and two players
    expect(within(wk).getByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Most runs" })).toBeNull();
  });

  it("offers each season, newest first, and reports the one picked", async () => {
    const onSeason = vi.fn();
    view("", onSeason); // no season in the link: the newest, September
    await screen.findByRole("region", { name: "Highest team totals" });
    const pick = screen.getByLabelText("Season") as HTMLSelectElement;
    expect([...pick.options].map((o) => [o.value, o.textContent])).toEqual([["2025-09", "2025 Sep"], ["2025", "2025 Mar"]]);
    expect(pick.value).toBe("2025-09");
    fireEvent.change(pick, { target: { value: "2025" } });
    expect(onSeason).toHaveBeenCalledWith("2025");
  });

  it("a season whose matches have no player rows still shows its team totals, and no batting or bowling tabs", async () => {
    view("2025-09");
    const high = await screen.findByRole("region", { name: "Highest team totals" });
    expect(within(high).getAllByRole("row")).toHaveLength(3); // the header, 180/5 and 150
    expect(screen.queryByRole("radio", { name: "Batting" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Most runs" })).toBeNull();
  });
});
