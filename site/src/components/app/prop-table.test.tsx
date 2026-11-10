import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { bookQuotes } from "@cricket/engine/lines.js";
import { authState, savedKeys } from "@/test/auth-harness";
import { PropRow, PropTable } from "./hot-props";

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
  edge: 0.051, last: [{ v: 53, s: "hit" }, { v: 12, s: "miss" }], max: 80,
};

describe("PropTable", () => {
  it("shows cricket columns, not a copy of another sport's sheet, and ranks from a header click", () => {
    const onWin = vi.fn();
    render(<MemoryRouter><PropTable rows={[row]} win="l10" onWin={onWin} bars soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("Lines")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /L10 chart/ })).toBeInTheDocument();
    expect(screen.getByText("Over / under")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "H2H" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ground" })).toBeInTheDocument();
    expect(screen.getByText("Model edge")).toBeInTheDocument();
    expect(screen.queryByText("DVP")).toBeNull();
    expect(screen.queryByText("MATCHUP")).toBeNull();
    expect(screen.getByText("AM Tribe")).toBeInTheDocument();
    expect(screen.getByText("1.85")).toBeInTheDocument();
    expect(screen.getByText("+5.1")).toBeInTheDocument();
    expect(screen.getByText("Wankhede")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "H2H" }));
    expect(onWin).toHaveBeenCalledWith("h2h");
  });

  it("shows the same score, history and fallback states in the card and table", () => {
    const live = { ...row, line: 40, quotes: [{ source: "book", name: "Book", line: 40, over: 1.85, under: 1.95, live: true }] };
    const renderRows = (standing: Parameters<typeof PropRow>[0]["soFar"], out = false) => (
      <MemoryRouter>
        <ul><PropRow r={live} win="l10" wl="L10" i={0} soFar={standing} out={out} /></ul>
        <PropTable rows={[live]} win="l10" onWin={() => {}} bars={false} soFarOf={() => standing} outOf={() => out} />
      </MemoryRouter>
    );
    const { rerender } = render(renderRows({ v: 32, state: "live", verdict: null }));
    expect(screen.getAllByText(/32 so far/)).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: "32 of 40" })).toHaveLength(2);
    expect(screen.getAllByText("Similar in-play lines")).toHaveLength(2);
    rerender(renderRows(null));
    expect(screen.getAllByText("Score unavailable")).toHaveLength(2);
    rerender(renderRows({ v: 40, state: "final", verdict: "push" }));
    expect(screen.getAllByText(/40 final · On the line/)).toHaveLength(2);
    expect(screen.queryByText("Similar in-play lines")).toBeNull();
    expect(screen.queryByRole("img", { name: "40 of 40" })).toBeNull();
    rerender(renderRows(null, true));
    expect(screen.getAllByText("Not in XI")).toHaveLength(2);
    expect(screen.queryByText("Score unavailable")).toBeNull();
  });

  it("uses a short stadium name on the prop card, full venue on the title", () => {
    const r = { ...row, venue: "Western Australia Cricket Association Ground, Perth", ven: window(0.2, 5), l10: window(0.7, 10) };
    render(<MemoryRouter><ul><PropRow r={r} win="l10" wl="L10" i={0} soFar={null} out={false} /></ul></MemoryRouter>);
    expect(screen.getByText("7 in L10")).toBeInTheDocument();
    const chip = screen.getByTitle("Western Australia Cricket Association Ground, Perth");
    expect(chip).toHaveTextContent("1/5 at WACA");
    expect(screen.queryByText(/Western Australia Cricket Association Ground/)).toBeNull();
    expect(screen.getByRole("button", { name: "Add to watchlist" })).toBeInTheDocument(); // the star sits beside the row link, never inside it
    expect(screen.getByRole("button", { name: "Add to watchlist" }).closest("a")).toBeNull();
  });

  it("stars a prop without opening it, and stores it on the account", async () => {
    render(<MemoryRouter><ul><PropRow r={row} win="l10" wl="L10" i={0} soFar={null} out={false} /></ul></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));
    expect(screen.getByRole("button", { name: "Remove from watchlist" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(savedKeys()).toContain("prop:1:runs:39.5:1"));
  });

  it("opens sign-in instead of starring when logged out", () => {
    authState.user = null;
    render(<MemoryRouter><ul><PropRow r={row} win="l10" wl="L10" i={0} soFar={null} out={false} /></ul></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));
    expect(authState.openSignIn).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add to watchlist" })).toHaveAttribute("aria-pressed", "false");
    expect(savedKeys()).toEqual([]);
  });

  it("puts the bookmaker mark under the line, even when only one book prices the line", () => {
    const r = { ...row, quotes: [{ source: "bet365", name: "bet365", line: 39.5, over: 1.85, under: 1.85, best: false }] };
    render(<MemoryRouter><ul><PropRow r={r} win="l10" wl="L10" i={0} soFar={null} out={false} /></ul></MemoryRouter>);
    expect(screen.getByText("bet365")).toBeInTheDocument();
    expect(screen.getByText("bet365").closest("a")).toBeTruthy();
  });

  it("shows the book's mark when only one book prices the line, and has no +N books toggle", () => {
    const one = { ...row, quotes: [{ source: "bet365", name: "bet365", line: 39.5, over: 1.85, under: 1.85, best: false }] };
    render(<MemoryRouter><PropTable rows={[one]} win="l10" onWin={() => {}} bars soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("bet365")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+\d+ books?/ })).toBeNull();
  });
});

describe("a live props row", () => {
  it("has the Live mark beside the player's name, and was-39.5 on the quote line", () => {
    const quotes = bookQuotes([{ line: 49.5, books: [{ source: "bet365", kind: "bookmaker", over: 2.2, under: 1.65, live: true, opened: 39.5 }] }]);
    render(<MemoryRouter><PropTable rows={[{ ...row, line: 49.5, quotes }]} win="l10" onWin={() => undefined} bars soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    const name = screen.getAllByText("AM Tribe")[0];
    expect(within(name.parentElement!.parentElement as HTMLElement).getByText("Live")).toBeInTheDocument(); // on the name line
    expect(screen.getAllByText("Live")).toHaveLength(1);
    expect(screen.getByText("was 39.5")).toBeInTheDocument();
  });

  it("the card row has the same: the mark beside the name, was-39.5 on the quote line", () => {
    const quotes = bookQuotes([{ line: 49.5, books: [{ source: "bet365", kind: "bookmaker", over: 2.2, under: 1.65, live: true, opened: 39.5 }] }]);
    render(<MemoryRouter><ul><PropRow r={{ ...row, line: 49.5, quotes }} win="l10" wl="L10" i={0} soFar={{ v: 30, state: "live", verdict: null }} out={false} /></ul></MemoryRouter>);
    expect(screen.getByRole("img", { name: "30 of 49.5, was 39.5" })).toBeInTheDocument(); // the bar under the quote
    expect(screen.getAllByText("Live")).toHaveLength(1);
    expect(within(screen.getByText("AM Tribe").closest("span.flex") as HTMLElement).getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("was 39.5")).toBeInTheDocument();
  });
});
