import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ScreenerFilters, type FilterChoices } from "./screener-filters";
import { DEFAULTS } from "@/lib/screener";

const choices: FilterChoices = {
  days: [["0", "Today"], ["1", "Tomorrow"]],
  matches: [{ id: "m1", label: "IND v AUS" }, { id: "m2", label: "ENG v NZ" }],
  teams: ["India", "Australia"], formats: ["T20", "ODI"], comps: ["IPL", "BBL"], winLabel: { season: "2026", h2h: "H2H", ven: "Venue", l5: "L5", l10: "L10" },
};

const setup = (state = DEFAULTS, over: Partial<FilterChoices> = {}) => {
  const onApply = vi.fn(), onOpenChange = vi.fn();
  render(<MemoryRouter><ScreenerFilters open onOpenChange={onOpenChange} state={state} onApply={onApply} choices={{ ...choices, ...over }} /></MemoryRouter>);
  return { onApply, onOpenChange };
};

describe("ScreenerFilters", () => {
  it("groups the filters in sections and shows what each holds", () => {
    setup({ ...DEFAULTS, fmt: "ODI", min: 70 });
    for (const name of ["Day", "Match", "Team", "Format", "Competition", "Hit-rate window", "Sort", "Display", "Save and share"]) expect(screen.getByRole("button", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Format/ })).toHaveTextContent("ODI");
    expect(screen.getByRole("button", { name: /^Hit-rate window/ })).toHaveTextContent("70%+");
  });
  it("holds edits until Apply, then hands back the whole selection", () => {
    const { onApply, onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    fireEvent.click(screen.getByRole("button", { name: "L5" }));
    fireEvent.click(screen.getByRole("button", { name: "80%+" }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({ ...DEFAULTS, day: "1", win: "l5", min: 80 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("Clear all resets the draft to the defaults", () => {
    const { onApply } = setup({ ...DEFAULTS, day: "1", team: "India", min: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(DEFAULTS);
  });
  it("offers only what the rows have: no Team, Format or Competition section when there is a single value", () => {
    setup(DEFAULTS, { teams: ["India"], formats: ["T20"], comps: [], matches: [] });
    expect(screen.queryByRole("button", { name: /^Team/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Format/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Competition/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Match/ })).toBeNull();
  });
  it("saves the combination on this device and refuses an empty one", () => {
    localStorage.clear();
    setup({ ...DEFAULTS, min: 70 });
    fireEvent.click(screen.getByRole("button", { name: /^Save and share/ }));
    fireEvent.click(screen.getByRole("button", { name: "70%+" }));
    fireEvent.change(screen.getByLabelText("Name this combination"), { target: { value: "Safe overs" } });
    fireEvent.click(within(document.body).getByRole("button", { name: "Save" }));
    expect(JSON.parse(localStorage.getItem("cph-combos") || "[]")[0]).toMatchObject({ name: "Safe overs", query: "min=70" });
  });
});
