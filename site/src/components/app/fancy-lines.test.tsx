import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FancyLines, OverviewRow } from "./fancy-lines";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
vi.mock("./badges", () => ({ PlayerBadge: () => <span>pic</span>, PlayerPhoto: () => <span>face</span>, TeamFlag: () => null, TeamBadge: () => null }));

const row: any = {
  id: "t:team_total_runs:1",
  key: "team_total_runs",
  label: "BAN · Runs",
  innScope: "1st INN",
  inn: 1,
  team: "Bangladesh",
  line: 250.5,
  overLine: 250.5,
  underLine: 250.5,
  over: 1.9,
  under: 1.8,
  overBook: "bet365",
  underBook: "bet365",
  edge: 0.04,
  side: "over",
  hits: 6,
  played: 10,
  books: [{ source: "bet365" }],
  live: false,
  last: [{ v: 280, s: "hit" }, { v: 200, s: "miss" }],
  max: 400,
  at: { n: 5, over: 2, under: 3, side: "under" },
};

describe("FancyLines", () => {
  it("density=auto mounts compact list and dense table", () => {
    const { container } = render(
      <MemoryRouter>
        <FancyLines rows={[row]} density="auto" onOpen={() => {}} />
      </MemoryRouter>,
    );
    expect(container.querySelector(".lg\\:hidden")).toBeTruthy();
    expect(container.querySelector(".hidden.lg\\:block")).toBeTruthy();
    expect(screen.getAllByText("BAN · Runs").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("1st INN").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Lines")).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
  });

  it("CardGrid cards: compact + bleed=false (no page-edge pull, no dense table)", () => {
    const { container } = render(
      <MemoryRouter>
        <FancyLines rows={[row]} density="compact" bleed={false} onOpen={() => {}} />
      </MemoryRouter>,
    );
    expect(container.querySelector(".-mx-gutter")).toBeNull();
    expect(screen.queryByText("Lines")).toBeNull();
    expect(screen.getByText("BAN · Runs")).toBeInTheDocument();
    expect(screen.getByText("1st INN")).toBeInTheDocument();
  });

  it("phone full-bleed section: bleed=false inset=false keeps row gutter (hairline meets edge on the parent)", () => {
    const { container } = render(
      <MemoryRouter>
        <FancyLines rows={[row]} density="compact" bleed={false} inset={false} onOpen={() => {}} />
      </MemoryRouter>,
    );
    expect(container.querySelector(".-mx-gutter")).toBeNull();
    const btn = screen.getByRole("button", { name: /Open BAN/ });
    expect(btn.className).toMatch(/px-gutter/);
    expect(btn.className).not.toMatch(/px-0/);
  });

  it("dense table shows scan meta, Over/Under, hit rate, ground note and model edge", () => {
    render(
      <MemoryRouter>
        <FancyLines rows={[row]} density="dense" onOpen={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Over / under")).toBeInTheDocument();
    expect(screen.getByText("Hit rate")).toBeInTheDocument();
    expect(screen.queryByText(/^Over 250\.5$/)).toBeNull();
    expect(screen.getByText("250.5")).toBeInTheDocument();
    expect(screen.getByText("1st INN")).toBeInTheDocument();
    expect(screen.getAllByText("1.90").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/60%/)).toBeInTheDocument();
    expect(screen.getByText(/Ground · Under/)).toBeInTheDocument();
    expect(screen.getByText("+4.0")).toBeInTheDocument();
  });

  it("compact and dense keep Hit/Miss stamp; dense skips Cleared so-far copy", () => {
    const settled = { ...row, standing: { v: 280, state: "final" as const, verdict: "cleared" as const } };
    const { rerender } = render(
      <MemoryRouter>
        <FancyLines rows={[settled]} density="compact" onOpen={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("img", { name: "Hit" })).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <FancyLines rows={[settled]} density="dense" onOpen={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("img", { name: "Hit" })).toBeInTheDocument();
    expect(screen.queryByText(/so far|Cleared|Missed/)).toBeNull();
  });
});

describe("OverviewRow wrapper", () => {
  it("still renders compact scan chrome", () => {
    render(<MemoryRouter><OverviewRow r={row} onOpen={() => undefined} /></MemoryRouter>);
    expect(screen.getByText("BAN · Runs")).toBeInTheDocument();
    expect(screen.getByText("1st INN")).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
  });

  it("Home OverviewRow + fixture FancyLines: In Play Market, never per-row Live", () => {
    const live = { ...row, live: true, opened: 240.5 };
    // Home: interleaved OverviewRow; fixture Match Fancy: FancyLines.
    render(
      <MemoryRouter>
        <OverviewRow r={live} onOpen={() => undefined} />
        <FancyLines rows={[live]} density="dense" onOpen={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("In Play Market").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Live")).toBeNull();
  });
});
