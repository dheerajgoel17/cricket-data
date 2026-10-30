import { describe, expect, it } from "vitest";
import { countPhases, lineHomePhase, pickHomePhase, phaseOf } from "./home-phase";

const NOW = Date.parse("2026-10-30T15:00:00Z");
const row = (start: string, match = "South Africa vs Australia", fmt = "Test") => ({ match, start, fmt });
const live = (...ms: { a: string; b: string; start: string; status: string; fmt?: string }[]) => ({
  matches: ms.map((m) => ({ status: m.status, start: m.start, fmt: m.fmt, teams: [{ name: m.a }, { name: m.b }] })),
});

describe("phaseOf", () => {
  it("renames upcoming to pre-match and keeps live and resulted", () => {
    expect(phaseOf("live")).toBe("live");
    expect(phaseOf("final")).toBe("final");
    expect(phaseOf("upcoming")).toBe("pre");
  });
});

describe("lineHomePhase", () => {
  it("follows the live feed when it has the match", () => {
    const start = "2026-10-27T08:30:00Z";
    const doc = live({ a: "South Africa", b: "Australia", start, status: "live", fmt: "Test" });
    expect(lineHomePhase(row(start), doc, NOW)).toBe("live");
    expect(lineHomePhase(row(start), live({ a: "South Africa", b: "Australia", start, status: "final", fmt: "Test" }), NOW)).toBe("final");
    expect(lineHomePhase(row("2026-10-30T16:00:00Z"), live({ a: "South Africa", b: "Australia", start: "2026-10-30T16:00:00Z", status: "upcoming" }), NOW)).toBe("pre");
  });
  it("treats a started Test with no live row as in play for six days, then resulted", () => {
    expect(lineHomePhase(row("2026-10-27T08:30:00Z"), { matches: [] }, NOW)).toBe("live");
    expect(lineHomePhase(row("2026-10-20T08:30:00Z"), { matches: [] }, NOW)).toBe("final");
  });
  it("keeps a kick-off still in the future as pre-match", () => {
    expect(lineHomePhase(row("2026-10-30T18:00:00Z", "New Zealand vs India", "T20"), { matches: [] }, NOW)).toBe("pre");
  });
});

describe("pickHomePhase", () => {
  it("opens In play when anything is on, else Pre-match, and honours a tap even when that bucket is empty", () => {
    expect(pickHomePhase({ live: 2, pre: 4, final: 1 })).toBe("live");
    expect(pickHomePhase({ live: 0, pre: 4, final: 1 })).toBe("pre");
    expect(pickHomePhase({ live: 0, pre: 0, final: 1 })).toBe("final");
    expect(pickHomePhase({ live: 0, pre: 0, final: 0 })).toBe("live");
    expect(pickHomePhase({ live: 2, pre: 4, final: 1 }, "final")).toBe("final");
    expect(pickHomePhase({ live: 0, pre: 4, final: 1 }, "live")).toBe("live");
  });
});

describe("countPhases", () => {
  it("tallies each bucket", () => {
    expect(countPhases(["live", "pre", "live", "final"] as const, (x) => x)).toEqual({ live: 2, pre: 1, final: 1 });
  });
});
