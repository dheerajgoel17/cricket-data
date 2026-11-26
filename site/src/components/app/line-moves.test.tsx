import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineMovesStrip, distinctMoves } from "./line-moves";
import { LineMove } from "./live-spot";

const fx = { a: "Melbourne Stars", b: "Perth Scorchers", fmt: "T20", start: "2099-01-01T07:00:00Z" };
const mv = (extra = {}) => ({ t: "line", match: "Melbourne Stars vs Perth Scorchers", start_utc: "2099-01-01T07:00:00Z", pid: "p1", player: "H Kerr", stat: "fours", fmt: "T20", source: "bet365", kind: "bookmaker", open: 16.5, line: 17.5, at: "2098-12-31T22:00:00Z", n: 1, ...extra });

describe("line moves", () => {
  it("LineMove names the old line and the direction, and is empty when nothing moved", () => {
    const { container, rerender } = render(<LineMove from={16.5} line={17.5} />);
    expect(screen.getByLabelText("Line moved up from 16.5 to 17.5")).toHaveTextContent("was 16.5");
    rerender(<LineMove from={17.5} line={16.5} />);
    expect(screen.getByLabelText("Line moved down from 17.5 to 16.5")).toBeInTheDocument();
    rerender(<LineMove from={17.5} line={17.5} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("the strip shows one chip per market (two books moving the same line is one), and nothing without moves", () => {
    expect(distinctMoves([mv(), mv({ source: "Dafabet" }), mv({ stat: "sixes" })] as never)).toHaveLength(2);
    const { container, rerender } = render(<LineMovesStrip doc={{ moves: [mv(), mv({ source: "Dafabet" })], lines: [] }} fx={fx} />);
    const chips = screen.getAllByRole("listitem");
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveAttribute("aria-label", "H Kerr fours line moved up from 16.5 to 17.5");
    rerender(<LineMovesStrip doc={{ moves: [], lines: [] }} fx={fx} />);
    expect(container).toBeEmptyDOMElement();
  });
});
