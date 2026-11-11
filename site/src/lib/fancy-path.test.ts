import { describe, expect, it } from "vitest";
import { fancyRowPath } from "./fancy-path";

describe("fancyRowPath", () => {
  it("opens the selected Test innings, team and under line from a split row", () => {
    expect(fancyRowPath("test-match", {
      key: "team_total_runs", inn: 2, scope: 42, line: 240.5, side: "under", overLine: 240.5, underLine: 245.5,
    })).toBe("/fixture/test-match/fancy?fm=team_total_runs%3A2&sc=42&ml=245.5");
  });

  it("keeps the clicked line for a whole-match market", () => {
    expect(fancyRowPath("match", { key: "match_sixes", scope: -1, line: 12.5 }))
      .toBe("/fixture/match/fancy?fm=match_sixes&ml=12.5");
  });
  it("preserves the head-to-head sample when opening a market", () => {
    expect(fancyRowPath("match", { key: "match_sixes", scope: -1, line: 16.5 }, { mv: "h2h", mw: 10 }))
      .toBe("/fixture/match/fancy?fm=match_sixes&mw=10&mv=h2h&ml=16.5");
  });
});
