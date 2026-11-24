import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("error-state contract", () => {
  it("no screen tells the person to reopen the page (a failed load has a Try again button)", () => {
    const bad = files(root).filter((f) => /reopen this page/i.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("the root layout exports the route error boundary", () => {
    const src = readFileSync(join(root, "app/_layout.tsx"), "utf8");
    expect(src).toMatch(/export function ErrorBoundary/);
    expect(src).toMatch(/logError\(/);
  });
});
