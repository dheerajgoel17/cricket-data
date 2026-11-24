import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : []; });

/** The opening tag of every `<Press ...>` (braces balanced, so an arrow function's `>` does not end it). */
function pressTags(src: string): { tag: string; line: number }[] {
  const out: { tag: string; line: number }[] = [];
  for (const m of src.matchAll(/<Press\b/g)) {
    let i = m.index! + m[0].length, depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && src[i - 1] !== "=") break;
    }
    out.push({ tag: src.slice(m.index!, i), line: src.slice(0, m.index!).split("\n").length });
  }
  return out;
}

describe("accessibility contract", () => {
  it("every Press says what it is (accessibilityRole) unless it passes its props through", () => {
    const bad = files(root).flatMap((f) => pressTags(readFileSync(f, "utf8")).filter(({ tag }) => !/accessibilityRole/.test(tag) && !/\{\.\.\./.test(tag)).map(({ line }) => `${f.replace(root, "")}:${line}`));
    expect(bad).toEqual([]);
  });

  it("small text and icon controls extend their hit area (hitSlop) instead of growing", () => {
    for (const rel of ["ui/info-button.tsx", "app/search.tsx"]) expect(readFileSync(join(root, rel), "utf8")).toMatch(/hitSlopFor\(/);
  });
});

describe("chip touch targets", () => {
  it("every chip-like control tops its 36-44 point drawing up to the platform minimum (hitSlop)", () => {
    for (const rel of ["ui/chips.tsx", "ui/capsule.tsx", "ui/window-pills.tsx"]) expect(readFileSync(join(root, rel), "utf8")).toMatch(/hitSlop=\{CHIP_SLOP\}/);
    expect(readFileSync(join(root, "ui/match-chip.tsx"), "utf8")).toMatch(/hitSlop=\{MATCH_SLOP\}/);
  });

  it("the Leagues text links are not 18-point targets", () => {
    expect(readFileSync(join(root, "app/(tabs)/leagues.tsx"), "utf8")).not.toMatch(/hitSlop=\{8\}/);
  });
});
