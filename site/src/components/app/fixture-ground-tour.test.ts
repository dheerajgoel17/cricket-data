import { describe, expect, it } from "vitest";
import { genderFilterLabel, tourDatesAtGround, tourStatusAtGround } from "./fixture-ground";

const NOW = Date.parse("2026-11-04T08:00:00Z");

describe("gender filter label", () => {
  it("matches the Filters chip wording (All / Men / Women)", () => {
    expect(genderFilterLabel("")).toBe("All");
    expect(genderFilterLabel("male")).toBe("Men");
    expect(genderFilterLabel("female")).toBe("Women");
  });
});

describe("tour at ground", () => {
  it("is Upcoming when every game is still to start", () => {
    expect(tourStatusAtGround([
      { start: "2026-11-10T07:00:00Z", status: "Upcoming", source: "schedule" },
      { start: "2026-11-14T07:00:00Z", status: "Upcoming", source: "schedule" },
    ], NOW)).toBe("Upcoming");
  });
  it("is In progress once a game has started or is live", () => {
    expect(tourStatusAtGround([
      { start: "2026-11-01T07:00:00Z", status: "Live", source: "schedule" },
      { start: "2026-11-10T07:00:00Z", status: "Upcoming", source: "schedule" },
    ], NOW)).toBe("In progress");
    expect(tourStatusAtGround([
      { start: "2026-11-04T06:00:00Z", status: "Upcoming", source: "schedule" },
    ], NOW)).toBe("In progress");
  });
  it("is Completed when only history remains", () => {
    expect(tourStatusAtGround([
      { start: "2026-10-01", status: "Completed", source: "history" },
      { start: "2026-10-05", status: "Completed", source: "history" },
    ], NOW)).toBe("Completed");
  });
  it("spans dates at the ground", () => {
    expect(tourDatesAtGround([
      { start: "2026-09-11" },
      { start: "2026-11-02T09:00:00Z" },
    ], 2026)).toBe("11 Sep – 2 Nov");
    expect(tourDatesAtGround([{ start: "2026-09-11" }], 2026)).toBe("11 Sep");
  });
});
