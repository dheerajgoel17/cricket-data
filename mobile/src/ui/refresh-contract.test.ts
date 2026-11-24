import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

/** One pull-to-refresh on every scrolling tab: the liquid drop (`ui/liquid-refresh.tsx`), never a one-off RefreshControl. */
const TABS = ["app/(tabs)/index.tsx", "app/(tabs)/props.tsx", "app/(tabs)/fancy.tsx", "app/(tabs)/leagues.tsx"];

describe("pull-to-refresh contract", () => {
  for (const rel of TABS) {
    it(`${rel} uses the liquid refresh`, () => {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toMatch(/from "@\/ui\/liquid-refresh"/);
      expect(src).not.toMatch(/<RefreshControl/);
    });
  }
});
