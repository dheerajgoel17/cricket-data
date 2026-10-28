import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bookQuotes } from "@/engine/lines.js";
import { BookQuotes } from "./hot-props";

const B = (source: string, over: number, under: number) => ({ source, kind: "bookmaker", over, under });

describe("BookQuotes (the per-book line and over price under a Hot props row)", () => {
  const quotes = bookQuotes([{ line: 17.5, books: [B("bet365", 1.833, 1.833)] }, { line: 14.5, books: [B("Ladbrokes", 1.83, 1.83)] }]);

  it("shows every book's name, line and over price, the lowest line first", () => {
    render(<BookQuotes quotes={quotes} />);
    const text = screen.getAllByText(/ O /).map((e) => e.textContent);
    expect(text).toEqual(["Ladbrokes O 14.5 1.83 (lowest line, best price)", "bet365 O 17.5 1.83"]);
  });

  it("marks the friendliest quote in the accent colour and for screen readers, and no other", () => {
    render(<BookQuotes quotes={quotes} />);
    expect(screen.getByText(/^Ladbrokes O 14.5/)).toHaveClass("text-primary", "font-semibold");
    expect(screen.getByText(/^bet365 O 17.5/)).not.toHaveClass("text-primary");
    expect(screen.getAllByText("(lowest line, best price)", { exact: false })).toHaveLength(1);
  });
});
