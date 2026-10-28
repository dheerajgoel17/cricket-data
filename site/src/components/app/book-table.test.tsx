import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookTable } from "./book-table";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined })); // no logo files: each book shows as its name

const books = [{ source: "bet365", over: 1.8, under: 1.95 }, { source: "Ladbrokes", over: 1.83, under: 1.91 }, { source: "smarkets", over: 1.85, under: 1.9 }];

describe("BookTable (the books not shown up front on a fancy line)", () => {
  it("counts only the books that are not shown, and opens a table of their over and under prices", () => {
    render(<BookTable books={books} shown={["Ladbrokes", "bet365"]} />);
    fireEvent.click(screen.getByRole("button", { name: "+1 book" }));
    expect([...screen.getByRole("table").querySelectorAll("tbody td")].map((c) => c.textContent)).toEqual(["Smarkets", "1.85", "1.90"]);
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
  });
  it("renders nothing when every book is already shown", () => {
    const { container } = render(<BookTable books={books.slice(0, 2)} shown={["bet365", "Ladbrokes"]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
