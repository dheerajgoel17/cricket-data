import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Drill-in screens that used to show plain Text empties must import EmptyState
 * (unknown player/team/league, fixture gone, competitions miss, info miss).
 */
const REQUIRED = [
  "app/player/[idx].tsx",
  "app/team/[idx].tsx",
  "app/league/[id].tsx",
  "app/fixture/[id]/index.tsx",
  "app/fixture/[id]/fancy.tsx",
  "app/competitions.tsx",
  "app/info/[topic].tsx",
  "ui/grid-table.tsx",
  "ui/tournament-stats.tsx",
];

const root = join(__dirname, "..");

describe("empty-state contract", () => {
  for (const rel of REQUIRED) {
    it(`${rel} imports EmptyState`, () => {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toMatch(/EmptyState/);
      expect(src).toMatch(/from ["']@\/ui\/empty-state["']/);
    });
  }

  it("does not ship coming-soon.tsx", () => {
    const ui = readdirSync(join(root, "ui"));
    expect(ui).not.toContain("coming-soon.tsx");
  });
});
