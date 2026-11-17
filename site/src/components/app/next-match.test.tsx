import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MatchupRates, NextMatch, UnpricedNote, whenLabel } from "./next-match";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined, bookVariant: () => "" }));
vi.mock("@/lib/data", () => ({ useData: () => ({ photos: { teams: {}, flags: {} } }) }));
vi.mock("@/lib/analytics", () => ({ track: () => {} }));

const next = {
  match: "Brisbane Heat Women vs Sydney Sixers Women",
  start: "2026-10-30T08:10:00Z",
  competition: "T20 Big Bash Women",
  team: "Brisbane Heat Women",
  opp: "Sydney Sixers Women",
  ground: "Allan Border Field, Brisbane",
  known: "Allan Border Field",
};

describe("NextMatch", () => {
  const here = [...Array(8).fill(18), ...Array(7).fill(10)].map((value) => ({ value, venueName: "Allan Border Field", opp: "Perth Scorchers" }));
  const versus = [...Array(3).fill(25), ...Array(4).fill(5)].map((value) => ({ value, venueName: "SCG", opp: "Sydney Sixers" }));
  const book = { main: { line: 17.5 }, lines: [{ line: 17.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.833, under: 1.833 }] }] };

  it("names the match as one strip (vs opponent, date and ground) and keeps rates out of the card", () => {
    render(<NextMatch next={next} entries={[...here, ...versus]} line={17.5} side="over" book={book} statLabel="Runs" fmt="T20" />);
    expect(screen.getByText("vs")).toBeInTheDocument(); // then the crest, then the short name
    expect(screen.getByText(new RegExp(`on ${whenLabel(next.start)}`))).toBeInTheDocument();
    expect(screen.queryByText(/fair/)).not.toBeInTheDocument();
  });

  it("shows ground/opponent hit rates in their own section (hand-computed 8/15 = 1.88, 3/7 = 2.33), no book prices", () => {
    render(<MatchupRates next={next} entries={[...here, ...versus]} line={17.5} side="over" />);
    expect(screen.getByText("At Allan Border Field")).toBeInTheDocument();
    expect(screen.queryByText("bet365")).not.toBeInTheDocument();
    expect(screen.queryByText("1.83")).not.toBeInTheDocument();
    expect(screen.getByText(/8\/15/)).toBeInTheDocument();
    expect(screen.getByText(/fair 1.88/)).toBeInTheDocument();
    expect(screen.getByText(/3\/7/)).toBeInTheDocument();
    expect(screen.getByText(/fair 2.33/)).toBeInTheDocument();
  });

  it("states that no book is offering odds for this stat", () => {
    render(<UnpricedNote statLabel="Sixes" />);
    expect(screen.getByRole("status")).toHaveTextContent("No book is offering odds for Sixes on this match");
    expect(screen.getByRole("status")).toHaveTextContent("not a listed market");
  });

  it("says no book is offering this stat, and still shows history rates (hand-computed 1/1 = fair 1.00)", () => {
    const entries = [{ value: 30, venueName: "Allan Border Field", opp: "Sydney Sixers Women" }];
    render(<><NextMatch next={next} line={17.5} side="over" book={null} statLabel="Wickets" fmt="ODI" /><MatchupRates next={next} entries={entries} line={17.5} side="over" /></>);
    expect(screen.queryByText("bet365")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No listed odds");
    expect(screen.getByRole("status")).toHaveTextContent("no book is offering Wickets on this match");
    expect(screen.getAllByText(/1\/1/).length).toBe(2);
    expect(screen.getAllByText(/fair 1.00/).length).toBe(2);
    expect(screen.queryByText("No props live yet")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Sydney Sixers Women/).length).toBeGreaterThan(0);
  });

  it("links the strip to the fixture page when the schedule lists the match", () => {
    render(<MemoryRouter><NextMatch next={{ ...next, id: "abc-123" }} line={17.5} side="over" book={book} statLabel="Runs" /></MemoryRouter>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/fixture/abc-123");
  });

  it("shows Live in place of the time while the match is on", () => {
    render(<NextMatch next={{ ...next, phase: "live" }} line={17.5} side="over" book={book} statLabel="Runs" />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
    expect(screen.queryByText(/ on /)).not.toBeInTheDocument();
  });

  it("keeps the listed line after the match and says whether it cleared", () => {
    render(<NextMatch next={{ ...next, phase: "final", priced: true }} entries={here} line={17.5} side="over" book={book} statLabel="Runs" fmt="T20"
      standing={{ v: 31, state: "final", verdict: "cleared" }} />);
    expect(screen.getByRole("region", { name: "This match" })).toBeInTheDocument();
    expect(screen.getByText(/O 17.5/)).toBeInTheDocument();
    expect(screen.getByText(/31 final/)).toBeInTheDocument();
    expect(screen.getByText(/Cleared/)).toBeInTheDocument();
    expect(screen.queryByText("No props live yet")).not.toBeInTheDocument();
  });

  it("says Not in XI when the settled line rules her out", () => {
    render(<NextMatch next={{ ...next, phase: "final", priced: true }} entries={here} line={17.5} side="over" book={book} statLabel="Runs" fmt="T20" out />);
    expect(screen.getByText("Not in XI")).toBeInTheDocument();
  });

  it("tracks a live line against the scorecard: so far and how many to go (hand-computed 12 of 17.5 is 5.5)", () => {
    render(<NextMatch next={{ ...next, phase: "live", priced: true }} entries={here} line={17.5} side="over" book={book} statLabel="Runs" fmt="T20"
      standing={{ v: 12, state: "live", verdict: null }} />);
    expect(screen.getByText(/12 so far/)).toBeInTheDocument();
  });
});
