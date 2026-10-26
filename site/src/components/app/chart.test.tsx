import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartBars } from "./chart";

const entries = [
  { date: "2026-05-01", opp: "Mumbai Indians", value: 43, aux: 30 },
  { date: "2026-05-05", opp: "Chennai Super Kings", value: 12, aux: 10 },
  { date: "2026-05-09", opp: "Delhi Capitals", value: null },                 // DNP
  { date: "2026-05-13", opp: "Gujarat Titans", value: null, void: true },     // in the XI, never batted
  { date: "2026-05-17", opp: "Punjab Kings", value: 28.5, aux: 20 },          // exactly on the line: push
];

describe("ChartBars", () => {
  it("draws one column per fixture with an accessible description of each", () => {
    render(<ChartBars entries={entries} line={28.5} side="over" label="Runs over 28.5" />);
    expect(screen.getByLabelText("Runs over 28.5")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByLabelText(/2026-05-13 v Gujarat Titans · in the XI, did not bat\/bowl: bet void/)).toBeInTheDocument();
    expect(screen.getByLabelText(/2026-05-09 v Delhi Capitals · not in the XI/)).toBeInTheDocument();
  });
  it("shows played values on the bars and the line value on the line", () => {
    render(<ChartBars entries={entries} line={28.5} side="over" />);
    expect(screen.getAllByText("43").length).toBeGreaterThan(0); // the bar label (and the top axis tick)
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("28.5").length).toBeGreaterThan(0);
  });
  it("calls onSelect with the fixture and its state", () => {
    const picked: string[] = [];
    render(<ChartBars entries={entries} line={28.5} side="over" onSelect={(_e, s) => picked.push(s)} />);
    screen.getAllByRole("button").forEach((b) => b.click());
    expect(picked).toEqual(["hit", "miss", "dnp", "void", "push"]);
  });
});
