import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ data: null as any }));
vi.mock("@/lib/data", () => ({ useDataMaybe: () => env.data }));
import { PlayerName } from "./player-name";

const data = (names: Record<string, string>) => ({ store: { P: { id: ["p0", "p1"] }, playerName: (i: number) => ["P Rathnayake", "abcdef12"][i] }, names });

describe("PlayerName", () => {
  it("shows the short name on a phone and the full one from md up when the source has it", () => {
    env.data = data({ p0: "Pathum Nissanka Rathnayake" });
    render(<PlayerName idx={0} />);
    expect(screen.getByText("P Rathnayake")).toHaveClass("md:hidden");
    expect(screen.getByText("Pathum Nissanka Rathnayake")).toHaveClass("hidden", "md:inline");
  });
  it("shows the full name at every width where there is room (a page header)", () => {
    env.data = data({ p0: "Pathum Nissanka Rathnayake" });
    render(<PlayerName idx={0} always />);
    expect(screen.getByText("Pathum Nissanka Rathnayake")).not.toHaveClass("hidden");
    expect(screen.queryByText("P Rathnayake")).toBeNull();
  });
  it("falls back to the short name with no full name, and to the book's spelling when the data holds only an id", () => {
    env.data = data({});
    const { unmount } = render(<PlayerName idx={0} />);
    expect(screen.getByText("P Rathnayake")).toBeInTheDocument();
    unmount();
    render(<PlayerName idx={1} fallback="Kusal Mendis" />);
    expect(screen.getByText("Kusal Mendis")).toBeInTheDocument();
  });
  it("does not throw outside the data provider", () => {
    env.data = null;
    render(<PlayerName idx={0} fallback="Someone" />);
    expect(screen.getByText("Someone")).toBeInTheDocument();
  });
});
