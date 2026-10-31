import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PropRow, PropTable } from "./hot-props";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
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
    expect(screen.getByText("Odds")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "H2H" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ground" })).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
    expect(screen.queryByText("DVP")).toBeNull();
    expect(screen.queryByText("MATCHUP")).toBeNull();
    expect(screen.getByText("AM Tribe")).toBeInTheDocument();
    expect(screen.getByText("1.85")).toBeInTheDocument();
    expect(screen.getByText("+5.1")).toBeInTheDocument();
    expect(screen.getByText("Wankhede")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "H2H" }));
    expect(onWin).toHaveBeenCalledWith("h2h");
  });

  it("uses a short stadium name on the prop card, full venue on the title", () => {
    const r = { ...row, venue: "Western Australia Cricket Association Ground, Perth", ven: window(0.2, 5), l10: window(0.7, 10) };
    render(<MemoryRouter><ul><PropRow r={r} win="l10" wl="L10" bars i={0} soFar={null} out={false} /></ul></MemoryRouter>);
    expect(screen.getByText("7 in L10")).toBeInTheDocument();
    const chip = screen.getByTitle("Western Australia Cricket Association Ground, Perth");
    expect(chip).toHaveTextContent("1/5 at WACA");
    expect(screen.queryByText(/Western Australia Cricket Association Ground/)).toBeNull();
    expect(screen.getByRole("button", { name: "Add to watchlist" })).toBeInTheDocument(); // the star sits beside the row link, never inside it
    expect(screen.getByRole("button", { name: "Add to watchlist" }).closest("a")).toBeNull();
  });

  it("stars a prop without opening it, and the star survives a reload of the saved list", () => {
    localStorage.clear();
    render(<MemoryRouter><ul><PropRow r={row} win="l10" wl="L10" bars i={0} soFar={null} out={false} /></ul></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));
    expect(screen.getByRole("button", { name: "Remove from watchlist" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem("cph-saved") || "[]")).toContain("prop:1:runs:39.5:1");
  });

  it("puts the bookmaker mark on the third row of the prop card, even when only one book prices the line", () => {
    const r = { ...row, quotes: [{ source: "bet365", name: "bet365", line: 39.5, over: 1.85, under: 1.85, best: false }] };
    render(<MemoryRouter><ul><PropRow r={r} win="l10" wl="L10" bars i={0} soFar={null} out={false} /></ul></MemoryRouter>);
    expect(screen.getByText("bet365")).toBeInTheDocument();
    expect(screen.getByText("bet365").closest("[data-slot=item-description]")).toBeNull();
    expect(document.querySelector("[data-slot=item-description]")).not.toHaveTextContent("bet365");
  });

  it("shows the book's mark when only one book prices the line, and has no +N books toggle", () => {
    const one = { ...row, quotes: [{ source: "bet365", name: "bet365", line: 39.5, over: 1.85, under: 1.85, best: false }] };
    render(<MemoryRouter><PropTable rows={[one]} win="l10" onWin={() => {}} bars soFarOf={() => null} outOf={() => false} /></MemoryRouter>);
    expect(screen.getByText("bet365")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+\d+ books?/ })).toBeNull();
  });
});
