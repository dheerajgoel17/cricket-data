/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ match: null as any }));
vi.mock("@/hooks/useLive", () => ({ useLiveMatch: () => ({ match: env.match }) }));
vi.mock("./badges", () => ({ TeamBadge: ({ name }: { name: string }) => <span data-testid="badge">{name.slice(0, 2)}</span>, usePreloadTeams: () => {} }));

import { FixtureCard, LiveScore } from "./fixture-card";

const NOW = Date.parse("2026-11-01T10:30:00Z");
const card = (over: Record<string, unknown> = {}) => render(<MemoryRouter><FixtureCard f={{ id: "2026-11-01-eagles-v-tuskers", a: "Eagles", b: "Tuskers", a_ix: -1, b_ix: -1, fmt: "", gender: "male", start: "2026-11-01T07:30Z", venue: "", series: "", status: "Started", result: "", ...over }} /></MemoryRouter>);

beforeEach(() => { vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] }); env.match = null; });
afterEach(() => vi.useRealTimers());

describe("FixtureCard", () => {
  it("rolls the home score when a wicket falls without any runs", () => {
    const { rerender } = render(<LiveScore live s={{ display: "293/5", runs: 293, wkts: 5 }} />);
    expect(screen.getByText("293/5")).not.toHaveClass("ticker-roll-up");
    rerender(<LiveScore live s={{ display: "293/6", runs: 293, wkts: 6 }} />);
    expect(screen.getByText("293/6")).toHaveClass("ticker-roll-up");
  });

  it("shows a started match nothing lists honestly: Started, no LIVE badge, no empty score columns, props still linked", () => {
    card();
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByText("Yet to bat")).not.toBeInTheDocument();
    expect(screen.getByText("Score not available from our source")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/fixture/2026-11-01-eagles-v-tuskers");
    expect(screen.getByText("Props")).toBeInTheDocument();
  });
  it("is Live with the score when the live feed lists the match in play", () => {
    env.match = { status: "live", teams: [{ name: "Eagles", display: "151/4", runs: 151, wkts: 4, overs: 18 }, { name: "Tuskers", display: "" }] };
    card();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("151/4")).toBeInTheDocument();
    expect(screen.queryByText("Score not available from our source")).not.toBeInTheDocument();
  });
  it("is not Live on the clock alone when the schedule is behind", () => {
    card({ status: "Upcoming", start: "2026-11-01T09:30Z" });
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
  });
});
