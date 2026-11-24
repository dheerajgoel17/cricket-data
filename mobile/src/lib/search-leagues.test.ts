import { leaguesOf } from "./search-leagues";

describe("leaguesOf", () => {
  it("reads the Resolver's { idx, name } answer", () => {
    expect(leaguesOf({ event: () => ({ idx: [3, 5, 7, 9, 11], name: "ban" }) }, "ban")).toEqual([3, 5, 7, 9]);
  });

  it("is empty when nothing matches (null) and never throws", () => {
    expect(leaguesOf({ event: () => null }, "zz")).toEqual([]);
    expect(leaguesOf({}, "zz")).toEqual([]);
    expect(leaguesOf({ event: () => undefined }, "zz")).toEqual([]);
  });

  it("still accepts a bare array", () => {
    expect(leaguesOf({ event: () => [1, 2] }, "x")).toEqual([1, 2]);
  });
});
