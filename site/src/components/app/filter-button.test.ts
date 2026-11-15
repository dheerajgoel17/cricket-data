import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : []; });

describe("shared chip controls", () => {
  it("builds the Filters button only in components/app/chip.tsx", () => {
    const bad = files(join(root, "components")).concat(files(join(root, "pages")))
      .filter((f) => !/components\/app\/chip\.tsx$/.test(f) && !/design-system/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("AdjustmentsHorizontalIcon"));
    expect(bad).toEqual([]);
  });
});
