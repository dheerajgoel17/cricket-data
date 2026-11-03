import { propNotes } from "@/lib/prop-context";

const rate = (hits: number, played: number) => ({ hits, played, p: played ? hits / played : null });

describe("propNotes", () => {
  test("says nothing without a key point", () => {
    expect(propNotes({ ven: rate(2, 4), h2h: rate(2, 3) }, "NZ")).toEqual([]); // 50% and 67%: in between
    expect(propNotes({ ven: rate(0, 0), h2h: null }, "NZ")).toEqual([]);
    expect(propNotes({}, "NZ")).toEqual([]);
  });

  test("needs at least three games before a record counts", () => {
    expect(propNotes({ ven: rate(2, 2), h2h: rate(0, 2) }, "NZ")).toEqual([]);
  });

  test("a decisive record at the ground names the side it is on, with that side's count", () => {
    expect(propNotes({ ven: rate(7, 10) }, "NZ")).toEqual([{ label: "At the ground", record: "7 of 10 over", side: "over" }]);
    expect(propNotes({ ven: rate(3, 10) }, "NZ")).toEqual([{ label: "At the ground", record: "7 of 10 under", side: "under" }]); // cleared 3 of 10: the under went 7
    expect(propNotes({ ven: rate(6, 10) }, "NZ")).toEqual([]); // 60%
  });

  test("the ground comes first and the opponent follows when both are key", () => {
    expect(propNotes({ ven: rate(3, 4), h2h: rate(0, 3) }, "IND").map((n) => `${n.label} | ${n.record}`)).toEqual(["At the ground | 3 of 4 over", "vs IND | 3 of 3 under"]);
  });
});
