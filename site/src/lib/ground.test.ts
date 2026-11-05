import { describe, expect, it } from "vitest";
import { filterGames, majorityFormat, venueParts } from "./ground";

const G = [
  { fmt: "T20", gender: "male" }, { fmt: "T20", gender: "female" }, { fmt: "T20" }, { fmt: "ODI", gender: "male" },
];

describe("ground page rules", () => {
  it("splits the stadium from the city", () => {
    expect(venueParts("Eden Gardens, Kolkata, India")).toEqual({ ground: "Eden Gardens", city: "Kolkata, India" });
    expect(venueParts("Lord's")).toEqual({ ground: "Lord's", city: "" });
  });
  it("opens on the format with most games", () => {
    expect(majorityFormat(G)).toBe("T20");
    expect(majorityFormat([])).toBe("T20");
  });
  it("filters by format and gender; a game with no gender counts as men's", () => {
    expect(filterGames(G, "T20", "")).toHaveLength(3);
    expect(filterGames(G, "T20", "male")).toHaveLength(2);
    expect(filterGames(G, "T20", "female")).toHaveLength(1);
    expect(filterGames(G, "ODI", "female")).toHaveLength(0);
  });
});
