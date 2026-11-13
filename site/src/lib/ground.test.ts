import { describe, expect, it } from "vitest";
import { selectMatches, venueStem } from "@cricket/engine/markets.js";
import { filterGames, groundGames, groundSummary, majorityFormat, powerplayOvers, venueParts } from "./ground";

const G = [
  { fmt: "T20", gender: "male" }, { fmt: "T20", gender: "female" }, { fmt: "T20" }, { fmt: "ODI", gender: "male" },
];

/** Two ODIs at one ground: chase won both; PP tape on first inns only. Hand-checked averages. */
function kpiStore() {
  const venues = ["Perth Stadium, Perth"];
  // inn: [team, runs, wkts, balls, 4s, 6s, … extras at 15]
  const inn = (t: number, r: number, w: number, b: number, f4: number, f6: number, ex: number) => {
    const row = Array(16).fill(0);
    row[0] = t; row[1] = r; row[2] = w; row[3] = b; row[4] = f4; row[5] = f6; row[15] = ex;
    return row;
  };
  return {
    n: 2, venues, events: [],
    venueName: (i: number) => venues[i],
    teamName: (i: number) => ["Australia", "Pakistan", "India"][i],
    M: {
      v: [0, 0], a: [0, 0], b: [1, 2], e: [-1, -1],
      d: ["2024-11-10", "2025-01-15"], f: [1, 1], g: [0, 0],
      // match 0: AUS 140 then PAK 138 chase win (w=1, fi=0); match 1: AUS 136 then IND 136 chase win
      inn: [
        [inn(0, 140, 8, 300, 12, 4, 14), inn(1, 138, 6, 295, 10, 3, 10)],
        [inn(0, 136, 9, 300, 11, 4, 12), inn(2, 136, 5, 290, 8, 4, 11)],
      ],
      ov: [
        [[20, 35, 41], [18, 30, 40]], // 1st inns PP10 = 41 (tape short of 10 → use last? oversScore needs length >= n)
        [[22, 38, 42, 45, 48, 50, 52, 55, 58, 60], [20, 33, 39, 44, 47, 49, 51, 54, 56, 59]],
      ],
      r: [0, 0], w: [1, 2], fi: [0, 0], q: [1, 1],
    },
  };
}

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
  it("picks powerplay overs by format", () => {
    expect(powerplayOvers("T20")).toBe(6);
    expect(powerplayOvers("ODI")).toBe(10);
    expect(powerplayOvers("Test")).toBeNull();
  });
  it("averages 1st/2nd inns, chase split, boundaries, extras and highest 1st inns", () => {
    const store = kpiStore();
    // Fix ov[0] to a full 10-over tape so PP counts (oversScore needs length >= n)
    store.M.ov[0][0] = [20, 28, 32, 35, 37, 38, 39, 40, 40, 41];
    const s = groundSummary(store, [0, 1], "ODI");
    expect(s.counted).toBe(2);
    expect(s.avgFirst).toBe(138); // (140+136)/2
    expect(s.avgSecond).toBe(137); // (138+136)/2
    expect(s.chaseWinPct).toBe(100);
    expect(s.defendWinPct).toBe(0);
    expect(s.avgPowerplay).toBe(50.5); // (41+60)/2
    expect(s.powerplayOvers).toBe(10);
    expect(s.foursPerInns).toBe(10.25); // (12+10+11+8)/4
    expect(s.sixesPerInns).toBe(3.75); // (4+3+4+4)/4
    // boundary runs = 4*41 + 6*15 = 164+90 = 254; total runs = 140+138+136+136 = 550 → 46.2%
    expect(s.boundaryRunPct).toBe(46.2);
    expect(s.avgExtras).toBe(23.5); // (14+10+12+11)/2 matches
    expect(s.highestFirst).toMatchObject({ runs: 140, a: "Australia", b: "Pakistan", date: "2024-11-10" });
  });
});
