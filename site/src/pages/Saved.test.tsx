import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authState, seedCombos, seedSaved, savedKeys } from "@/test/auth-harness";

const data = { names: {}, store: { P: { id: ["a", "b"], tm: [0, 0] }, teams: [{ n: "India" }], playerName: (i: number) => ["V Kohli", "R Sharma"][i], teamName: () => "India" } };
vi.mock("@/lib/data", () => ({ useData: () => data, useDataMaybe: () => data }));
vi.mock("@/components/app/badges", () => ({ PlayerBadge: () => <span>pic</span>, TeamBadge: () => <span>flag</span> }));

import { SavedPage } from "./Saved";
import { appStorage } from "@/lib/saved";

const open = () => render(<MemoryRouter><SavedPage /></MemoryRouter>);
beforeEach(() => { localStorage.clear(); for (const k of ["cph-saved", "cph-combos", "cph-recents"]) appStorage.refresh(k); });

describe("Saved page", () => {
  it("asks to sign in when there is no account session", () => {
    authState.user = null;
    open();
    expect(screen.getByText(/Sign in to sync Saved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("lists watchlist props, filter combinations and recents, and removes a prop on the server", async () => {
    seedSaved(["prop:0:runs:30.5:0", "player:1"]);
    seedCombos([{ name: "Safe overs", query: "min=70" }]);
    appStorage.set("cph-recents", ["player:1"]);
    open();
    await waitFor(() => expect(screen.getByRole("link", { name: /V Kohli/ })).toHaveAttribute("href", "/player/0?stat=runs&line=30.5&fmt=0"));
    expect(screen.getByRole("link", { name: /Safe overs/ })).toHaveAttribute("href", "/props?min=70");
    expect(screen.getAllByRole("link", { name: /R Sharma/ }).length).toBe(2); // saved player and recently viewed
    fireEvent.click(screen.getByRole("button", { name: "Remove from watchlist" }));
    await waitFor(() => expect(savedKeys()).toEqual(["player:1"]));
  });

  it("ignores a saved prop whose player is no longer in the data instead of crashing", async () => {
    seedSaved(["prop:99:runs:30.5:0", "prop:junk"]);
    open();
    await waitFor(() => expect(screen.getByText("Watchlist")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /runs/i })).toBeNull();
  });
});
