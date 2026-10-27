import test from "node:test";
import assert from "node:assert/strict";
import {
  attachSummary, bookFixtures, buildLive, ballsToOvers, fixtureInBooks, liveBlurb, liveBoard, liveForFixture, liveMarket, livePlayer, liveStat,
  namesMatch, attachCrexUrls, crexScorecardUrl, hasCard, liveCard, overlayCrex, oversToBalls, parseCrexLive, parseCrexSchedule, parseCrexScorecard, parseHeader, parseScore, parseSummary,
  pricedLive, strikeRate, teamKey, teamScore, wantsCard,
} from "../src/engine/live.js";

const header = {
  sports: [{
    leagues: [{
      id: "19439",
      events: [{
        id: "1559564",
        date: "2026-10-27T09:00:00Z",
        eventType: "ODI",
        class: { eventType: "ODI", generalClassCard: "ODI" },
        status: "in",
        summary: "Netherlands chose to bat",
        fullStatus: { summary: "NED 145/4 (32.2 ov)", battingTeamId: 7, type: { state: "in", description: "Live" } },
        competitors: [
          { id: 7, displayName: "Netherlands", abbreviation: "NED", score: "145/4 (32.2 ov)" },
          { id: 8, displayName: "Oman", abbreviation: "OMA", score: "" },
        ],
      }, {
        id: "99",
        date: "2026-10-27T07:00:00Z",
        eventType: "T20",
        class: { eventType: "T20", generalClassCard: "T20I" },
        status: "pre",
        fullStatus: { type: { state: "pre" } },
        competitors: [
          { id: 1, displayName: "New Zealand", abbreviation: "NZ", score: "" },
          { id: 2, displayName: "India", abbreviation: "IND", score: "" },
        ],
      }],
    }],
  }],
};

const summary = {
  matchcards: [
    {
      headline: "Batting", typeID: "11", inningsNumber: 1, teamName: "Netherlands", runs: "145", total: "(4 wkts; 32.2 ovs)",
      playerDetails: [
        { playerID: "1", playerName: "Vikramjit Singh", dismissal: "caught", runs: "40", ballsFaced: "55", fours: "4", sixes: "1" },
        { playerID: "2", playerName: "SA Engelbrecht", dismissal: "not out", runs: "62", ballsFaced: "70", fours: "5", sixes: "2" },
        { playerID: "3", playerName: "AT Nidamanuru", dismissal: "", runs: "12", ballsFaced: "18", fours: "1", sixes: "0" },
      ],
    },
    {
      headline: "Bowling", typeID: "12", inningsNumber: 1, teamName: "Oman",
      playerDetails: [
        { playerID: "9", playerName: "Bilal Khan", overs: "8.0", maidens: "1", conceded: "28", wickets: "2" },
        { playerID: "10", playerName: "S Shrivastava", overs: "6.2", maidens: "0", conceded: "31", wickets: "1" },
      ],
    },
  ],
};

test("parseScore reads the current innings from ESPN's score string", () => {
  assert.deepEqual(parseScore("145/4 (16.2 ov)"), { display: "145/4 (16.2 ov)", runs: 145, wkts: 4, overs: 16.2 });
  assert.equal(parseScore("317 & 187/9 (65 ov, target 313)").runs, 187);
  assert.equal(parseScore("317 & 187/9 (65 ov, target 313)").wkts, 9);
  assert.equal(parseScore("").runs, null);
});

test("oversToBalls uses cricket tenths (16.2 = 98 balls)", () => {
  assert.equal(oversToBalls(16.2), 98);
  assert.equal(oversToBalls("8.0"), 48);
  assert.equal(oversToBalls("6.2"), 38);
  assert.equal(ballsToOvers(21), 3.3);
  assert.equal(ballsToOvers(36), 6);
  assert.equal(strikeRate(20, 12), 166.67);
  assert.equal(strikeRate(24, 16), 150);
});

test("namesMatch pairs ESPN initials with full book names", () => {
  assert.equal(namesMatch("HC Brook", "Harry Brook"), true);
  assert.equal(namesMatch("JC Buttler", "Jos Buttler"), true);
  assert.equal(namesMatch("SA Engelbrecht", "Sybrand Engelbrecht"), true);
  assert.equal(namesMatch("JM Bairstow", "Joe Root"), false);
  assert.equal(namesMatch("Vikramjit Singh", "Vikramjit Singh"), true);
});

test("teamKey folds Under-19 labels", () => {
  assert.equal(teamKey("Oman Under-19s"), teamKey("Oman U19"));
  assert.equal(teamKey("India Women"), teamKey("India (W)"));
});

test("liveBlurb drops ESPN ground-local kick-off lines", () => {
  assert.equal(liveBlurb({ summary: "Starts at 09:30 local time", note: "Live" }), "");
  assert.equal(liveBlurb({ summary: "NZ A require 126 runs" }), "NZ A require 126 runs");
  assert.equal(liveBlurb({ summary: "Starts at 09:45 local time", note: "Match delayed by bad light" }), "Match delayed by bad light");
});

test("header + summary: team score, player so-far, match totals (hand-computed)", () => {
  const [live, up] = parseHeader(header);
  assert.equal(live.status, "live");
  assert.equal(live.fmt, "ODI");
  assert.equal(live.teams[0].runs, 145);
  assert.equal(live.teams[0].wkts, 4);
  assert.equal(live.teams[0].batting, true);
  assert.equal(wantsCard(live), true);
  assert.equal(wantsCard(up), false);

  const m = attachSummary(live, parseSummary(summary));
  // 40+62+12 = 114 from named batters; innings total is ESPN's 145 (extras)
  assert.equal(liveMarket(m, "match_runs"), 145);
  assert.equal(liveMarket(m, "match_sixes"), 3); // 1+2+0
  assert.equal(liveMarket(m, "match_fours"), 10); // 4+5+1
  assert.equal(liveMarket(m, "match_wickets"), 4);
  assert.equal(liveMarket(m, "first_innings_runs"), 145);
  assert.equal(liveMarket(m, "top_score"), 62);
  assert.equal(liveStat(livePlayer(m, "Sybrand Engelbrecht"), "runs"), 62);
  assert.equal(liveStat(livePlayer(m, "Sybrand Engelbrecht"), "sixes"), 2);
  assert.equal(liveStat(livePlayer(m, "Bilal Khan"), "wickets"), 2);
  assert.equal(liveStat(livePlayer(m, "Bilal Khan"), "runs_conceded"), 28);
  assert.equal(liveStat(livePlayer(m, "S Shrivastava"), "balls_bowled"), 38);
  assert.equal(livePlayer(m, "Joe Root"), null);
  const inn = liveCard(m)[0];
  assert.equal(inn.team, "Netherlands");
  assert.equal(inn.batters[0].dismissal, "caught");
  assert.equal(inn.batters[1].dismissal, "not out");
  assert.equal(inn.batters[1].sr, 88.57); // 62 off 70
  assert.equal(inn.batters[2].dismissal, "not out");
  assert.equal(inn.bowlers[0].maidens, 1);
  assert.equal(inn.bowlers[0].econ, 3.5); // 28 off 8.0
  assert.equal(inn.bowlers[1].overs, 6.2);
});

test("pricedLive keeps only matches the books price (player props or fancy), not empty ESPN games", () => {
  const books = bookFixtures({
    events: [{ match: "New Zealand vs India", start_utc: "2026-10-27T07:00:00Z" }],
    fancy: [{ match: "Netherlands vs Oman", start_utc: "2026-10-27T09:00:00Z" }],
  });
  assert.equal(books.length, 2);
  const espn = parseHeader(header);
  const kept = pricedLive(espn, books);
  assert.equal(kept.length, 2);
  assert.equal(pricedLive(espn, []).length, 0);
  assert.equal(fixtureInBooks(books, { a: "Netherlands", b: "Oman", start: "2026-10-27T09:00:00Z" }), true);
  assert.equal(fixtureInBooks(books, { a: "Oman U19", b: "Afghanistan U19", start: "2026-10-27T05:30:00Z" }), false);
});

function crexHtml(payload) {
  return `<script id="app-root-state">${JSON.stringify(payload).replace(/"/g, "&q;")}</script>`;
}

test("parseCrexSchedule reads 119-2 / 17.3 as 119/2 (17.3 ov) (hand-computed)", () => {
  const html = crexHtml({ "https://stats.crickapi.com/fixture/getFixture": [{
    team1: "Netherlands", team2: "Oman", t1SName: "NED", t2SName: "OMA",
    s1: "119-2", o1: "17.3", s2: "", o2: "", t: Date.parse("2026-10-27T05:30:00Z"),
    status: 1, statusText: "OMA opt to Bowl", bf: "12", t1f: "12", t2f: "15",
    mf: "14VC", link: "/cricket-live-score/ned-vs-oma-14VC",
  }] });
  const [m] = parseCrexSchedule(html);
  assert.equal(m.status, "live");
  assert.equal(m.teams[0].display, "119/2 (17.3 ov)");
  assert.equal(m.teams[0].runs, 119);
  assert.equal(m.teams[0].wkts, 2);
  assert.equal(m.teams[0].overs, 17.3);
  assert.equal(m.teams[0].batting, true);
  assert.equal(m.teams[1].display, "");
});

test("parseCrexLive current batters and bowler (hand-computed)", () => {
  const html = crexHtml({ "https://api.goscorer.com/api/v3/getSV3": {
    team1_f_n: "Netherlands", team2_f_n: "Oman", team1: "NED", team2: "OMA", team1short: "NED", team2short: "OMA",
    score1: "119-2", over1: "17.3", score2: "", over2: "", rt: "Netherlands", status: 1, comment1: "OMA opt to Bowl",
    player_full_name1: "Bas de Leede", run1: "3", ball1: "(9)", four1: "0", six1: "0",
    player_full_name2: "Cedric de Lange", run2: "37", ball2: "(34)", four2: "5", six2: "0",
    bowler_full_name: "Aryan Bisht", bwr: "2-8", bover: "3.3",
    lwname1: "Noah Croes", lwrun1: "5", lwball1: "(16)",
    st: "2", partnerruns: 40, partnerballs: 43, crr: "6.80", rrr: "--", beco: "2.42",
    sr1: "33.33", sr2: "108.82",
    lastovers: [{ over: "Over 17", overinfo: ["1", "0", "4", "W", "0", "1"], total: 6 }, { over: "Over 18", overinfo: ["0", "1", "1"], total: 2 }],
  } });
  const m = parseCrexLive(html);
  assert.equal(m.teams[0].runs, 119);
  assert.equal(liveStat(livePlayer(m, "Cedric de Lange"), "runs"), 37);
  assert.equal(liveStat(livePlayer(m, "Cedric de Lange"), "fours"), 5);
  assert.equal(liveStat(livePlayer(m, "Bas de Leede"), "balls"), 9);
  assert.equal(liveStat(livePlayer(m, "Aryan Bisht"), "wickets"), 2);
  assert.equal(liveStat(livePlayer(m, "Aryan Bisht"), "runs_conceded"), 8);
  assert.equal(liveStat(livePlayer(m, "Aryan Bisht"), "balls_bowled"), 21); // 3.3 ov
  assert.equal(liveMarket(m, "match_runs"), 119);
  assert.equal(livePlayer(m, "Cedric de Lange").strike, true);
  assert.equal(livePlayer(m, "Bas de Leede").strike, false);
  const board = liveBoard(m);
  assert.deepEqual(board.batters.map((p) => p.name), ["Cedric de Lange", "Bas de Leede"]); // striker first
  assert.equal(board.batters[0].sr, 108.82);
  assert.equal(board.lastWicket.name, "Noah Croes");
  assert.equal(board.bowler.name, "Aryan Bisht");
  assert.equal(board.bowler.econ, 2.42);
  assert.equal(board.partnership.runs, 40);
  assert.equal(board.crr, 6.8);
  assert.equal(board.rrr, null);
  assert.deepEqual(board.thisOver, ["0", "1", "1"]);
  assert.deepEqual(board.overs, [{ balls: ["1", "0", "4", "W", "0", "1"] }, { balls: ["0", "1", "1"] }], "deliveries stay grouped by over");
});

test("overlayCrex fills empty ESPN scores from CREX and does not overwrite ESPN numbers", () => {
  const espn = parseHeader(header);
  espn[0].teams = espn[0].teams.map((t) => ({ ...t, display: "", runs: null, wkts: null, overs: null }));
  const crex = parseCrexSchedule(crexHtml({ "https://stats.crickapi.com/fixture/getFixture": [{
    team1: "Netherlands", team2: "Oman", s1: "119-2", o1: "17.3", t: Date.parse("2026-10-27T09:00:00Z"), status: 1,
  }] }));
  const [filled] = overlayCrex(espn, crex);
  assert.equal(filled.teams[0].runs, 119);
  const [kept] = overlayCrex(parseHeader(header), crex);
  assert.equal(kept.teams[0].runs, 145);
});

test("liveBoard on an ESPN card keeps not-out batters and does not guess the current bowler", () => {
  const m = attachSummary(parseHeader(header)[0], parseSummary(summary));
  const board = liveBoard(m);
  assert.deepEqual(board.batters.map((p) => p.name), ["SA Engelbrecht", "AT Nidamanuru"]);
  assert.equal(board.lastWicket.name, "Vikramjit Singh");
  assert.equal(board.bowler, null);
});

test("attachCrexUrls copies the match page link without taking the 5-minute schedule score", () => {
  const espn = parseHeader(header);
  espn[0].teams = espn[0].teams.map((t) => ({ ...t, display: "", runs: null, wkts: null, overs: null }));
  const crex = parseCrexSchedule(crexHtml({ "https://stats.crickapi.com/fixture/getFixture": [{
    team1: "Netherlands", team2: "Oman", s1: "119-2", o1: "17.3", t: Date.parse("2026-10-27T09:00:00Z"), status: 1,
    link: "/cricket-live-score/ned-vs-oma-14VC",
  }] }));
  const [m] = attachCrexUrls(espn, crex);
  assert.match(m.url, /ned-vs-oma-14VC/);
  assert.equal(m.teams[0].display, "");
  assert.equal(m.teams[0].runs, null);
  const toss = parseCrexSchedule(crexHtml({ "https://stats.crickapi.com/fixture/getFixture": [{
    team1: "New Zealand", team2: "India", s1: "0/0", o1: "0.0", t: Date.parse("2026-10-27T07:00:00Z"), status: 1,
  }] }));
  assert.equal(toss[0].status, "upcoming");
  assert.equal(toss[0].teams[0].display, "");
});

test("crexScorecardUrl appends /match-scorecard", () => {
  assert.equal(crexScorecardUrl("https://crex.com/cricket-live-score/ned-vs-oma-14VC"), "https://crex.com/cricket-live-score/ned-vs-oma-14VC/match-scorecard");
  assert.equal(crexScorecardUrl("https://crex.com/x/match-scorecard"), "https://crex.com/x/match-scorecard");
});

test("parseCrexScorecard batting, extras, FOW, yet-to-bat, bowling (hand-computed)", () => {
  const html = crexHtml({
    "https://api.goscorer.com/api/v3/getSC4": [{
      a: ["E5.34.24.0.1"],
      b: ["FL.52.37.6.2.70.107.2.AXL.A9/", "FP5.12.11.2.0.27.38.1.E5/", "TIL"],
      c: "V", d: "171/10(115", e: "2.5.0.1.0",
    }],
    "https://oc.crickapi.com/mapping/getHomeMapData": {
      p: [
        { f_key: "FL", n: "Shai Hope" }, { f_key: "AXL", n: "Naman Dhir" }, { f_key: "A9", n: "Axar Patel" },
        { f_key: "FP5", n: "Evin Lewis" }, { f_key: "E5", n: "Jasprit Bumrah" }, { f_key: "TIL", n: "Tilak Varma" },
      ],
      t: [{ f_key: "V", n: "West Indies" }, { f_key: "O", n: "India" }],
    },
  });
  const m = parseCrexScorecard(html);
  const inn = liveCard(m)[0];
  assert.equal(inn.team, "West Indies");
  assert.equal(inn.runs, 171);
  assert.equal(inn.wkts, 10);
  assert.equal(inn.overs, 19.1); // 115 balls
  assert.equal(inn.batters[0].name, "Shai Hope");
  assert.equal(inn.batters[0].runs, 52);
  assert.equal(inn.batters[0].sr, 140.54); // 52 off 37
  assert.equal(inn.batters[0].dismissal, "c Axar Patel b Naman Dhir");
  assert.equal(inn.batters[1].dismissal, "b Jasprit Bumrah");
  assert.equal(inn.yetToBat[0], "Tilak Varma");
  assert.equal(inn.extras.total, 8); // 2+5+0+1+0
  assert.equal(inn.extras.byes, 2);
  assert.equal(inn.extras.legByes, 5);
  assert.equal(inn.fow[0].runs, 70);
  assert.equal(inn.fow[0].name, "Shai Hope");
  assert.equal(inn.bowlers[0].name, "Jasprit Bumrah");
  assert.equal(inn.bowlers[0].overs, 4); // 24 balls
  assert.equal(inn.bowlers[0].maidens, 0);
  assert.equal(inn.bowlers[0].econ, 8.5); // 34 off 4.0
  assert.equal(hasCard(m), true);
});

test("overlayCrex does not replace an ESPN scorecard", () => {
  const espn = attachSummary(parseHeader(header)[0], parseSummary(summary));
  const crex = parseCrexScorecard(crexHtml({
    "https://api.goscorer.com/api/v3/getSC4": [{ a: [], b: ["FL.1.1.0.0"], c: "V", d: "1/0(1", e: "0.0.0.0.0" }],
    "https://oc.crickapi.com/mapping/getHomeMapData": { p: [{ f_key: "FL", n: "Shai Hope" }], t: [{ f_key: "V", n: "Netherlands" }, { f_key: "O", n: "Oman" }] },
  }));
  const [kept] = overlayCrex([espn], [{ ...crex, teams: espn.teams, start: espn.start }]);
  assert.equal(liveCard(kept)[0].batters[0].name, "Vikramjit Singh");
});

test("liveForFixture matches CREX team names within the start window", () => {
  const doc = buildLive(header, { 1559564: summary }, "2026-10-27T10:00:00Z");
  const hit = liveForFixture(doc, { a: "Netherlands", b: "Oman", start: "2026-10-27T09:00:00Z" });
  assert.equal(hit?.id, "1559564");
  assert.equal(teamScore(hit, "Netherlands").display, "145/4 (32.2 ov)");
  const miss = liveForFixture(doc, { a: "India", b: "New Zealand", start: "2026-10-27T07:00:00Z" });
  assert.equal(miss?.status, "upcoming");
  assert.equal(liveForFixture(doc, { a: "Spain", b: "Italy", start: "2026-10-27T09:00:00Z" }), null);
});
