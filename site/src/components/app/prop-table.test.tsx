import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PropTable } from "./hot-props";

vi.mock("./badges", () => ({
  PlayerBadge: () => <span>pic</span>,
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
    expect(screen.getByText("Wankhede Stadium")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "H2H" }));
    expect(onWin).toHaveBeenCalledWith("h2h");
  });
});
