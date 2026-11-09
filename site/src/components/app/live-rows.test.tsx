import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OverviewRow } from "./match-fancy";

vi.mock("@/lib/books", () => ({ bookLogo: () => undefined }));
vi.mock("./badges", () => ({ PlayerBadge: () => <span>pic</span>, PlayerPhoto: () => <span>face</span>, TeamFlag: () => null, TeamBadge: () => null }));

const row = { key: "team_total_runs", label: "Bangladesh 1st innings runs", team: "Bangladesh", line: 250.5, over: 1.9, under: 1.8, edge: 0.04, side: "over", books: [{ source: "bet365" }], live: true, opened: 240.5, last: [], max: 0 };

describe("a live Match Fancy row", () => {
  it("carries the Live mark beside its name, and where the line stood before the match in its prices row", () => {
    render(<MemoryRouter><OverviewRow r={row} onOpen={() => undefined} /></MemoryRouter>);
    const title = screen.getByText("Bangladesh 1st innings runs");
    expect(within(title.parentElement as HTMLElement).getByText("Live")).toBeInTheDocument(); // the same line as the name
    expect(screen.getAllByText("Live")).toHaveLength(1);
    const note = screen.getByText("was 240.5");
    expect(note.parentElement).toHaveTextContent("O 1.90"); // with the prices, not a line of its own
  });

  it("has neither when the row is not live", () => {
    render(<MemoryRouter><OverviewRow r={{ ...row, live: false }} onOpen={() => undefined} /></MemoryRouter>);
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.queryByText(/was/)).toBeNull();
  });
});
