import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bookQuotes } from "@cricket/engine/lines.js";
import { BookQuotes } from "./hot-props";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined })); // no logo files: each book shows as its name, so the strip can be read as text

const B = (source: string, over: number, under: number) => ({ source, kind: "bookmaker", over, under });

describe("BookQuotes (the per-book line and over price under a Hot props row)", () => {
  const quotes = bookQuotes([{ line: 17.5, books: [B("bet365", 1.833, 1.833)] }, { line: 14.5, books: [B("Ladbrokes", 1.83, 1.83)] }]);

  const chips = (c: HTMLElement) => [...c.querySelectorAll("[data-book]")].map((e) => e.parentElement!.textContent);

  it("shows the best quote up front and the other books in a table behind a toggle, with their line, over and under", () => {
    const { container } = render(<BookQuotes quotes={quotes} />);
    expect(chips(container)).toEqual(["Ladbrokes O 14.5 1.83 · U 1.83 (lowest line, best price)"]);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+1 book" }));
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
    expect([...screen.getByRole("table").querySelectorAll("tbody td")].map((c) => c.textContent)).toEqual(["bet365", "17.5", "1.83", "1.83"]);
  });

  it("marks the friendliest quote in the accent colour and for screen readers, and no other", () => {
    const { container } = render(<BookQuotes quotes={quotes} />);
    const [best] = [...container.querySelectorAll("[data-book]")].map((e) => e.parentElement!);
    expect(best).toHaveClass("text-primary", "font-medium");
    expect(screen.getAllByText("(lowest line, best price)", { exact: false })).toHaveLength(1);
  });

  it("has no toggle when one book prices the line, but still shows that book's mark and price", () => {
    render(<BookQuotes quotes={bookQuotes([{ line: 17.5, books: [B("bet365", 1.833, 1.833)] }])} />);
    expect(screen.getByText(/bet365/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("updates a live price with a steady arrow and no flashing background", () => {
    const live = (price: number) => bookQuotes([{ line: 33.5, books: [{ ...B("bet365", price, 1.9), live: true }] }]);
    const { rerender } = render(<BookQuotes quotes={live(1.8)} />);
    const ticker = screen.getByText("1.80");
    expect(ticker.querySelector("svg")).toHaveClass("invisible");
    rerender(<BookQuotes quotes={live(2.1)} />);
    expect(screen.getByText("2.10")).toBe(ticker);
    expect(ticker.querySelector("svg")).not.toHaveClass("invisible");
    expect(ticker.className).not.toMatch(/tick-(up|down)/);
  });

  it("a live quote has no Live mark in the strip (the row's name carries it); where the line stood before the match is a short \"was 25.5\" at the end of it", () => {
    const live = bookQuotes([{ line: 33.5, books: [{ ...B("bet365", 1.8, 1.9), live: true, opened: 25.5 }] }]);
    const { container } = render(<BookQuotes quotes={live} />);
    expect(screen.queryByText("Live")).toBeNull();
    const note = screen.getByText("was 25.5");
    expect(note.previousElementSibling).toContainElement(container.querySelector("[data-book]") as HTMLElement); // on the quote's own line, after the prices
  });
});
