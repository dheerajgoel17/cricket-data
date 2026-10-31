import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchStatus, startLabel } from "./match-status";

const NOW = new Date(2026, 9, 31, 12, 0);
const at = (dayOffset: number, h: number, m = 30) => new Date(2026, 9, 31 + dayOffset, h, m).toISOString();

describe("startLabel (viewer's local time)", () => {
  it("gives just the time today, Tomorrow plus the time, and a dated label after that", () => {
    expect(startLabel(at(0, 22), NOW)).toMatch(/10:30/);
    expect(startLabel(at(0, 22), NOW)).not.toMatch(/Tomorrow|Nov/);
    expect(startLabel(at(1, 22), NOW)).toMatch(/^Tomorrow .*10:30/);
    expect(startLabel(at(3, 22), NOW)).toMatch(/Nov.*10:30/);
  });
  it("is empty for an unreadable date", () => { expect(startLabel("soon", NOW)).toBe(""); });
});

describe("MatchStatus", () => {
  it("shows the local start time while the match is to come", () => {
    render(<MatchStatus phase="upcoming" start={at(0, 22)} />);
    expect(screen.getByText(/10:30/)).toBeInTheDocument();
  });
  it("shows a Live badge while it is on, never a time", () => {
    render(<MatchStatus phase="live" start={at(0, 10)} />);
    expect(screen.getByRole("status")).toHaveTextContent("Live");
    expect(screen.queryByText(/10:30/)).toBeNull();
  });
  it("shows Completed once it is over, never a time", () => {
    render(<MatchStatus phase="final" start={at(0, 10)} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText(/10:30/)).toBeNull();
  });
  it("falls back to Scheduled when there is no start", () => {
    render(<MatchStatus phase="upcoming" />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });
});
