import { describe, expect, it } from "vitest";
import { groundClock, wxLabel } from "./venue-wx";

describe("venue weather helpers", () => {
  it("maps WMO codes to short labels", () => {
    expect(wxLabel(0)).toBe("Clear");
    expect(wxLabel(2)).toBe("Cloudy");
    expect(wxLabel(61)).toBe("Rain");
    expect(wxLabel(95)).toBe("Storm");
  });
  it("formats a ground clock in the venue's zone", () => {
    const t = Date.parse("2026-11-04T07:47:00Z");
    expect(groundClock("Asia/Kolkata", t)).toMatch(/1:17/);
  });
});
