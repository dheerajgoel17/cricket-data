import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("stats table bleed contract (app)", () => {
  it("team / league / ground / next-match / fancy use bleed or Bleed", () => {
    expect(src("app/team/[idx].tsx")).toMatch(/DataTable bleed/);
    expect(src("app/league/[id].tsx")).toMatch(/DataTable bleed/);
    expect(src("ui/ground-page.tsx")).toMatch(/bleed/);
    expect(src("ui/next-match.tsx")).toMatch(/DataTable bleed/);
    expect(src("ui/match-fancy.tsx")).toMatch(/<Bleed/);
    expect(src("ui/match-fancy.tsx")).toMatch(/type\.footnote/);
  });
});
