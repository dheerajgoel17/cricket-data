import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
import { AltLines } from "./alt-lines";

const lines = [
  { line: 21.5, main: true, hit: 0.538, books: [{ source: "bet365", over: 1.85, under: 1.85 }, { source: "dafabet", over: 1.87, under: 1.83 }] },
  { line: 23.5, hit: 0.4, books: [{ source: "bet365", over: 2.0, under: null }] },
];
const setup = (active = 21.5) => {
  const onPick = vi.fn(), onStep = vi.fn();
  render(<AltLines lines={lines} active={active} side="over" onPick={onPick} onStep={onStep} />);
  return { onPick, onStep };
};

describe("AltLines", () => {
  it("shows the chosen line big with its best price and book count, and one row per listed line", () => {
    setup();
    expect(screen.getAllByText("21.5").length).toBeGreaterThan(0);
    expect(screen.getByText("2 books")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use line 21.5" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Use line 23.5" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("On the chart")).toBeInTheDocument();
  });
  it("steps the line and picks a listed one", () => {
    const { onPick, onStep } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Raise the line" }));
    expect(onStep).toHaveBeenCalledWith(0.5);
    fireEvent.click(screen.getByRole("button", { name: "Use line 23.5" }));
    expect(onPick).toHaveBeenCalledWith(23.5);
  });
  it("says so when the chosen line is not listed instead of inventing a price, and a missing under is a dash", () => {
    setup(22.5);
    expect(screen.getByText(/No book lists 22.5/)).toBeInTheDocument();
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
  });
  it("opens the per-book prices of a line", () => {
    setup();
    expect(screen.queryAllByRole("columnheader").length).toBe(4); // the chosen line's table is open already
    fireEvent.click(screen.getByRole("button", { name: "Prices for 23.5" }));
    expect(screen.getAllByRole("table")).toHaveLength(2);
  });
});
