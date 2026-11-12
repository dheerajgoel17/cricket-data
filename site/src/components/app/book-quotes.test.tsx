import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bookQuotes } from "@cricket/engine/lines.js";
import { BookQuotes } from "./hot-props";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined })); // no logo files: each book shows as its name, so the strip can be read as text

const B = (source: string, over: number, under: number) => ({ source, kind: "bookmaker", over, under });

describe("BookQuotes (per-side books under a Hot props row)", () => {
  const quotes = bookQuotes([{ line: 17.5, books: [B("bet365", 1.833, 1.833)] }, { line: 14.5, books: [B("Ladbrokes", 1.83, 1.83)] }]);

  it("shows Over and Under each with their face book, and the other books behind +N", () => {
    render(<BookQuotes quotes={quotes} />);
    expect(screen.getByText(/^O/)).toBeInTheDocument();
    expect(screen.getByText(/^U/)).toBeInTheDocument();
    expect(screen.getAllByText(/Ladbrokes|bet365/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /\+\d+ books?/ }));
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("has no toggle when one book prices both sides, but still shows that book's mark and price", () => {
    render(<BookQuotes quotes={bookQuotes([{ line: 17.5, books: [B("bet365", 1.833, 1.833)] }])} />);
    expect(screen.getAllByText(/bet365/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /\+\d+ books?/ })).toBeNull();
  });

  it("rolls the new price in place without flashing the background", () => {
    const live = (price: number) => bookQuotes([{ line: 33.5, books: [{ ...B("bet365", price, 1.9), live: true }] }]);
    const { rerender } = render(<BookQuotes quotes={live(1.8)} />);
    const ticker = screen.getByText("1.80").parentElement!.parentElement!;
    expect(ticker.querySelector("[aria-hidden]")).toBeEmptyDOMElement();
    rerender(<BookQuotes quotes={live(2.1)} />);
    const price = screen.getByText("2.10");
    expect(ticker).toContainElement(price);
    expect(price).toHaveClass("ticker-roll-up");
    expect(ticker.querySelector("[aria-hidden]")).toHaveTextContent("▲");
    expect(ticker.className).not.toMatch(/tick-(up|down)/);
  });

  it("a live quote has no Live mark in the strip (the row's name carries it); where the line stood before the match is a short \"was 25.5\"", () => {
    const live = bookQuotes([{ line: 33.5, books: [{ ...B("bet365", 1.8, 1.9), live: true, opened: 25.5 }] }]);
    render(<BookQuotes quotes={live} />);
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.getByText("was 25.5")).toBeInTheDocument();
  });
});
