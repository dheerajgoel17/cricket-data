import { describe, expect, it } from "vitest";
import { fixtureTeamBackground } from "./team-colors";

describe("fixture team background", () => {
  it("places each team's tint on its own side", () => {
    const background = fixtureTeamBackground("Perth Scorchers Women", "Sydney Thunder Women");
    expect(background).toContain("#f97316");
    expect(background).toContain("#84cc16");
    expect(background.indexOf("#f97316")).toBeLessThan(background.indexOf("#84cc16"));
  });

  it("uses the parent colors for under-19 teams and the card surface for unmapped teams", () => {
    expect(fixtureTeamBackground("India Under-19", "Unmapped Club")).toBe(fixtureTeamBackground("India", "Unmapped Club"));
    expect(fixtureTeamBackground("Unmapped One", "Unmapped Two")).not.toContain("color-mix");
  });
});
