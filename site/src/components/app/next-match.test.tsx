import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextMatch } from "./next-match";

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

  it("shows the book prices on this line, and fair odds from the ground and the opponent (hand-computed 8/15 = 1.88, 3/7 = 2.33)", () => {
    render(<NextMatch next={next} entries={[...here, ...versus]} line={17.5} side="over" book={book} statLabel="Runs" fmt="T20" />);
    expect(screen.getByText("Sydney Sixers Women")).toBeInTheDocument();
    expect(screen.getByText(/Allan Border Field, Brisbane/)).toBeInTheDocument();
    expect(screen.getByText(/O 17.5/)).toBeInTheDocument();
    expect(screen.getAllByText("1.83").length).toBeGreaterThanOrEqual(2); // book over / under
    expect(screen.getByText("8 of 15")).toBeInTheDocument();
    expect(screen.getByText("fair 1.88")).toBeInTheDocument();
    expect(screen.getByText("3 of 7")).toBeInTheDocument();
    expect(screen.getByText("fair 2.33")).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "How to read this" })).toHaveTextContent(/T20 games he played on this line/);
  });

  it("says when the books price a different line", () => {
    const other = { main: { line: 14.5 }, lines: [{ line: 14.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.9, under: 1.8 }] }] };
    render(<NextMatch next={next} entries={here} line={17.5} side="over" book={other} statLabel="Runs" fmt="T20" />);
    expect(screen.getByText(/Books price 14.5 on this match, not 17.5/)).toBeInTheDocument();
  });

  it("does not invent a median line when no book prices this match", () => {
    const entries = [{ value: 30, venueName: "SCG", opp: "Sydney Sixers" }];
    render(<NextMatch next={next} entries={entries} line={17.5} side="over" book={null} statLabel="Wickets" fmt="ODI" />);
    expect(screen.queryByText("bet365")).not.toBeInTheDocument();
    expect(screen.queryByText(/O 17.5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 of 1/)).not.toBeInTheDocument();
    expect(screen.getByText("No props live yet")).toBeInTheDocument();
    expect(screen.getByText("Sydney Sixers Women")).toBeInTheDocument();
  });

  it("keeps the listed line after the match and says whether it cleared", () => {
    render(<NextMatch next={{ ...next, phase: "final", priced: true }} entries={here} line={17.5} side="over" book={book} statLabel="Runs" fmt="T20"
      standing={{ v: 31, state: "final", verdict: "cleared" }} />);
    expect(screen.getByText("This match")).toBeInTheDocument();
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
    expect(screen.getByText(/5\.5 to go/)).toBeInTheDocument();
  });
});
