import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
import { OddsTable } from "./odds-table";

const lines = [
  { line: 21.5, main: true, mkt: 0.497, hit: 0.538, books: [{ source: "bet365", over: 1.85, under: 1.85 }, { source: "dafabet", over: 1.87, under: 1.83 }] },
  { line: 23.5, books: [{ source: "bet365", over: 2.0, under: null }] },
];

describe("OddsTable", () => {
  it("shows one row per book under Line / Book / Over / Under, grouped by line", () => {
    render(<OddsTable lines={lines} />);
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["Line", "Book", "Over", "Under"]);
    expect(screen.getAllByRole("row")).toHaveLength(1 + 3); // header + three book rows
    expect(screen.getByText("main")).toBeInTheDocument();
  });
  it("marks the best price of each side when several books quote the same line, and a missing price as a dash", () => {
    render(<OddsTable lines={lines} />);
    expect(screen.getByText("1.87").closest("td")).toHaveClass("text-primary");
    expect(screen.getByText("1.85", { selector: "td:nth-of-type(3) *, td:nth-of-type(3)" })).toBeInTheDocument();
    expect(within(screen.getAllByRole("row")[3]).getAllByRole("cell").some((c) => c.textContent === "–")).toBe(true);
  });
  it("adds market and hit columns, and picks a line from its row", () => {
    const onPick = vi.fn();
    render(<OddsTable lines={lines} stats active={21.5} onPick={onPick} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Line", "Book", "Over", "Under", "Mkt", "Hit"]);
    fireEvent.click(screen.getByRole("button", { name: "Use line 23.5" }));
    expect(onPick).toHaveBeenCalledWith(23.5);
    expect(screen.getByRole("button", { name: "Use line 21.5" })).toHaveAttribute("aria-pressed", "true");
  });
});
