import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bookQuotes } from "@/engine/lines.js";
import { BookQuotes } from "./hot-props";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined })); // no logo files: each book shows as its name, so the strip can be read as text

const B = (source: string, over: number, under: number) => ({ source, kind: "bookmaker", over, under });

describe("BookQuotes (the per-book line and over price under a Hot props row)", () => {
  const quotes = bookQuotes([{ line: 17.5, books: [B("bet365", 1.833, 1.833)] }, { line: 14.5, books: [B("Ladbrokes", 1.83, 1.83)] }]);

  const chips = (c: HTMLElement) => [...c.querySelectorAll("[data-book]")].map((e) => e.parentElement!.textContent);

  it("shows every book's name, line and over price, the lowest line first", () => {
    const { container } = render(<BookQuotes quotes={quotes} />);
    expect(chips(container)).toEqual(["Ladbrokes O 14.5 1.83 (lowest line, best price)", "bet365 O 17.5 1.83"]);
  });

  it("marks the friendliest quote in the accent colour and for screen readers, and no other", () => {
    const { container } = render(<BookQuotes quotes={quotes} />);
    const [best, other] = [...container.querySelectorAll("[data-book]")].map((e) => e.parentElement!);
    expect(best).toHaveClass("text-primary", "font-semibold");
    expect(other).not.toHaveClass("text-primary");
    expect(screen.getAllByText("(lowest line, best price)", { exact: false })).toHaveLength(1);
  });
});
