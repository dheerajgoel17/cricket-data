import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tab motion contract", () => {
  it("switching tabs is a short crossfade (opacity only), not an instant swap and not a slide", () => {
    const src = readFileSync(join(__dirname, "../components/app-tabs.tsx"), "utf8");
    expect(src).toMatch(/animation: "fade"/);
    expect(src).not.toMatch(/animation: "(shift|none)"/);
  });
});
