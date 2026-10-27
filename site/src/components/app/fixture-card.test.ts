import { describe, expect, it } from "vitest";
import { startsIn } from "./fixture-card";

describe("startsIn", () => {
  it("counts down in the largest unit that fits, without a stray 0m", () => {
    expect(startsIn(25 * 60 * 60e3)).toBe("Starts in 1 day");
    expect(startsIn(3 * 24 * 60 * 60e3)).toBe("Starts in 3 days");
    expect(startsIn((8 * 60 + 36) * 60e3)).toBe("Starts in 8h 36m");
    expect(startsIn(13 * 60 * 60e3)).toBe("Starts in 13h");
    expect(startsIn(5 * 60e3)).toBe("Starts in 5m");
    expect(startsIn(10e3)).toBe("Starts in 1m");
  });
});
