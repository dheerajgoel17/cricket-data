import { describe, expect, it } from "vitest";
import { fancyRowPath } from "./fancy-path";

describe("fancyRowPath", () => {
  it("opens the better side's own line when over and under sit apart", () => {
    expect(fancyRowPath("test-match", {
      key: "team_total_runs", inn: 2, scope: 42, line: 240.5, side: "under", overLine: 240.5, underLine: 245.5,
    })).toBe("/fixture/test-match/fancy?fm=team_total_runs%3A2&sc=42&ml=245.5");
  });

  it("keeps the clicked line for a whole-match market", () => {
    expect(fancyRowPath("match", { key: "match_sixes", scope: -1, line: 12.5 }))
      .toBe("/fixture/match/fancy?fm=match_sixes&ml=12.5");
  });

  it("omits the default L10 window from the query", () => {
    expect(fancyRowPath("match", { key: "match_sixes", scope: -1, line: 12.5 }, { mw: 10 }))
      .toBe("/fixture/match/fancy?fm=match_sixes&ml=12.5");
  });

  it("keeps a non-default window in the query", () => {
    expect(fancyRowPath("match", { key: "match_sixes", scope: -1, line: 12.5 }, { mw: 20 }))
      .toBe("/fixture/match/fancy?fm=match_sixes&mw=20&ml=12.5");
  });
});
