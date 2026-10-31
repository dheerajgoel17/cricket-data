import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const data = { names: {}, store: { P: { id: ["a", "b"], tm: [0, 0] }, teams: [{ n: "India" }], playerName: (i: number) => ["V Kohli", "R Sharma"][i], teamName: () => "India" } };
vi.mock("@/lib/data", () => ({ useData: () => data, useDataMaybe: () => data }));
vi.mock("@/components/app/badges", () => ({ PlayerBadge: () => <span>pic</span>, TeamBadge: () => <span>flag</span> }));

import { SavedPage } from "./Saved";
import { appStorage } from "@/lib/saved";

const open = () => render(<MemoryRouter><SavedPage /></MemoryRouter>);
beforeEach(() => { localStorage.clear(); for (const k of ["cph-saved", "cph-combos", "cph-recents"]) appStorage.refresh(k); });

describe("Saved page", () => {
  it("explains how to add things when nothing is saved, and says there is no account", () => {
    open();
    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.getByText(/no account/)).toBeInTheDocument();
    expect(screen.getByText("Tap the star on a prop row to track that line here.")).toBeInTheDocument();
  });
  it("lists watchlist props, filter combinations and recents from this device, and removes a prop", () => {
    appStorage.set("cph-saved", ["prop:0:runs:30.5:0", "player:1"]);
    appStorage.set("cph-combos", [{ name: "Safe overs", query: "min=70", at: 1 }]);
    appStorage.set("cph-recents", ["player:1"]);
    open();
    expect(screen.getByRole("link", { name: /V Kohli/ })).toHaveAttribute("href", "/player/0?stat=runs&line=30.5&fmt=0");
    expect(screen.getByRole("link", { name: /Safe overs/ })).toHaveAttribute("href", "/props?min=70");
    expect(screen.getAllByRole("link", { name: /R Sharma/ }).length).toBe(2); // saved player and recently viewed
    fireEvent.click(screen.getByRole("button", { name: "Remove from watchlist" }));
    expect(JSON.parse(localStorage.getItem("cph-saved") || "[]")).toEqual(["player:1"]);
  });
  it("ignores a saved prop whose player is no longer in the data instead of crashing", () => {
    appStorage.set("cph-saved", ["prop:99:runs:30.5:0", "prop:junk"]);
    open();
    expect(screen.queryByRole("link", { name: /runs/i })).toBeNull();
  });
});
