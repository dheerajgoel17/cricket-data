import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HomeMixDenseTable } from "./home-mix-table";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
vi.mock("./badges", () => ({ PlayerBadge: () => <span>pic</span>, PlayerPhoto: () => <span>face</span>, TeamFlag: () => null, TeamBadge: () => <span>crest</span> }));
vi.mock("./live-spot", async (orig) => ({ ...(await orig<typeof import("./live-spot")>()), BatterSpot: () => null }));
vi.mock("./portrait", () => ({ PlayerAvatar: () => <span>face</span> }));
vi.mock("./player-name", () => ({ PlayerName: ({ fallback }: { fallback: string }) => <span>{fallback}</span> }));

const player = {
  idx: 1, pid: "p1", inn: 0, name: "AM Tribe", team: "Jersey", stat: "runs", line: 39.5, fmt: "ODI",
  start: "2026-10-30T12:00:00Z", over: 1.85, under: 1.9, quotes: [], venue: "Wankhede Stadium, Mumbai",
  l10: { p: 0.7, played: 10 }, ven: { p: 0.4, played: 5 }, edge: 0.05, side: "over",
  last: [{ v: 53, s: "hit" }], max: 80,
};

const fancy = {
  id: "t:team_total_runs:1", key: "team_total_runs", label: "Bangladesh Runs", team: "Bangladesh",
  line: 250.5, over: 1.9, under: 1.8, edge: 0.04, side: "over", hits: 6, played: 10,
  live: false, last: [{ v: 280, s: "hit" }], max: 400, at: { n: 5, side: "under" },
};

describe("HomeMixDenseTable", () => {
  it("keeps dense headers and interleaves props then fancy in one table", () => {
    const items = [
      { kind: "player" as const, key: "p1", r: player },
      { kind: "fancy" as const, key: "f1", r: fancy, f: { id: "fx1" } },
      { kind: "player" as const, key: "p2", r: { ...player, name: "T Banton", idx: 2 } },
    ];
    render(
      <MemoryRouter>
        <HomeMixDenseTable items={items} soFarOf={() => null} outOf={() => false} onOpenFancy={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Lines")).toBeInTheDocument();
    expect(screen.getByText("L10 chart")).toBeInTheDocument();
    expect(screen.getByText("Hit rate")).toBeInTheDocument();
    expect(screen.getByText("AM Tribe")).toBeInTheDocument();
    expect(screen.getByText("Bangladesh Runs")).toBeInTheDocument();
    expect(screen.getByText("T Banton")).toBeInTheDocument();
    // One table, not two separate PropLines / FancyLines blocks.
    expect(document.querySelectorAll("table")).toHaveLength(1);
    const names = [...document.querySelectorAll("tbody tr")].map((tr) => tr.textContent || "");
    expect(names[0]).toMatch(/AM Tribe/);
    expect(names[1]).toMatch(/Bangladesh Runs/);
    expect(names[2]).toMatch(/T Banton/);
  });
});
