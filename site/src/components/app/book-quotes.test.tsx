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
    expect(chips(container)).toEqual(["Ladbrokes O 14.5 1.83 (lowest line, best price)"]);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+1 book" }));
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
    expect([...screen.getByRole("table").querySelectorAll("tbody td")].map((c) => c.textContent)).toEqual(["bet365", "17.5", "1.83", "1.83"]);
  });

  it("marks the friendliest quote in the accent colour and for screen readers, and no other", () => {
    const { container } = render(<BookQuotes quotes={quotes} />);
    const [best] = [...container.querySelectorAll("[data-book]")].map((e) => e.parentElement!);
    expect(best).toHaveClass("text-primary", "font-semibold");
    expect(screen.getAllByText("(lowest line, best price)", { exact: false })).toHaveLength(1);
  });

  it("has no toggle when one book prices the line, but still shows that book's mark and price", () => {
    render(<BookQuotes quotes={bookQuotes([{ line: 17.5, books: [B("bet365", 1.833, 1.833)] }])} />);
    expect(screen.getByText(/bet365/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
