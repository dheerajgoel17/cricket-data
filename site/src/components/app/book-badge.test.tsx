import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookBadge } from "./book-badge";

const logos = vi.hoisted(() => ({ map: {} as Record<string, string> }));
vi.mock("@/lib/books", () => ({ bookLogo: (s: string) => logos.map[String(s).replace(/ (Premium|Fancy)$/i, "").toLowerCase()], bookVariant: (s: string) => /(Premium|Fancy)$/i.exec(s)?.[1] ?? "" }));

describe("BookBadge (where a price comes from)", () => {
  beforeEach(() => { logos.map = {}; });

  it("shows a name chip for a book with no logo file, under the name the site gives it", () => {
    render(<><BookBadge source="Ladbrokes" /><BookBadge source="smarkets" /></>);
    expect(screen.getByText("Ladbrokes")).toHaveAttribute("data-book", "Ladbrokes");
    expect(screen.getByText("Smarkets")).toBeInTheDocument();
  });

  it("shows the logo, labelled with the book's name, when there is one", () => {
    logos.map = { bet365: "/books/bet365.svg" };
    render(<BookBadge source="bet365" />);
    const img = screen.getByRole("img", { name: "bet365" });
    expect(img).toHaveAttribute("src", "/books/bet365.svg");
  });

  it("puts the feed's name beside the logo when a book quotes two feeds", () => {
    logos.map = { fairwin247: "/books/fairwin247.png" };
    render(<><BookBadge source="FairWin247 Premium" /><BookBadge source="FairWin247 Fancy" /></>);
    expect(screen.getByRole("img", { name: "FairWin247 Premium" })).toHaveAttribute("src", "/books/fairwin247.png");
    expect(screen.getByRole("img", { name: "FairWin247 Fancy" })).toHaveAttribute("src", "/books/fairwin247.png");
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByText("Fancy")).toBeInTheDocument();
  });

  it("falls back to the name when the logo does not load, for this badge and the next one", () => {
    logos.map = { leovegas: "/books/leovegas.svg" };
    const { unmount } = render(<BookBadge source="LeoVegas" />);
    fireEvent.error(screen.getByRole("img", { name: "LeoVegas" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("LeoVegas")).toBeInTheDocument();
    unmount();
    render(<BookBadge source="LeoVegas" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
