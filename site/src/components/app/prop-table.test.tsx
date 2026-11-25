import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { bookQuotes } from "@cricket/engine/lines.js";
import { authState, savedKeys } from "@/test/auth-harness";
import { PropLines, PropRow, PropTable } from "./hot-props";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
vi.mock("./live-spot", async (orig) => ({ ...(await orig<typeof import("./live-spot")>()), BatterSpot: () => <span>Similar in-play lines</span> })); // its history line needs the data provider; not what is tested here
vi.mock("./badges", () => ({
  PlayerBadge: () => <span>pic</span>,
  PlayerPhoto: () => <span>face</span>,
  TeamFlag: () => null,
  TeamBadge: () => null,
}));

const window = (p: number, played: number) => ({ p, hits: Math.round(p * played), played, mean: 20 });
const row: any = {
  idx: 1, pid: "p1", inn: 0, name: "AM Tribe", team: "Jersey", stat: "runs", line: 39.5, fmt: "ODI",
  start: "2026-10-30T12:00:00Z", over: 1.85, quotes: [], venue: "Wankhede Stadium, Mumbai",
  season: window(0.6, 20), h2h: window(0.5, 4), ven: window(0.4, 5), l10: window(0.7, 10),
  edge: 0.051, side: "over", last: [{ v: 53, s: "hit" }, { v: 12, s: "miss" }], max: 80,
};

describe("PropLines", () => {
  it("density=auto mounts both compact list and dense table", () => {
    const { container } = render(
      <MemoryRouter>
        <PropLines rows={[row]} win="l10" onWin={() => {}} bars density="auto" soFarOf={() => null} outOf={() => false} />
      </MemoryRouter>,
    );
    expect(container.querySelector(".lg\\:hidden")).toBeTruthy();
    expect(container.querySelector(".hidden.lg\\:block")).toBeTruthy();
    expect(screen.getAllByText("AM Tribe").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Lines")).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
  });

  it("density=compact mounts the scan list only", () => {
    render(
      <MemoryRouter>
        <PropLines rows={[row]} density="compact" soFarOf={() => null} outOf={() => false} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Edge")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.queryByText("Lines")).toBeNull();
    expect(screen.queryByText("Model edge")).toBeNull();
  });

  it("dense table shows cricket columns and ranks from a header click", () => {
    const onWin = vi.fn();
    render(<MemoryRouter><PropLines rows={[row]} win="l10" onWin={onWin} bars density="dense" soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("Lines")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /L10 chart/ })).toBeInTheDocument();
    expect(screen.getByText("Over / under")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "H2H" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ground" })).toBeInTheDocument();
    expect(screen.getByText("Model edge")).toBeInTheDocument();
    expect(screen.queryByText("DVP")).toBeNull();
    expect(screen.queryByText("MATCHUP")).toBeNull();
    expect(screen.getByText("AM Tribe")).toBeInTheDocument();
    expect(screen.getAllByText("1.85").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+5.1")).toBeInTheDocument();
    expect(screen.getByText("Wankhede")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "H2H" }));
    expect(onWin).toHaveBeenCalledWith("h2h");
  });

  it("scan and table skip so-far copy; keep history and fallback states", () => {
    const live = { ...row, line: 40, quotes: [{ source: "book", name: "Book", line: 40, over: 1.85, under: 1.95, live: true }] };
    const renderRows = (standing: Parameters<typeof PropRow>[0]["soFar"], out = false) => (
      <MemoryRouter>
        <PropLines rows={[live]} density="compact" soFarOf={() => standing} outOf={() => out} />
        <PropLines rows={[live]} win="l10" onWin={() => {}} bars={false} density="dense" soFarOf={() => standing} outOf={() => out} />
      </MemoryRouter>
    );
    const { rerender } = render(renderRows({ v: 32, state: "live", verdict: null }));
    expect(screen.queryByText(/so far|Cleared|Missed|On the line/)).toBeNull();
    expect(screen.queryByRole("img", { name: "32 of 40" })).toBeNull();
    expect(screen.getAllByText("Similar in-play lines")).toHaveLength(1);
    rerender(renderRows(null));
    // Score unavailable replaces MiniBars (not a title badge).
    expect(screen.getAllByText("Score unavailable").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("img", { name: /Last / })).toBeNull();
    rerender(renderRows({ v: 40, state: "final", verdict: "push" }));
    expect(screen.queryByText(/so far|final|On the line/)).toBeNull();
    expect(screen.queryByText("Similar in-play lines")).toBeNull();
    expect(screen.queryByRole("img", { name: "40 of 40" })).toBeNull();
    rerender(renderRows(null, true));
    expect(screen.getAllByText("Not in XI").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("img", { name: /Last / })).toBeNull(); // Not in XI replaces the bars
    expect(screen.queryByText("+5")).toBeNull();
    expect(screen.queryByText("+5.1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Book prices" })).toBeNull();
    expect(screen.queryByText("Score unavailable")).toBeNull();
  });

  it("scan card keeps edge + bars without a save control on the graph", () => {
    render(<MemoryRouter><PropLines rows={[row]} density="compact" soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("Edge")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Last 2/ })).toBeInTheDocument();
    expect(screen.queryByText(/in L10/)).toBeNull();
    expect(screen.queryByText(/at WACA|at Eden/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to watchlist" })).toBeNull();
  });

  it("keeps Edge and puts a Hit/Miss mark beside odds once the pre-match line has settled", () => {
    const { rerender } = render(<MemoryRouter><PropLines rows={[row]} density="compact" soFarOf={() => ({ v: 50, state: "final", verdict: "cleared" })} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByRole("img", { name: "Hit" })).toBeInTheDocument();
    expect(screen.queryByText(/so far|Cleared|Missed/)).toBeNull();
    expect(screen.getByText("Edge")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    rerender(<MemoryRouter><PropLines rows={[row]} density="compact" soFarOf={() => ({ v: 12, state: "final", verdict: "missed" })} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByRole("img", { name: "Miss" })).toBeInTheDocument();
    expect(screen.queryByText(/so far|Cleared|Missed/)).toBeNull();
    expect(screen.getByText("Edge")).toBeInTheDocument();
    rerender(<MemoryRouter><PropLines rows={[{ ...row, side: "under" }]} density="compact" soFarOf={() => ({ v: 12, state: "final", verdict: "missed" })} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByRole("img", { name: "Hit" })).toBeInTheDocument();
    rerender(<MemoryRouter><PropLines rows={[row]} density="compact" soFarOf={() => ({ v: 39.5, state: "final", verdict: "push" })} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("Edge")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Hit" })).toBeNull();
    expect(screen.queryByRole("img", { name: "Miss" })).toBeNull();
  });

  it("stars a prop from the table without opening it, and stores it on the account", async () => {
    render(<MemoryRouter><PropTable rows={[row]} win="l10" onWin={() => {}} bars soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));
    expect(screen.getByRole("button", { name: "Remove from watchlist" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(savedKeys()).toContain("prop:1:runs:39.5:1"));
  });

  it("opens sign-in instead of starring when logged out", () => {
    authState.user = null;
    render(<MemoryRouter><PropTable rows={[row]} win="l10" onWin={() => {}} bars soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));
    expect(authState.openSignIn).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add to watchlist" })).toHaveAttribute("aria-pressed", "false");
    expect(savedKeys()).toEqual([]);
  });

  it("shows one model-side price on the scan card (books live on the detail)", () => {
    const r = { ...row, side: "over", quotes: [{ source: "bet365", name: "bet365", line: 39.5, over: 1.85, under: 1.85, best: false }] };
    render(<MemoryRouter><PropLines rows={[r]} density="compact" soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("1.85")).toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
    expect(screen.getByText("39.5")).toBeInTheDocument();
    expect(screen.queryByText("bet365")).toBeNull();
    expect(screen.queryByRole("button", { name: /\+\d+ books?/ })).toBeNull();
  });

  it("leans Under when the model side is under", () => {
    const quotes = [{ source: "bet365", name: "bet365", line: 39.5, over: 1.83, under: 1.95, best: false }];
    render(<MemoryRouter><PropLines rows={[{ ...row, quotes, side: "under", under: 1.95, edge: 0.04 }]} density="compact" soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("U")).toBeInTheDocument();
    expect(screen.getByText("1.95")).toBeInTheDocument();
    expect(screen.queryByText(/^O$/)).toBeNull();
  });

  it("dense Lines has no multi-book / split-line strip (that lives on the dedicated page)", () => {
    const quotes = bookQuotes([
      { line: 39.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.85, under: 1.9 }] },
      { line: 42.5, books: [{ source: "Betfair", kind: "exchange", over: 1.95, under: 1.8 }] },
    ]);
    render(<MemoryRouter><PropLines rows={[{ ...row, quotes }]} density="dense" win="l10" onWin={() => {}} bars soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.queryByText("bet365")).toBeNull();
    expect(screen.queryByRole("button", { name: /\+\d+ books?/ })).toBeNull();
    expect(screen.queryByText(/O 42\.5|U 42\.5/)).toBeNull();
  });
});

describe("a live props row", () => {
  const liveQuotes = () => bookQuotes([{ line: 49.5, books: [{ source: "bet365", kind: "bookmaker", over: 2.2, under: 1.65, live: true, opened: 39.5 }] }]);

  it("Home PropRow + fixture PropLines: In play line, never per-player Live or Opened at", () => {
    const live = { ...row, line: 49.5, quotes: liveQuotes() };
    // Home: one interleaved PropRow list; fixture Props: HotProps → PropLines.
    render(
      <MemoryRouter>
        <ul><PropRow r={live} soFar={null} out={false} hideMatch /></ul>
        <PropLines rows={[live]} density="dense" win="l10" onWin={() => undefined} bars soFarOf={() => null} outOf={() => false} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("In play line").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.queryByText(/Opened at/)).toBeNull();
  });

  it("the card row keeps In play line, without so-far text, track, or Opened at", () => {
    render(<MemoryRouter><PropLines rows={[{ ...row, line: 49.5, quotes: liveQuotes() }]} density="compact" soFarOf={() => ({ v: 30, state: "live", verdict: null })} outOf={() => false} /></MemoryRouter>);
    expect(screen.queryByRole("img", { name: /30 of 49\.5/ })).toBeNull();
    expect(screen.queryByText(/30 so far/)).toBeNull();
    const title = screen.getByText("AM Tribe").closest("span.flex") as HTMLElement;
    expect(within(title).queryByText("Live")).toBeNull();
    expect(within(title).getByText("In play line")).toBeInTheDocument();
    expect(screen.queryByText(/Opened at/)).toBeNull();
  });

  it("no In play line when the line is still the pre-match price", () => {
    render(<MemoryRouter><PropLines rows={[row]} density="compact" soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.queryByText("In play line")).toBeNull();
    expect(screen.queryByText("Live")).toBeNull();
  });
});
