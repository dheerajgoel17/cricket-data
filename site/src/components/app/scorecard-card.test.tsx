import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ScorecardCard } from "./live-board";

vi.mock("@/lib/data", () => ({ useData: () => ({ rz: { players: () => [] } }) }));

const inn = { n: 1, team: "Pakistan", runs: 281, wkts: 5, overs: 67.2, extras: { total: 13 }, fow: [], yetToBat: [],
  batters: [
    { id: "a", name: "Azan Awais", runs: 30, balls: 50, fours: 7, sixes: 0, out: true, dismissal: "c Mendis b Rathnayake" },
    { id: "b", name: "Saud Shakeel", runs: 57, balls: 112, fours: 7, sixes: 0, out: false, dismissal: "not out" },
    { id: "c", name: "Babar Azam", runs: 50, balls: 58, fours: 7, sixes: 0, out: true, dismissal: "c Mendis b Madushanka" },
  ],
  bowlers: [
    { id: "d", name: "Asitha Fernando", overs: 15.2, maidens: 1, conceded: 64, wickets: 2, econ: 4.17 },
    { id: "e", name: "Milan Rathnayake", overs: 12, maidens: 0, conceded: 40, wickets: 1, econ: 3.33 },
  ] };
const match = { card: [inn], teams: [], players: [] };

describe("ScorecardCard", () => {
  it("shows the score with the two best batters and the best bowler, and opens the full card on a tap", () => {
    render(<MemoryRouter><ScorecardCard match={match} inPlay={false} fixtureId="x" /></MemoryRouter>);
    expect(screen.getByText("281/5 67.2 ov")).toBeInTheDocument();
    expect(screen.getByText(/Shakeel/).parentElement).toHaveTextContent("Shakeel 57 (112) · Azam 50 (58)"); // best two, by runs
    expect(screen.getByText(/Fernando/).parentElement).toHaveTextContent("Fernando 2–64 (15.2)");
    expect(screen.queryByText("Batter")).toBeNull(); // the full table is closed
    const toggle = screen.getByRole("button", { name: "Full scorecard" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide scorecard" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Pakistan" })).toBeInTheDocument();
    expect(screen.getByText("Run rate")).toHaveTextContent("4.17");
    expect(screen.getByRole("table", { name: "Batting" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Bowling" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open as a page" })).toHaveAttribute("href", "/fixture/x/scorecard");
  });

  it("keeps the current players and deliveries visible and expands the match details on demand", () => {
    const live = { ...match, teams: [{ name: "Pakistan", batting: true }], crr: 4.17, thisOver: ["4", "0"], players: [
      { name: "Saud Shakeel", team: "Pakistan", runs: 57, balls: 112, strike: true },
      { name: "Ghori", team: "Pakistan", runs: 7, balls: 10 },
      { name: "Asitha Fernando", team: "Sri Lanka", wickets: 2, conceded: 64, ballsBowled: 92, current: true },
    ] };
    render(<MemoryRouter><ScorecardCard match={live} inPlay top={<span>Live Test</span>} head={<span>Pakistan 281/5</span>} /></MemoryRouter>);
    expect(screen.getByText("Pakistan 281/5")).toBeInTheDocument();
    expect(screen.getByText("Shakeel")).toBeInTheDocument();
    expect(screen.getByText("2–64")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ball by ball/)).toBeInTheDocument();
    expect(screen.queryByText("CRR")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Full scorecard" }));
    expect(screen.getByText("CRR")).toBeInTheDocument();
  });

  it("renders nothing with no card and no live strip", () => {
    const { container } = render(<MemoryRouter><ScorecardCard match={{}} inPlay /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
