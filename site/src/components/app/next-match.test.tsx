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
    expect(screen.getByText(/In T20/)).toBeInTheDocument();
  });

  it("says when the books price a different line", () => {
    const other = { main: { line: 14.5 }, lines: [{ line: 14.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.9, under: 1.8 }] }] };
    render(<NextMatch next={next} entries={here} line={17.5} side="over" book={other} statLabel="Runs" fmt="T20" />);
    expect(screen.getByText(/Books price 14.5 on this match, not 17.5/)).toBeInTheDocument();
  });
});
