import { describe, expect, it } from "vitest";
import { heatClass, heatStep, rateClass, rateStep } from "./heat";

describe("heat", () => {
  it("steps a value against the line by how far it cleared or missed", () => {
    expect(heatStep(60, 39.5)).toBe(2);
    expect(heatStep(45, 39.5)).toBe(1);
    expect(heatStep(39.5, 39.5)).toBe(0);
    expect(heatStep(30, 39.5)).toBe(-1);
    expect(heatStep(10, 39.5)).toBe(-2);
  });

  it("uses the same steps for a hit rate", () => {
    expect(rateStep(0.8)).toBe(2);
    expect(rateStep(0.5)).toBe(0);
    expect(rateStep(0.1)).toBe(-2);
    expect(rateStep(null)).toBeNull();
  });

  it("maps steps onto token classes", () => {
    expect(heatClass(2)).toContain("bg-primary");
    expect(heatClass(-2)).toContain("bg-miss");
    expect(rateClass(null)).toContain("bg-muted");
  });
});
