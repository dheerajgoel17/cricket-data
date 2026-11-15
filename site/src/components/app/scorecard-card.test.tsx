import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LiveBoard, ScorecardAccordion, ScorecardBody } from "./live-board";

Element.prototype.scrollTo = () => {}; // jsdom has none; segmented PillGroup scrolls the active tab into view

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

  it("shows bowler + batters in the strip; full scorecard has no partnership / CRR strip", () => {
    const live = { ...match, teams: [{ name: "Pakistan", batting: true }], crr: 4.17, overs: [{ n: 1, balls: ["W", "0", "4"] }], players: [
      { name: "Saud Shakeel", team: "Pakistan", runs: 57, balls: 112, strike: true },
      { name: "Ghori", team: "Pakistan", runs: 7, balls: 10 },
      { name: "Asitha Fernando", team: "Sri Lanka", wickets: 2, conceded: 64, ballsBowled: 92, current: true },
    ] };
    render(<MemoryRouter><LiveBoard match={live} /><ScorecardAccordion match={live} inPlay /></MemoryRouter>);
    expect(screen.getByText("S Shakeel")).toBeInTheDocument();
    expect(screen.getByText("15.2-64-2")).toBeInTheDocument();
    expect(screen.getByLabelText(/This over/)).toBeInTheDocument();
    expect(screen.queryByText("CRR")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Full scorecard" }));
    expect(screen.queryByText("CRR")).toBeNull();
    expect(screen.queryByText(/P.?ship/i)).toBeNull();
    expect(screen.getByText("Batter")).toBeInTheDocument();
  });

  it("switches innings with segmented team categories like the market tape", () => {
    const second = { ...inn, n: 2, team: "Sri Lanka", runs: 120, wkts: 3, overs: 30,
      batters: [{ id: "f", name: "Kusal Mendis", runs: 40, balls: 55, fours: 4, sixes: 0, out: false, dismissal: "not out" }],
      bowlers: [{ id: "g", name: "Shaheen Afridi", overs: 8, maidens: 1, conceded: 28, wickets: 1, econ: 3.5 }],
    };
    render(<MemoryRouter><ScorecardBody match={{ ...match, card: [inn, second] }} /></MemoryRouter>);
    expect(screen.getByRole("radio", { name: /PAK · 281/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /SL · 120/ })).toBeInTheDocument();
    // Defaults to the latest innings (tape-style category).
    expect(screen.getByText("Kusal Mendis")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /PAK · 281/ }));
    expect(screen.getByText("Saud Shakeel")).toBeInTheDocument();
  });

  it("renders no live strip when live details are unavailable", () => {
    const { container } = render(<MemoryRouter><LiveBoard match={{}} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
