import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a font family next to a named font weight (Barlow numbers stay Barlow)", () => {
    expect(cn("font-condensed text-metric", "font-label")).toBe("font-condensed text-metric font-label");
    expect(cn("font-condensed font-emphasis")).toBe("font-condensed font-emphasis");
  });
  it("still lets a later weight replace an earlier one", () => {
    expect(cn("font-label", "font-emphasis")).toBe("font-emphasis");
  });
});
