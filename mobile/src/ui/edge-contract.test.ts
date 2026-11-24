import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

/** Edge-to-edge on Android: a detail page scrolls under the system navigation buttons, so it ends in the shared bottom fade and leaves the inset below its last row. */
const DETAIL_PAGES = [
  "app/competitions.tsx",
  "app/search.tsx",
  "app/team/[idx].tsx",
  "app/league/[id].tsx",
  "app/fixture/[id]/index.tsx",
  "app/fixture/[id]/fancy.tsx",
  "app/player/[idx].tsx",
  "ui/ground-page.tsx",
];

describe("edge-to-edge contract", () => {
  for (const rel of DETAIL_PAGES) {
    it(`${rel} ends in the bottom fade`, () => {
      expect(readFileSync(join(root, rel), "utf8")).toMatch(/<TabFade withTabBar=\{false\}/);
    });
  }

  it("the info sheet clears the system navigation buttons", () => {
    expect(readFileSync(join(root, "app/info/[topic].tsx"), "utf8")).toMatch(/useSafeAreaInsets/);
  });
});
