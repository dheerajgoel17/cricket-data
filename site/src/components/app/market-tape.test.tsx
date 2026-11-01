import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MarketTape } from "./market-tape";

vi.mock("@/lib/analytics", () => ({ track: () => {} }));
vi.mock("./badges", () => ({ PlayerBadge: () => <span>pic</span> }));

Element.prototype.scrollTo = () => {}; // jsdom has none; the tab row scrolls its active chip into view

describe("MarketTape", () => {
  it("lists a long-shot over that cleared and a short-priced over that missed", () => {
    render(
      <MemoryRouter>
        <MarketTape rows={[
          { idx: 1, name: "Long shot", stat: "runs", line: 49.5, over: 3.2, fmt: "T20", verdict: "cleared", v: 62 },
          { idx: 2, name: "Short miss", stat: "wickets", line: 1.5, over: 1.22, fmt: "T20", verdict: "missed", v: 0 },
          { idx: 3, name: "Quiet", stat: "runs", line: 24.5, over: 1.9, fmt: "T20", verdict: null },
        ]} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("region", { name: "High odds hits and low odds misses" })).toHaveLength(1); // one card, two tabs
    expect(screen.getByRole("radio", { name: "High odds hits · 1" })).toBeInTheDocument();
    expect(screen.getByText("Long shot")).toBeInTheDocument();
    expect(screen.queryByText("Short miss")).toBeNull();
    expect(screen.getByText("3.20")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Low odds misses · 1" }));
    expect(screen.getByText("Short miss")).toBeInTheDocument();
    expect(screen.queryByText("Long shot")).toBeNull();
    expect(screen.queryByText("Quiet")).toBeNull();
    expect(screen.getByText("1.22")).toBeInTheDocument();
  });

  it("renders nothing when no row has cleared a long shot or missed a short price", () => {
    const { container } = render(<MemoryRouter><MarketTape rows={[{ idx: 1, name: "A", stat: "runs", line: 20.5, over: 1.9, fmt: "T20", verdict: "cleared" }]} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
