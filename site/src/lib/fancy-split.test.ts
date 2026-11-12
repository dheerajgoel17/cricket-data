import { describe, expect, it } from "vitest";
import { fancySplitNote } from "./fancy-split";

describe("fancySplitNote", () => {
  it("explains different Over and Under lines (common on Fancy)", () => {
    expect(fancySplitNote(63.5, 60.5, "FairWin247 Fancy", "bet365"))
      .toBe("Fancy books often list Over and Under on different lines.");
  });
  it("explains different books on the same line", () => {
    expect(fancySplitNote(63.5, 63.5, "FairWin247 Fancy", "bet365"))
      .toBe("Best Over and Under come from different books.");
  });
  it("is silent when one book prices both sides on one line", () => {
    expect(fancySplitNote(63.5, 63.5, "bet365", "bet365")).toBeNull();
  });
  it("is silent when a side is missing", () => {
    expect(fancySplitNote(63.5, null, "bet365", null)).toBeNull();
    expect(fancySplitNote(null, null, null, null)).toBeNull();
  });
});
