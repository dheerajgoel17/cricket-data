import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OverviewRow } from "./fancy-lines";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
vi.mock("./badges", () => ({ PlayerBadge: () => <span>pic</span>, PlayerPhoto: () => <span>face</span>, TeamFlag: () => null, TeamBadge: () => null }));

const row = { key: "team_total_runs", label: "Bangladesh 1st innings runs", team: "Bangladesh", line: 250.5, over: 1.9, under: 1.8, edge: 0.04, side: "over", books: [{ source: "bet365" }], live: true, opened: 240.5, last: [], max: 0 };

describe("a live Match Fancy row", () => {
  it("carries the In Play Market mark beside its name; no Opened at (in-play-only rows have no pre-match line)", () => {
    render(<MemoryRouter><OverviewRow r={row} onOpen={() => undefined} /></MemoryRouter>);
    const title = screen.getByText("Bangladesh 1st innings runs");
    expect(within(title.parentElement as HTMLElement).getByText("In Play Market")).toBeInTheDocument(); // the same line as the name
    expect(screen.getAllByText("In Play Market")).toHaveLength(1);
    expect(screen.queryByText(/Opened at/)).toBeNull();
    expect(screen.getByText("Edge")).toBeInTheDocument();
  });

  it("has neither when the row is not live", () => {
    render(<MemoryRouter><OverviewRow r={{ ...row, live: false }} onOpen={() => undefined} /></MemoryRouter>);
    expect(screen.queryByText("In Play Market")).toBeNull();
    expect(screen.queryByText(/Opened at/)).toBeNull();
  });

  it("keeps Edge and puts a Hit/Miss mark beside odds once the pre-match line has settled", () => {
    render(<MemoryRouter><OverviewRow r={{ ...row, live: false, standing: { v: 280, state: "final", verdict: "cleared" } }} onOpen={() => undefined} /></MemoryRouter>);
    expect(screen.getByRole("img", { name: "Hit" })).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
  });

  it("puts VOID in place of the bars when the fancy line is void", () => {
    render(<MemoryRouter><OverviewRow r={{ ...row, live: false, standing: { v: null, state: "void", verdict: null } }} onOpen={() => undefined} /></MemoryRouter>);
    expect(screen.getByText("VOID")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Last / })).toBeNull();
  });
});
