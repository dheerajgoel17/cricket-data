import { describe, expect, it } from "vitest";
import { selectMatches, venueStem } from "@cricket/engine/markets.js";
import { filterGames, groundGames, majorityFormat, venueParts } from "./ground";

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
  it("includes both Optus Stadium names in the fixture list and ODI market sample", () => {
    const venues = ["Perth Stadium, Perth", "Optus Stadium, Perth", "WACA Ground, Perth"];
    const store = {
      n: 3, venues, events: [],
      venueName: (i: number) => venues[i],
      teamName: (i: number) => ["Australia", "Pakistan"][i],
      M: {
        v: [0, 1, 2], a: [0, 0, 0], b: [1, 1, 1], e: [-1, -1, -1],
        d: ["2024-11-10", "2025-10-19", "2017-01-19"], f: [1, 1, 1], g: [0, 0, 0],
        inn: [[], [], []], r: [0, 0, 0], w: [1, 0, 0], q: [1, 1, 1],
      },
    };
    const fixture = { start: "2026-11-13T03:30Z", a: "Australia", b: "England", fmt: "ODI", venue: venues[1] };
    const ground = groundGames(store, [fixture], fixture.venue);
    expect(ground.atGround.map((game) => game.start)).toEqual([fixture.start, "2025-10-19", "2024-11-10"]);
    expect(selectMatches(store, { fmt: 1, venue: ground.venueIndices })).toEqual([0, 1]);
  });
  it.each([
    ["The Gabba", "Brisbane Cricket Ground"],
    ["Marvel Stadium", "Docklands Stadium"],
    ["Emirates Old Trafford", "Old Trafford"],
    ["Ageas Bowl", "The Rose Bowl"],
    ["Utilita Bowl", "The Rose Bowl"],
    ["Feroz Shah Kotla", "Arun Jaitley Stadium"],
    ["Motera Stadium", "Narendra Modi Stadium"],
    ["Chinnaswamy Stadium", "M. Chinnaswamy Stadium"],
  ])("recognizes %s alongside %s", (alias, name) => {
    expect(venueStem(alias)).toBe(venueStem(name));
  });
});
