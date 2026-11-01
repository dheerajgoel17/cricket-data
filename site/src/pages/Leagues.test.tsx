import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LeaguesPage } from "./Leagues";

Element.prototype.scrollTo = () => {}; // jsdom has none; the chip row scrolls its active chip into view

vi.mock("@/lib/analytics", () => ({ track: () => {} }));
vi.mock("@/lib/data", () => ({ useData: () => ({ store: { events: ["", "Big Bash League", "Women's Big Bash League", "Nepal Premier League"] } }) }));
vi.mock("@/components/app/badges", () => ({ LeagueBadge: () => null }));
vi.mock("@/hooks/useEngine", () => ({ useFixtures: () => ({ data: [] }) }));
vi.mock("@/hooks/useRail", () => ({ useRail: () => ({ rail: { bigEvent: ["big bash"] } }) }));
vi.mock("@cricket/engine/tournament.js", () => ({
  featuredEvents: () => [{ e: 2, name: "Women's Big Bash League", tag: "live" }, { e: 1, name: "Big Bash League", tag: "soon" }, { e: 3, name: "Nepal Premier League", tag: "" }],
}));
vi.mock("@/components/app/tournament-stats", () => ({ TournamentStats: ({ eventIdx }: { eventIdx: number }) => <p>stats for {eventIdx}</p> }));

const view = (path = "/leagues") => render(<MemoryRouter initialEntries={[path]}><LeaguesPage /></MemoryRouter>);

describe("LeaguesPage", () => {
  it("opens on the first league (Big Bash, the women's season live), with Live and Soon tags on the chips and the men's season next", () => {
    view();
    const chips = screen.getAllByRole("radio").map((c) => [c.textContent, c.getAttribute("aria-checked")]);
    expect(chips).toEqual([["Women's Big Bash LeagueLive", "true"], ["Big Bash LeagueSoon", "false"], ["Nepal Premier League", "false"]]);
    expect(screen.getByText("stats for 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Women's Big Bash League" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /More/ })).toHaveAttribute("href", "/league/2");
  });

  it("shows the league asked for in the link, even when it is not in the featured list, and switches on a tap", () => {
    view("/leagues?c=3");
    expect(screen.getByText("stats for 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Big Bash League/ }));
    expect(screen.getByText("stats for 1")).toBeInTheDocument();
  });
});
