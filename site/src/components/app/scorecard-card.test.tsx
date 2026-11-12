import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LiveBoard, ScorecardAccordion, ScorecardBody } from "./live-board";

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

describe("Fixture scorecard", () => {
  it("opens and closes the innings tables inline without repeating totals while collapsed", () => {
    render(<MemoryRouter><ScorecardAccordion match={match} /></MemoryRouter>);
    const toggle = screen.getByRole("button", { name: "Full scorecard" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/281/)).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide scorecard" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("table")).toHaveLength(2);
    fireEvent.click(toggle);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps batting and bowling on the full innings page", () => {
    render(<MemoryRouter><ScorecardBody match={match} /></MemoryRouter>);
    expect(screen.getByText("Batter")).toBeInTheDocument();
    expect(screen.getByText("Bowler")).toBeInTheDocument();
    expect(screen.getByText("c Mendis b Rathnayake")).toBeInTheDocument();
  });

  it("shows current players, deliveries and run rates in the live strip", () => {
    const live = { ...match, teams: [{ name: "Pakistan", batting: true }], crr: 4.17, thisOver: ["4", "0"], players: [
      { name: "Saud Shakeel", team: "Pakistan", runs: 57, balls: 112, strike: true },
      { name: "Ghori", team: "Pakistan", runs: 7, balls: 10 },
      { name: "Asitha Fernando", team: "Sri Lanka", wickets: 2, conceded: 64, ballsBowled: 92, current: true },
    ] };
    render(<MemoryRouter><LiveBoard match={live} /></MemoryRouter>);
    expect(screen.getByText("Shakeel")).toBeInTheDocument();
    expect(screen.getByText("2–64")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ball by ball/)).toBeInTheDocument();
    expect(screen.getByText("CRR")).toBeInTheDocument();
  });

  it("renders no live strip when live details are unavailable", () => {
    const { container } = render(<MemoryRouter><LiveBoard match={{}} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
