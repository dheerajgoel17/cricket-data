import type { Row } from "@/lib/hot";
import { sideRate, withModelSide } from "@/lib/model-side";

// shrunk chance = (hits + 10 * market chance) / (played + 10); edge = chance * price - 1 (engine `sideEdge`)
const row = (hits: number, played: number, prior: number | null, over: number, under: number): Row =>
  ({ l10: { hits, played, p: played ? hits / played : null }, prior, over, under, edge: null }) as unknown as Row;

describe("withModelSide", () => {
  test("an over that cleared 8 of 10 against an even market at 2.00 is a +30% over", () => {
    // over: (8 + 5) / 20 = 0.65, 0.65 * 2 - 1 = +0.30; under: (2 + 5) / 20 = 0.35, 0.35 * 2 - 1 = -0.30
    const r = withModelSide(row(8, 10, 0.5, 2, 2));
    expect(r.side).toBe("over");
    expect(r.edge).toBeCloseTo(0.3, 10);
  });

  test("one that cleared only 2 of 10 is a +30% under, not a -30% over", () => {
    const r = withModelSide(row(2, 10, 0.5, 2, 2));
    expect(r.side).toBe("under");
    expect(r.edge).toBeCloseTo(0.3, 10);
  });

  test("the under is priced at its own price: 2 of 10 at an under of 1.50 is (8 + 5) / 20 * 1.5 - 1 = -0.025", () => {
    const r = withModelSide(row(2, 10, 0.5, 2, 1.5)); // over: 0.35 * 2 - 1 = -0.30; under: 0.65 * 1.5 - 1 = -0.025, the better of the two
    expect(r.side).toBe("under");
    expect(r.edge).toBeCloseTo(-0.025, 10);
  });

  test("under 10 games, or with no market chance, there is no edge on either side and the row stays on the over", () => {
    expect(withModelSide(row(4, 5, 0.5, 2, 2))).toMatchObject({ edge: null, side: "over" });
    expect(withModelSide(row(8, 10, null, 2, 2))).toMatchObject({ edge: null, side: "over" });
  });

  test("a side with no price is not claimed: with no under price the over stands", () => {
    const r = withModelSide(row(2, 10, 0.5, 2, 0));
    expect(r.side).toBe("over");
    expect(r.edge).toBeCloseTo(-0.3, 10);
  });
});

describe("sideRate", () => {
  test("an under row ranks by the share of games that did not clear the line", () => {
    expect(sideRate({ ...row(2, 10, 0.5, 2, 2), side: "under" })).toBeCloseTo(0.8, 10);
    expect(sideRate({ ...row(8, 10, 0.5, 2, 2), side: "over" })).toBeCloseTo(0.8, 10);
    expect(sideRate(row(0, 0, 0.5, 2, 2))).toBeNull();
  });
});
