import test from "node:test";
import assert from "node:assert/strict";
import {
  ballsToOvers, bookFixtures, formatOf, buildMatch, notInXI, playingXI, cardPageUrl, fixtureInBooks, hasCard, lineNotIn, lineStanding, lineVerdict, liveBlurb, liveBoard, liveCard, liveForFixture, liveMarket, livePlayer, liveState, liveStat,
  namesMatch, oversToBalls, parseFixtureCsv, parseMatchPage, parseSchedule, parseCardPage, parseScore, pricedLive, settleLines, strikeRate, teamKey, teamScore, unlistedRows, wantsCard,
} from "../src/engine/live.js";
import { identityIndex } from "../src/engine/identity.js";

function pageHtml(payload) {
  return `<script id="app-root-state">${JSON.stringify(payload).replace(/"/g, "&q;")}</script>`;
}

const FIXTURE = "https://src.test/fixture/getFixture";
const LIVE = "https://src.test/v3/getSV3";
const CARD = "https://src.test/v3/getSC4";
const MAP = "https://src.test/mapping/getHomeMapData";

/** NZ v India T20I, second innings. The schedule page (cached ~5 min) still shows India at 7/0 (0.2). */
const nzInd = {
  team1: "New Zealand", team2: "India", t1SName: "NZ", t2SName: "IND", t1f: "R", t2f: "O", bf: "R",
  s1: "198-3", o1: "20.0", s2: "7-0", o2: "0.2", t: Date.parse("2026-10-27T07:00:00Z"), status: 1, winningTeam: -1, w: -1,
  statusText: "Live", fo: "T20I", mf: "12JE", link: "/cricket-live-score/ind-vs-nz-3rd-t20i-12JE",
};

/** Match page a minute later: India 42/0 (1.4), Sooryavanshi on strike, Milne bowling. */
const nzIndLive = pageHtml({ [LIVE]: {
  team1_f_n: "India", team2_f_n: "New Zealand", team1short: "IND", team2short: "NZ", rt: "India", inning: 2, status: 1,
  score1: "42-0", over1: "1.4", score2: "198-3", over2: "20.0",
  comment1: "IND need <b style='font-family: $font-DM; color: #cecece;'>157 runs </b> in <b>110 balls </b>",
  player_full_name1: "Vaibhav Sooryavanshi", run1: "13", ball1: "(5)", four1: "1", six1: "1", sr1: "260.00",
  player_full_name2: "Abhishek Sharma", run2: "23", ball2: "(6)", four2: "3", six2: "2", sr2: "383.33", os1: 1, os2: 0,
  bowler_full_name: "Adam Milne", bwr: "0-22", bover: "0.4", beco: "33.00",
  partnerruns: 42, partnerballs: 10, crr: "25.20", rrr: "8.56",
  lastovers: [{ overinfo: ["4", "1", "0", "6", "1", "0"] }, { overinfo: ["6", "6", "4", "nb"] }],
} });

/** Scorecard page: NZ 198/3 (120 balls) and India 42/0 (10 balls). Wickets fell Seifert, Phillips, Allen: the card lists them in batting order. */
const nzIndCard = pageHtml({
  [CARD]: [{
    c: "R", d: "198/3(120", e: "4.5.2.0.0",
    b: ["SEI.2.6.0.0.5.6.1.KUM", "ALN.40.25.4.3.104.57.5.ARS", "MIT.89.52.8.4", "PHI.17.14.1.0.64.30.1.ARS", "JAC.39.23.3.3"],
    a: ["KUM.38.24.0.1", "ARS.45.24.0.2"],
  }, {
    c: "O", d: "42/0(10", e: "0.0.4.2.0",
    b: ["SOO.13.5.1.1", "ABH.23.6.3.2"],
    a: ["DUF.20.6.0.0", "MIL.22.4.0.0"],
  }],
  [MAP]: {
    p: [
      { f_key: "SEI", n: "Tim Seifert" }, { f_key: "ALN", n: "Finn Allen" }, { f_key: "MIT", n: "Daryl Mitchell" }, { f_key: "PHI", n: "Glenn Phillips" },
      { f_key: "JAC", n: "Bevon Jacobs" }, { f_key: "SOO", n: "Vaibhav Sooryavanshi" }, { f_key: "ABH", n: "Abhishek Sharma" },
      { f_key: "KUM", n: "Bhuvneshwar Kumar" }, { f_key: "ARS", n: "Arshdeep Singh" }, { f_key: "DUF", n: "Jacob Duffy" }, { f_key: "MIL", n: "Adam Milne" },
    ],
    t: [{ f_key: "R", n: "New Zealand" }, { f_key: "O", n: "India" }],
  },
});

const chase = () => buildMatch(parseSchedule(pageHtml({ [FIXTURE]: [nzInd] }))[0], parseMatchPage(nzIndLive), parseCardPage(nzIndCard));

test("parseScore reads the current innings from a score string", () => {
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

test("namesMatch pairs initials with full book names", () => {
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

test("liveBlurb shows the source's status line, not a bare Live", () => {
  assert.equal(liveBlurb({ summary: "Live", note: "" }), "");
  assert.equal(liveBlurb({ summary: "NZ A need 126 runs in 90 balls" }), "NZ A need 126 runs in 90 balls");
  assert.equal(liveBlurb({ summary: "Live", note: "Match delayed by bad light" }), "Match delayed by bad light");
});

test("formatOf maps the source's format labels to the site's formats", () => {
  for (const [label, fmt] of [["T20I", "T20"], ["T20", "T20"], ["ODI", "ODI"], ["List A", "ODI"], ["Youth ODI", "ODI"], ["One Day", "ODI"], ["Test", "Test"], ["First Class", "Test"], ["Multi Day", "Test"], ["The Hundred", "Hundred"], ["", ""]]) {
    assert.equal(formatOf(label), fmt, label);
  }
});

test("parseSchedule reads 119-2 / 17.3 as 119/2 (17.3 ov) (hand-computed)", () => {
  const html = pageHtml({ [FIXTURE]: [{
    team1: "Netherlands", team2: "Oman", t1SName: "NED", t2SName: "OMA",
    s1: "119-2", o1: "17.3", s2: "", o2: "", t: Date.parse("2026-10-27T05:30:00Z"),
    status: 1, statusText: "OMA opt to Bowl", bf: "12", t1f: "12", t2f: "15", fo: "ODI",
    mf: "14VC", link: "/cricket-live-score/ned-vs-oma-14VC",
  }] });
  const [m] = parseSchedule(html, "https://src.test");
  assert.equal(m.status, "live");
  assert.equal(m.fmt, "ODI");
  assert.equal(m.id, "14VC");
  assert.equal(m.url, "https://src.test/cricket-live-score/ned-vs-oma-14VC");
  assert.equal(m.summary, "OMA opt to Bowl");
  assert.equal(m.teams[0].display, "119/2 (17.3 ov)");
  assert.equal(m.teams[0].runs, 119);
  assert.equal(m.teams[0].wkts, 2);
  assert.equal(m.teams[0].overs, 17.3);
  assert.equal(m.teams[0].batting, true);
  assert.equal(m.teams[1].display, "");
  assert.equal(m.teams[1].batting, false);
});

test("parseSchedule: second innings bats the side that did not bat first; toss-time 0/0 is not a score; a result is final", () => {
  const [m] = parseSchedule(pageHtml({ [FIXTURE]: [nzInd] }));
  assert.equal(m.fmt, "T20");
  assert.equal(m.teams[0].batting, false); // New Zealand batted first (bf) and are done
  assert.equal(m.teams[1].batting, true);
  assert.equal(m.teams[1].display, "7/0 (0.2 ov)");
  const [toss] = parseSchedule(pageHtml({ [FIXTURE]: [{ team1: "New Zealand", team2: "India", s1: "0/0", o1: "0.0", t: Date.parse("2026-10-27T07:00:00Z"), status: 1 }] }));
  assert.equal(toss.status, "upcoming");
  assert.equal(toss.teams[0].display, "");
  assert.equal(toss.teams[0].batting, false);
  const [won] = parseSchedule(pageHtml({ [FIXTURE]: [{ ...nzInd, winningTeam: 1, w: 1, s2: "199-4", o2: "18.2" }] }));
  assert.equal(won.status, "final");
});

test("wantsCard: live rows, and priced rows about to start; not tomorrow's, not finished ones", () => {
  const now = Date.parse("2026-10-27T07:00:00Z");
  const row = (status, start) => ({ status, start });
  assert.equal(wantsCard(row("live", "2026-10-27T05:00:00Z"), now), true);
  assert.equal(wantsCard(row("upcoming", "2026-10-27T07:10:00Z"), now), true); // schedule page is ~5 min behind
  assert.equal(wantsCard(row("upcoming", "2026-10-27T08:20:00Z"), now), true); // 80 min out: the XIs are up by the toss
  assert.equal(wantsCard(row("upcoming", "2026-10-27T06:30:00Z"), now), true);
  assert.equal(wantsCard(row("upcoming", "2026-10-27T09:00:00Z"), now), false);
  assert.equal(wantsCard(row("upcoming", "2026-10-26T07:00:00Z"), now), false); // long gone, never scored
  assert.equal(wantsCard(row("final", "2026-10-27T05:00:00Z"), now), true, "a finished match keeps its scorecard for a day and a half");
  assert.equal(wantsCard(row("final", "2026-10-25T05:00:00Z"), now), false);
});

test("pricedLive keeps only matches the books price (player props or fancy), not unpriced games", () => {
  const books = bookFixtures({
    events: [{ match: "New Zealand vs India", start_utc: "2026-10-27T07:00:00Z" }],
    fancy: [{ match: "Netherlands vs Oman", start_utc: "2026-10-27T09:00:00Z" }],
  });
  assert.equal(books.length, 2);
  const rows = parseSchedule(pageHtml({ [FIXTURE]: [
    nzInd,
    { team1: "Netherlands", team2: "Oman", t: Date.parse("2026-10-27T09:00:00Z"), s1: "10-0", o1: "2.0", status: 1 },
    { team1: "Oman U19", team2: "Afghanistan U19", t: Date.parse("2026-10-27T05:30:00Z"), s2: "421-5", o2: "50.0", status: 1 },
  ] }));
  assert.equal(pricedLive(rows, books).length, 2);
  assert.equal(pricedLive(rows, []).length, 0);
  assert.equal(fixtureInBooks(books, { a: "Netherlands", b: "Oman", start: "2026-10-27T09:00:00Z" }), true);
  assert.equal(fixtureInBooks(books, { a: "Oman U19", b: "Afghanistan U19", start: "2026-10-27T05:30:00Z" }), false);
});

test("parseMatchPage current batters and bowler (hand-computed)", () => {
  const html = pageHtml({ [LIVE]: {
    team1_f_n: "Netherlands", team2_f_n: "Oman", team1: "NED", team2: "OMA", team1short: "NED", team2short: "OMA",
    score1: "119-2", over1: "17.3", score2: "", over2: "", rt: "Netherlands", status: 1, inning: 1,
    comment1: "NED <b style='color: #ccc;'>need 12 runs </b> in <b>30 balls </b>",
    player_full_name1: "Bas de Leede", run1: "3", ball1: "(9)", four1: "0", six1: "0",
    player_full_name2: "Cedric de Lange", run2: "37", ball2: "(34)", four2: "5", six2: "0",
    bowler_full_name: "Aryan Bisht", bwr: "2-8", bover: "3.3",
    lwname1: "Noah Croes", lwrun1: "5", lwball1: "(16)",
    os1: 0, os2: 1, partnerruns: 40, partnerballs: 43, crr: "6.80", rrr: "--", beco: "2.42",
    sr1: "33.33", sr2: "108.82",
    lastovers: [{ over: "Over 17", overinfo: ["1", "0", "4", "W", "0", "1"], total: 6 }, { over: "Over 18", overinfo: ["0", "1", "1"], total: 2 }],
  } });
  const m = parseMatchPage(html);
  assert.equal(m.teams[0].runs, 119);
  assert.equal(m.summary, "NED need 12 runs in 30 balls", "markup in the status line is stripped");
  assert.equal(m.innings[0].n, 1);
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

test("cardPageUrl appends /match-scorecard", () => {
  assert.equal(cardPageUrl("https://src.test/cricket-live-score/ned-vs-oma-14VC"), "https://src.test/cricket-live-score/ned-vs-oma-14VC/match-scorecard");
  assert.equal(cardPageUrl("https://src.test/x/match-scorecard"), "https://src.test/x/match-scorecard");
});

test("parseCardPage batting, extras, FOW, yet-to-bat, bowling (hand-computed)", () => {
  const html = pageHtml({
    [CARD]: [{
      a: ["E5.34.24.0.1"],
      b: ["FL.52.37.6.2.70.107.2.AXL.A9/", "FP5.12.11.2.0.27.38.1.E5/", "TIL"],
      c: "V", d: "171/10(115", e: "2.5.0.1.0",
    }],
    [MAP]: {
      p: [
        { f_key: "FL", n: "Shai Hope" }, { f_key: "AXL", n: "Naman Dhir" }, { f_key: "A9", n: "Axar Patel" },
        { f_key: "FP5", n: "Evin Lewis" }, { f_key: "E5", n: "Jasprit Bumrah" }, { f_key: "TIL", n: "Tilak Varma" },
      ],
      t: [{ f_key: "V", n: "West Indies" }, { f_key: "O", n: "India" }],
    },
  });
  const m = parseCardPage(html);
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
  assert.deepEqual(inn.fow.map((w) => [w.wkts, w.runs, w.name]), [[1, 27, "Evin Lewis"], [2, 70, "Shai Hope"]], "wickets are numbered in the order they fell, not batting order");
  assert.equal(inn.bowlers[0].name, "Jasprit Bumrah");
  assert.equal(inn.bowlers[0].overs, 4); // 24 balls
  assert.equal(inn.bowlers[0].maidens, 0);
  assert.equal(inn.bowlers[0].econ, 8.5); // 34 off 4.0
  assert.equal(hasCard(m), true);
});

test("India's chase has started: the board, scores and card follow the second innings, not New Zealand's finished one", () => {
  const m = chase();
  assert.equal(m.status, "live");
  assert.equal(teamScore(m, "India").display, "42/0 (1.4 ov)", "the match page is fresher than the schedule's 7/0");
  assert.equal(teamScore(m, "India").batting, true);
  assert.equal(teamScore(m, "New Zealand").display, "198/3 (20.0 ov)");
  assert.equal(liveBlurb(m), "IND need 157 runs in 110 balls");

  const board = liveBoard(m);
  assert.deepEqual(board.batters.map((p) => p.name), ["Vaibhav Sooryavanshi", "Abhishek Sharma"], "Mitchell and Jacobs finished not out in the first innings");
  assert.equal(board.batters[0].strike, true);
  assert.equal(board.batters[0].sr, 260);
  assert.equal(board.lastWicket, null); // India have lost none
  assert.equal(board.bowler.name, "Adam Milne");
  assert.equal(board.bowler.conceded, 22);
  assert.equal(board.bowler.econ, 33);
  assert.deepEqual(board.partnership, { runs: 42, balls: 10 });
  assert.equal(board.crr, 25.2);
  assert.equal(board.rrr, 8.56);
  assert.deepEqual(board.thisOver, ["6", "6", "4", "nb"]);

  assert.deepEqual(liveCard(m).map((i) => [i.team, i.runs, i.wkts]), [["New Zealand", 198, 3], ["India", 42, 0]]);
  assert.equal(livePlayer(m, "Vaibhav Sooryavanshi").strike, true);
  assert.equal(livePlayer(m, "Vaibhav Sooryavanshi").id, "SOO", "flags are copied onto the card row");
  assert.equal(liveStat(livePlayer(m, "Daryl Mitchell"), "runs"), 89, "first-innings players stay available for props");
});

test("chase totals across both innings (hand-computed)", () => {
  const m = chase();
  assert.equal(liveMarket(m, "match_runs"), 240); // 198 + 42
  assert.equal(liveMarket(m, "first_innings_runs"), 198);
  assert.equal(liveMarket(m, "team_total_runs", "India"), 42);
  assert.equal(liveMarket(m, "match_wickets"), 3);
  assert.equal(liveMarket(m, "match_sixes"), 13); // NZ 0+3+4+0+3, India 1+2
  assert.equal(liveMarket(m, "match_fours"), 20); // NZ 0+4+8+1+3, India 1+3
  assert.equal(liveMarket(m, "match_boundaries"), 33);
  assert.equal(liveMarket(m, "top_score"), 89);
  assert.equal(liveMarket(m, "match_50s"), 1); // Mitchell 89
  assert.equal(liveMarket(m, "match_30s"), 2); // Allen 40, Jacobs 39
});

test("last wicket is the latest fall, not the last dismissed batter in batting order", () => {
  const m = chase();
  const nzBatting = { ...m, teams: m.teams.map((t) => ({ ...t, batting: t.name === "New Zealand" })) };
  const board = liveBoard(nzBatting);
  assert.deepEqual(board.batters.map((p) => p.name), ["Daryl Mitchell", "Bevon Jacobs"]);
  assert.equal(board.lastWicket.name, "Finn Allen"); // 3-104, after Seifert 1-5 and Phillips 2-64
});

test("without the match page the card still keeps the board on the batting side", () => {
  const row = parseSchedule(pageHtml({ [FIXTURE]: [nzInd] }))[0];
  const m = buildMatch(row, null, parseCardPage(nzIndCard));
  assert.equal(teamScore(m, "India").display, "7/0 (0.2 ov)", "schedule score when the match page is down");
  assert.deepEqual(liveBoard(m).batters.map((p) => p.name), ["Vaibhav Sooryavanshi", "Abhishek Sharma"]);
});

test("without the scorecard the match page alone still gives the pair, rates and the current innings", () => {
  const row = parseSchedule(pageHtml({ [FIXTURE]: [nzInd] }))[0];
  const m = buildMatch(row, parseMatchPage(nzIndLive), null);
  assert.equal(hasCard(m), false);
  assert.deepEqual(m.innings.map((i) => [i.n, i.team, i.runs]), [[2, "India", 42]]);
  assert.deepEqual(liveBoard(m).batters.map((p) => p.name), ["Vaibhav Sooryavanshi", "Abhishek Sharma"]);
  assert.equal(liveBoard(m).crr, 25.2);
});

test("with neither page the schedule row stands as it is", () => {
  const row = parseSchedule(pageHtml({ [FIXTURE]: [nzInd] }))[0];
  const m = buildMatch(row, null, null);
  assert.equal(m.status, "live");
  assert.equal(teamScore(m, "India").display, "7/0 (0.2 ov)");
  assert.equal(liveBoard(m), null);
});

test("a priced match that has not started stays upcoming even with both pages", () => {
  const row = parseSchedule(pageHtml({ [FIXTURE]: [{ team1: "Afghanistan", team2: "Zimbabwe", t: Date.parse("2026-10-27T14:30:00Z"), status: 0, mf: "13TM" }] }))[0];
  const m = buildMatch(row, parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "Afghanistan", team2_f_n: "Zimbabwe", score1: "0-0", over1: "0.0", rt: "Afghanistan" } })), null);
  assert.equal(m.status, "upcoming");
  assert.equal(teamScore(m, "Afghanistan").display, "");
});

test("liveForFixture matches team names within the start window", () => {
  const rows = parseSchedule(pageHtml({ [FIXTURE]: [
    { team1: "Netherlands", team2: "Oman", s1: "145-4", o1: "32.2", t: Date.parse("2026-10-27T09:00:00Z"), status: 1, mf: "14VC" },
    { team1: "Afghanistan", team2: "Zimbabwe", t: Date.parse("2026-10-27T14:30:00Z"), status: 0, mf: "13TM" },
  ] }));
  const doc = { matches: rows };
  const hit = liveForFixture(doc, { a: "Netherlands", b: "Oman", start: "2026-10-27T09:00:00Z" });
  assert.equal(hit?.id, "14VC");
  assert.equal(teamScore(hit, "Netherlands").display, "145/4 (32.2 ov)");
  const miss = liveForFixture(doc, { a: "Zimbabwe", b: "Afghanistan", start: "2026-10-27T14:30:00Z" });
  assert.equal(miss?.status, "upcoming");
  assert.equal(liveForFixture(doc, { a: "Spain", b: "Italy", start: "2026-10-27T09:00:00Z" }), null);
});

test("a so-far number says when it can no longer move: dismissed, or innings / spell over (hand-computed)", () => {
  const m = chase();
  const state = (name, stat) => liveState(m, livePlayer(m, name, stat), stat);
  assert.equal(liveStat(livePlayer(m, "Glenn Phillips", "runs"), "runs"), 17);
  assert.equal(state("Glenn Phillips", "runs"), "out"); // c & b Axar Patel: 17 stays 17
  assert.equal(state("Glenn Phillips", "balls"), "out");
  assert.equal(state("Daryl Mitchell", "runs"), "final"); // not out, but New Zealand's 20 overs are done
  assert.equal(state("Vaibhav Sooryavanshi", "runs"), "live"); // India are batting
  assert.equal(state("Arshdeep Singh", "wickets"), "final"); // bowled at New Zealand, whose innings is over
  assert.equal(state("Adam Milne", "wickets"), "live"); // bowling to India, who are still batting; 0.4 ov of 4.0
  assert.equal(state("Adam Milne", "runs"), "live", "other stats never claim a finish");
  const quota = { ...m, players: [{ name: "Jacob Duffy", team: "New Zealand", wickets: 2, conceded: 31, ballsBowled: 24 }] };
  assert.equal(liveState(quota, quota.players[0], "wickets"), "final"); // four overs bowled in a T20
  assert.equal(liveState({ ...quota, fmt: "Test" }, quota.players[0], "wickets"), "live");
  assert.equal(liveState({ ...m, status: "final" }, livePlayer(m, "Adam Milne", "wickets"), "wickets"), "final");
  assert.equal(liveState({ ...m, fmt: "Test" }, livePlayer(m, "Glenn Phillips", "runs"), "runs"), "live", "a Test batter can bat again");
});

test("an all-rounder's batting and bowling rows are told apart by the stat", () => {
  const m = { players: [
    { name: "Axar Patel", team: "India", runs: 5, balls: 3, out: false },
    { name: "Axar Patel", team: "India", wickets: 1, conceded: 36, ballsBowled: 24 },
  ] };
  assert.equal(livePlayer(m, "Axar Patel"), null, "no stat, two rows: ambiguous");
  assert.equal(liveStat(livePlayer(m, "Axar Patel", "runs"), "runs"), 5);
  assert.equal(liveStat(livePlayer(m, "Axar Patel", "wickets"), "wickets"), 1);
  assert.equal(liveStat(livePlayer(m, "Axar Patel", "balls_bowled"), "balls_bowled"), 24);
});

test("the batting side is the page's first team, whatever the other fields say (a first innings, 9 down, the other side named in rt)", () => {
  const html = pageHtml({ [LIVE]: {
    team1_f_n: "Pakistan", team2_f_n: "Sri Lanka", team1short: "PAK", team2short: "SL", rt: "Sri Lanka", inning: 1, status: 1,
    score1: "93-9", over1: "23.4", score2: "", over2: "", comment1: "SL opt to Bowl",
    player_full_name1: "Shaheen Afridi", run1: "0", ball1: "(4)", four1: "0", six1: "0", os1: 1, os2: 0,
    player_full_name2: "Naseem Shah", run2: "1", ball2: "(3)", four2: "0", six2: "0",
    bowler_full_name: "Dilshan Madushanka", bwr: "3-20", bover: "5.0", partnerruns: 1, partnerballs: 3,
  } });
  const m = parseMatchPage(html);
  assert.deepEqual(m.teams.map((t) => [t.name, t.batting]), [["Pakistan", true], ["Sri Lanka", false]]);
  assert.deepEqual(m.innings.map((i) => [i.team, i.runs, i.wkts]), [["Pakistan", 93, 9]]);
  assert.equal(livePlayer(m, "Shaheen Afridi").team, "Pakistan");
  assert.equal(livePlayer(m, "Dilshan Madushanka").team, "Sri Lanka");
  assert.deepEqual(liveBoard(m).batters.map((p) => p.name), ["Shaheen Afridi", "Naseem Shah"]);
});

const XI = ["Kusal Mendis", "Pathum Nissanka", "Kamindu Mendis", "Charith Asalanka", "Janith Liyanage", "Dunith Wellalage", "Wanindu Hasaranga", "Dushmantha Chameera", "Maheesh Theekshana", "Eshan Malinga", "Asitha Fernando"];
const xiCard = (names) => parseCardPage(pageHtml({
  [CARD]: [{ c: "T", d: "", e: "0.0.0.0.0", b: names.map((_, i) => `P${i}`), a: [] }],
  [MAP]: { p: names.map((n, i) => ({ f_key: `P${i}`, n })), t: [{ f_key: "T", n: "Sri Lanka" }, { f_key: "U", n: "Pakistan" }] },
}));
const xiMatch = (names) => buildMatch({ id: "x", status: "upcoming", start: "", teams: [{ name: "Pakistan", abbr: "PAK" }, { name: "Sri Lanka", abbr: "SL" }] }, null, xiCard(names));

test("before the first ball the card is the batting XI, all yet to bat, and the match keeps it", () => {
  const card = xiCard(XI);
  assert.deepEqual(card.card.map((i) => [i.team, i.batters.length, i.yetToBat.length]), [["Sri Lanka", 0, 11]]);
  assert.equal(hasCard(xiMatch(XI)), false, "no batting or bowling yet, so no scorecard to show");
});

test("a player is called out of the XI only when his side's eleven are all listed and he is not one of them", () => {
  const m = xiMatch(XI);
  assert.equal(playingXI(m).get("srilanka").complete, true);
  assert.equal(notInXI(m, "Kusal Mendis", "Sri Lanka"), false);
  assert.equal(notInXI(m, "Dasun Shanaka", "Sri Lanka"), true);
  assert.equal(notInXI(m, "WPUJC Vandersay", "Sri Lanka"), true);
  assert.equal(notInXI(m, "PBB Nissanka", "Sri Lanka"), false, "initials match the full name");
  assert.equal(notInXI(m, "Babar Azam", "Pakistan"), false, "the side that has not batted is not known yet");
  assert.equal(notInXI(xiMatch(XI.slice(0, 10)), "Dasun Shanaka", "Sri Lanka"), false, "ten names is not a full XI");
  assert.equal(notInXI(null, "Dasun Shanaka", "Sri Lanka"), false);
});

test("once a side has batted its XI is the batters and the yet to bat together", () => {
  const card = parseCardPage(pageHtml({
    [CARD]: [{ c: "T", d: "20/1(10", e: "0.0.0.0.0", b: ["P0.12.8.2.0.20.8.1.Q0", "P1.5.2.0.0", ...XI.slice(2).map((_, i) => `P${i + 2}`)], a: [] }],
    [MAP]: { p: [...XI.map((n, i) => ({ f_key: `P${i}`, n })), { f_key: "Q0", n: "Shaheen Afridi" }], t: [{ f_key: "T", n: "Sri Lanka" }, { f_key: "U", n: "Pakistan" }] },
  }));
  const m = buildMatch({ id: "x", status: "live", start: "", teams: [{ name: "Pakistan", abbr: "PAK" }, { name: "Sri Lanka", abbr: "SL" }] }, null, card);
  assert.equal(playingXI(m).get("srilanka").names.length, 11);
  assert.equal(notInXI(m, "Kusal Mendis", "Sri Lanka"), false);
  assert.equal(notInXI(m, "Dasun Shanaka", "Sri Lanka"), true);
});

test("a finished match is final: status 2, the winner as a team key, and the result line is its status", () => {
  const [m] = parseSchedule(pageHtml({ [FIXTURE]: [{ ...nzInd, status: 2, w: "O", winningTeam: "O", s2: "199-4", o2: "13.2", statusText: "", result: "IND Won by 6 wickets" }] }));
  assert.equal(m.status, "final");
  assert.equal(liveBlurb(m), "IND Won by 6 wickets");
  assert.equal(teamScore(m, "India").display, "199/4 (13.2 ov)");
  assert.equal(wantsCard(m, Date.parse("2026-10-27T10:30:00Z")), true, "its scorecard is still read, for the props on it");
  const [live] = parseSchedule(pageHtml({ [FIXTURE]: [{ ...nzInd, status: 1, w: -1, winningTeam: -1 }] }));
  assert.equal(live.status, "live", "-1 means nobody has won yet");
  const [innBreak] = parseSchedule(pageHtml({ [FIXTURE]: [{ ...nzInd, statusText: "Innings Break" }] }));
  assert.equal(liveBlurb(innBreak), "Innings Break");
});

test("overs come as 20.0 or (20.0): the score never shows doubled brackets", () => {
  const [m] = parseSchedule(pageHtml({ [FIXTURE]: [{ ...nzInd, o1: "(20.0)", o2: "(13.2)" }] }));
  assert.equal(m.teams[0].display, "198/3 (20.0 ov)");
  assert.equal(m.teams[1].display, "7/0 (13.2 ov)");
  const live = parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "Afghanistan", team2_f_n: "India", score1: "112-10", over1: "(35.5)", score2: "", over2: "" } }));
  assert.equal(live.teams[0].display, "112/10 (35.5 ov)");
  assert.equal(live.teams[0].overs, 35.5);
});

test("the striker is os1 / os2; st is a series-type code and says nothing about the pair", () => {
  const page = (extra) => pageHtml({ [LIVE]: { team1_f_n: "SBP", team2_f_n: "MIT", score1: "66-1", over1: "18.0", player_full_name1: "Faham ul Haq", run1: "17", ball1: "(33)", player_full_name2: "Hasan Raza", run2: "35", ball2: "(55)", ...extra } });
  const pair = (m) => m.players.filter((p) => p.runs != null).map((p) => [p.name, p.strike]);
  assert.deepEqual(pair(parseMatchPage(page({ st: "27", os1: 1, os2: 0 }))), [["Faham ul Haq", true], ["Hasan Raza", false]]);
  assert.deepEqual(pair(parseMatchPage(page({ st: "1", os1: 0, os2: 1 }))), [["Faham ul Haq", false], ["Hasan Raza", true]], "st = 1 no longer means the first batter");
  assert.deepEqual(pair(parseMatchPage(page({ st: "1" }))), [["Faham ul Haq", false], ["Hasan Raza", false]], "no marker, no striker");
});

test("a batter the card has out is not added again from a match page a beat behind", () => {
  const card = parseCardPage(pageHtml({
    [CARD]: [{ c: "U", d: "110/10(153", e: "0.0.0.0.0", b: ["A.29.33.2.0.80.90.1.Z", "B.0.5.0.0.110.153.1.Z"], a: [] }],
    [MAP]: { p: [{ f_key: "A", n: "Babar Azam" }, { f_key: "B", n: "Shaheen Afridi" }, { f_key: "Z", n: "Asitha Fernando" }], t: [{ f_key: "U", n: "Pakistan" }, { f_key: "T", n: "Sri Lanka" }] },
  }));
  const live = parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "Pakistan", team2_f_n: "Sri Lanka", score1: "109-9", over1: "25.2", player_full_name1: "Shaheen Afridi", run1: "0", ball1: "(4)", os1: 1, os2: 0 } }));
  const m = buildMatch({ id: "x", status: "live", start: "", teams: [{ name: "Pakistan", abbr: "PAK" }, { name: "Sri Lanka", abbr: "SL" }] }, live, card);
  assert.deepEqual(m.players.filter((p) => p.name === "Shaheen Afridi").map((p) => p.out), [true]);
});

test("a Test gives each side its innings together: a schedule row's s1 / s3, and the card when the pages show one", () => {
  const [m] = parseSchedule(pageHtml({ [FIXTURE]: [{ team1: "Afghanistan", team2: "India", s1: "152-10", o1: "58.4", s2: "564-8", o2: "127.0", s3: "112-10", o3: "35.5", s4: "", o4: "", status: 1, fo: "Test", mf: "10ZC", t: Date.parse("2026-10-27T04:00:00Z") }] }));
  assert.equal(m.teams[0].display, "152 & 112/10 (35.5 ov)");
  assert.equal(m.teams[0].runs, 112);
  assert.equal(m.teams[1].display, "564/8 (127.0 ov)");
  const card = parseCardPage(pageHtml({
    [CARD]: [{ c: "O", d: "564/8(762", e: "0.0.0.0.0", b: ["A.100.150.10.2"], a: [] }, { c: "Y", d: "152/10(352", e: "0.0.0.0.0", b: ["B.20.30.2.0"], a: [] }, { c: "Y", d: "112/10(215", e: "0.0.0.0.0", b: ["B.9.20.1.0"], a: [] }],
    [MAP]: { p: [{ f_key: "A", n: "Shubman Gill" }, { f_key: "B", n: "Rahmat Shah" }], t: [{ f_key: "O", n: "India" }, { f_key: "Y", n: "Afghanistan" }] },
  }));
  const live = parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "Afghanistan", team2_f_n: "India", score1: "112-10", over1: "(35.5)", score2: "", over2: "" } }));
  const row = { id: "x", status: "live", start: "", teams: [{ name: "Afghanistan", abbr: "AFG" }, { name: "India", abbr: "IND" }] };
  const built = buildMatch(row, live, card);
  assert.equal(teamScore(built, "Afghanistan").display, "152 & 112/10 (35.8 ov)".replace("35.8", "35.5"));
  assert.equal(teamScore(built, "India").display, "564/8 (127.0 ov)");
  assert.equal(teamScore(built, "Afghanistan").runs, 112);
});

test("the XI keeps the source's own ids, and a player with a linked id is matched by it exactly", () => {
  const m = xiMatch(XI);
  assert.deepEqual(playingXI(m).get("srilanka").ids, new Set(XI.map((_, i) => `P${i}`)));
  assert.equal(notInXI(m, "PWH de Silva", "Sri Lanka", "P6"), false, "Hasaranga is in the XI under his common name; the data knows him as PWH de Silva");
  assert.equal(notInXI(m, "PWH de Silva", "Sri Lanka", "ZZZ"), true, "linked, and his id is not among the eleven");
});

test("without a linked id a name alone never says 'not in': a shared surname could be him (BKG Mendis is Kusal Mendis)", () => {
  const m = xiMatch(XI); // two Mendises among the eleven: Kusal and Kamindu
  assert.equal(playingXI(m).get("srilanka").complete, true);
  assert.equal(notInXI(m, "BKG Mendis", "Sri Lanka"), false, "he is left unmarked");
  assert.equal(notInXI(m, "PHKD Mendis", "Sri Lanka"), false);
  assert.equal(notInXI(m, "Dasun Shanaka", "Sri Lanka"), true, "nobody of that surname in the eleven: marked");
});

test("an over line is cleared the moment the count passes it; a miss is only known once the count can't move", () => {
  assert.equal(lineVerdict(1, 0.5), "cleared"); // already hit his six
  assert.equal(lineVerdict(23, 22.5, "live"), "cleared");
  assert.equal(lineVerdict(0, 0.5, "live"), null, "still to play for");
  assert.equal(lineVerdict(17, 22.5, "live"), null);
  assert.equal(lineVerdict(17, 22.5, "out"), "missed", "dismissed on 17");
  assert.equal(lineVerdict(0, 0.5, "final"), "missed");
  assert.equal(lineVerdict(2, 2, "final"), "push", "a whole-number line met exactly");
  assert.equal(lineVerdict(2, 2, "live"), null);
  assert.equal(lineVerdict(null, 0.5, "out"), null);
});

test("a player is found by the name the books use: BKG Mendis is Kusal Mendis, and a first initial alone cannot tell the two Mendises apart", () => {
  const m = { players: [
    { name: "Kusal Mendis", team: "Sri Lanka", runs: 31, balls: 20, fours: 3, sixes: 2, out: false },
    { name: "Kamindu Mendis", team: "Sri Lanka", runs: 5, balls: 7, fours: 0, sixes: 0, out: true },
  ] };
  assert.equal(livePlayer(m, "BKG Mendis", "sixes"), null, "two K Mendises: the initials rule alone cannot choose");
  assert.equal(liveStat(livePlayer(m, "BKG Mendis", "sixes", "Kusal Mendis"), "sixes"), 2, "the books' name settles it");
  assert.equal(liveStat(livePlayer(m, "PHKD Mendis", "runs", "Kamindu Mendis"), "runs"), 5);
  assert.equal(lineVerdict(liveStat(livePlayer(m, "BKG Mendis", "sixes", "Kusal Mendis"), "sixes"), 0.5), "cleared", "he has hit his six");
  assert.equal(livePlayer(m, "Dasun Shanaka", "runs", "Dasun Shanaka"), null, "a name nobody has is no match");
});

// ---- a finished match the schedule page no longer lists: read from its own match page, found through our schedule file
const pkSl = pageHtml({ [LIVE]: {
  team1_f_n: "Sri Lanka", team2_f_n: "Pakistan", team1short: "SL", team2short: "PAK", inning: 2, status: 2, score1: "114-2", over1: "(18.1)", score2: "110-10", over2: "(25.3)",
  B: "Sri Lanka won by 8 wickets \u{1F3C6}", comment1: "", player_full_name1: "Kusal Mendis", run1: "62", ball1: "(60)", four1: "6", six1: "2", os1: 1,
} });
const SCHEDULE_CSV = [
  "start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result",
  '2026-10-27T08:00Z,pak-vs-sl-5th-odi,ODI Tri Series in Pakistan 2026,ODI,male,Pakistan,Sri Lanka,"Gaddafi Stadium, Lahore",Live,/cricket-live-score/pak-vs-sl-5th-odi,',
  '2026-10-27T14:30Z,afg-vs-zim-1st-t20i,Afghanistan vs Zimbabwe in UAE 2026,T20,male,Afghanistan,Zimbabwe,"Sharjah Cricket Stadium, Sharjah",Upcoming,/cricket-live-score/afg-vs-zim-1st-t20i,',
  '2026-10-27T07:00Z,ind-vs-nz-3rd-t20i,India tour of New Zealand 2026,T20,male,New Zealand,India,"Hnry Stadium, Wellington",Completed,/cricket-live-score/ind-vs-nz-3rd-t20i,"India won by 5 runs, ""DLS"""',
].join("\n");

test("parseFixtureCsv reads quoted commas and quotes, and survives an empty file", () => {
  const rows = parseFixtureCsv(SCHEDULE_CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].venue, "Gaddafi Stadium, Lahore");
  assert.equal(rows[0].result, "");
  assert.equal(rows[2].result, 'India won by 5 runs, "DLS"');
  assert.deepEqual([rows[1].match_id, rows[1].status, rows[1].url], ["afg-vs-zim-1st-t20i", "Upcoming", "/cricket-live-score/afg-vs-zim-1st-t20i"]);
  assert.deepEqual(parseFixtureCsv(""), []);
  assert.deepEqual(parseFixtureCsv("a,b\r\n1,2\r\n"), [{ a: "1", b: "2" }]);
});

test("a match page that says status 2 is final, with its result line; the schedule's word 'live' no longer beats it", () => {
  const m = parseMatchPage(pkSl);
  assert.equal(m.status, "final");
  assert.equal(m.summary, "Sri Lanka won by 8 wickets", "the trophy is dropped");
  const row = { id: "x", status: "live", start: "2026-10-27T08:00:00.000Z", teams: [{ name: "Pakistan", abbr: "Pakistan" }, { name: "Sri Lanka", abbr: "Sri Lanka" }], innings: [], players: [] };
  const b = buildMatch(row, m, null);
  assert.equal(b.status, "final");
  assert.equal(b.summary, "Sri Lanka won by 8 wickets");
  assert.deepEqual(b.teams.map((t) => t.display), ["110/10 (25.3 ov)", "114/2 (18.1 ov)"]);
  // a live match page (status 1) and a match not yet started (status 0) are unchanged
  assert.equal(parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "A", team2_f_n: "B", status: 1, score1: "10-0", over1: "(1.0)" } })).status, "live");
  assert.equal(parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "A", team2_f_n: "B", status: 0, score1: "0-0" } })).status, "upcoming");
});

test("unlistedRows: a priced match that began and is not on the schedule page comes back from our schedule file", () => {
  const now = Date.parse("2026-10-27T14:00:00Z"), sched = parseFixtureCsv(SCHEDULE_CSV);
  const books = bookFixtures({ events: [{ match: "Pakistan vs Sri Lanka", start_utc: "2026-10-27T08:00:00Z" }, { match: "Afghanistan vs Zimbabwe", start_utc: "2026-10-27T14:30:00Z" },
    { match: "India vs New Zealand", start_utc: "2026-10-27T07:00:00Z" }, { match: "Namibia vs Ireland", start_utc: "2026-10-27T07:30:00Z" }, { match: "South Africa vs Australia", start_utc: "2026-10-24T08:30:00Z" }] });
  const listed = [{ id: "n", start: "2026-10-27T07:00:00.000Z", teams: [{ name: "New Zealand" }, { name: "India" }] }];
  const rows = unlistedRows(listed, books, sched, "https://src.test", now);
  assert.deepEqual(rows.map((r) => r.id), ["pak-vs-sl-5th-odi"], "NZ v India is listed; Afghanistan v Zimbabwe has not begun; no schedule row for Namibia; the old one is past 40 hours");
  const [r] = rows;
  assert.deepEqual([r.status, r.fmt, r.start, r.url], ["live", "ODI", "2026-10-27T08:00:00.000Z", "https://src.test/cricket-live-score/pak-vs-sl-5th-odi"]);
  assert.deepEqual(r.teams.map((t) => t.name), ["Pakistan", "Sri Lanka"]);
  assert.ok(wantsCard(r, now), "its page is read");
  // a match our schedule file already calls Completed is final from the start, and the file's own result line is kept
  const done = unlistedRows([], books, sched, "", now).find((x) => x.id === "ind-vs-nz-3rd-t20i");
  assert.deepEqual([done.status, done.summary], ["final", 'India won by 5 runs, "DLS"']);
  assert.deepEqual(unlistedRows(listed, null, sched), []);
  assert.deepEqual(unlistedRows(listed, books, null, "", now).length, 0);
});

// --- the identity table: ids first, names only as the fallback ---
const NZ_IND = { players: [
  { id: "DBT", name: "Vaibhav Sooryavanshi", team: "India", runs: 45, balls: 19, fours: 4, sixes: 3, out: false },
  { id: "YL", name: "Avishka Fernando", team: "Sri Lanka", runs: 16, balls: 17, fours: 2, sixes: 0, out: false },
  { id: "1JR", name: "Asitha Fernando", team: "Sri Lanka", runs: null, balls: null, wickets: 1, conceded: 30, ballsBowled: 18, out: false },
] };
const IDN = identityIndex({ v: 1, s: { "470f446b": "DBT", "9550470d": "YL", "de3d549a": "1JR" }, b: { "5d1e7582": ["Kusal Mendis"] } });

test("the id finds a player whose name the data and the source spell differently (V Suryavanshi is Vaibhav Sooryavanshi, WIA Fernando is Avishka Fernando)", () => {
  assert.equal(livePlayer(NZ_IND, "V Suryavanshi", "runs"), null, "by name alone: Suryavanshi is not Sooryavanshi");
  assert.equal(livePlayer(NZ_IND, "WIA Fernando", "runs"), null, "by name alone: W is not A");
  const v = livePlayer(NZ_IND, "V Suryavanshi", "runs", "", IDN.sourceOf("470f446b"), IDN.isLinked);
  assert.deepEqual([liveStat(v, "runs"), liveStat(v, "balls"), liveStat(v, "fours"), liveStat(v, "sixes")], [45, 19, 4, 3]);
  assert.equal(liveStat(livePlayer(NZ_IND, "WIA Fernando", "runs", "", IDN.sourceOf("9550470d"), IDN.isLinked), "runs"), 16);
});

test("a linked player who has not batted is not mistaken for a namesake the table knows (AM Fernando is not Avishka Fernando)", () => {
  assert.equal(livePlayer(NZ_IND, "AM Fernando", "runs").name, "Avishka Fernando", "the name rule alone takes the first A Fernando it finds");
  assert.equal(livePlayer(NZ_IND, "AM Fernando", "runs", "", "1JR", IDN.isLinked), null, "he is 1JR and has no batting row; YL is somebody else");
  assert.equal(liveStat(livePlayer(NZ_IND, "AM Fernando", "wickets", "", "1JR", IDN.isLinked), "wickets"), 1);
});

test("two rows with his id (a Test, two innings) are ambiguous, as two rows with his name are", () => {
  const test = { players: [{ id: "N0", name: "Sahibzada Farhan", team: "Pakistan", runs: 12, out: true }, { id: "N0", name: "Sahibzada Farhan", team: "Pakistan", runs: 40, out: false }] };
  assert.equal(livePlayer(test, "Sahibzada Farhan", "runs", "", "N0"), null);
});

test("the books' names from the table settle two Mendises when the line carries no book name of its own", () => {
  const m = { players: [
    { name: "Kusal Mendis", team: "Sri Lanka", runs: 31, balls: 20, fours: 3, sixes: 2, out: false },
    { name: "Kamindu Mendis", team: "Sri Lanka", runs: 5, balls: 7, fours: 0, sixes: 0, out: true },
  ] };
  assert.equal(liveStat(livePlayer(m, "BKG Mendis", "sixes", IDN.bookNames("5d1e7582")), "sixes"), 2);
  assert.equal(livePlayer(m, "BKG Mendis", "sixes", IDN.bookNames("nobody")), null);
});

test("notInXI by the table's id: linked and absent is out; the same name spelled differently by the source is still in", () => {
  const m = xiMatch(XI); // ids P0.. in the order of XI; Hasaranga is P6
  assert.equal(notInXI(m, "PWH de Silva", "Sri Lanka", "P6", ""), false);
  assert.equal(notInXI(m, "PWH de Silva", "Sri Lanka", "N0", ""), true);
});

// --- lines settled on the server: where every priced line stands, found by id through the identity table ---
const PRICED = (pid, player, team, stat, line, extra = {}) => ({ pid, player, team, fmt: "T20", stat, line, match: "New Zealand vs India", start_utc: "2026-10-27T07:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.9, under: 1.9 }], ...extra });
const CHASE_IDN = identityIndex({ v: 1, s: { s1: "SOO" } });

test("settleLines: every priced line of a live match gets its value, state and verdict (hand-computed from the card)", () => {
  const m = chase(), at = (lines, idn) => settleLines(m, lines, idn);
  const lines = [
    PRICED("a1", "Finn Allen", "New Zealand", "runs", 30.5), // 40 off 25, lbw: dismissed on 40, over 30.5 already cleared
    PRICED("a1", "Finn Allen", "New Zealand", "sixes", 3.5), // 3 sixes and out: the count cannot reach 4
    PRICED("m1", "Daryl Mitchell", "New Zealand", "runs", 89), // 89 not out when New Zealand's 20 overs ended: exactly the line
    PRICED("m1", "Daryl Mitchell", "New Zealand", "runs", 89.5), // one short
    PRICED("s1", "V Suryavanshi", "India", "runs", 25.5), // 13 off 5, India are batting: still to play for
    PRICED("s1", "V Suryavanshi", "India", "sixes", 0.5), // his one six clears 0.5 at once, whatever else happens
    PRICED("ar", "Arshdeep Singh", "India", "wickets", 1.5), // 2 wickets in a full 4-over spell
    PRICED("mi", "Adam Milne", "New Zealand", "wickets", 0.5), // 0 wickets after 0.4 overs of 4.0
  ];
  assert.deepEqual(at(lines, CHASE_IDN).map(({ pid, stat, line, value, state, verdict }) => [pid, stat, line, value, state, verdict]), [
    ["a1", "runs", 30.5, 40, "out", "cleared"],
    ["a1", "sixes", 3.5, 3, "out", "missed"],
    ["m1", "runs", 89, 89, "final", "push"],
    ["m1", "runs", 89.5, 89, "final", "missed"],
    ["s1", "runs", 25.5, 13, "live", null],
    ["s1", "sixes", 0.5, 1, "live", "cleared"],
    ["ar", "wickets", 1.5, 2, "final", "cleared"],
    ["mi", "wickets", 0.5, 0, "live", null],
  ]);
});

test("settleLines: the identity table finds the player the name rules cannot (V Suryavanshi is Vaibhav Sooryavanshi on the card)", () => {
  const m = chase(), lines = [PRICED("s1", "V Suryavanshi", "India", "runs", 25.5), PRICED("a1", "Finn Allen", "New Zealand", "runs", 30.5)];
  assert.deepEqual(settleLines(m, lines).map((x) => x.pid), ["a1"], "no table: only the player whose name agrees is placed");
  assert.deepEqual(settleLines(m, lines, CHASE_IDN).map((x) => [x.pid, x.value]), [["s1", 13], ["a1", 40]]);
  assert.deepEqual(settleLines(m, lines, identityIndex({ v: 1, s: { s1: "NOBODY" } })).map((x) => x.pid), ["a1"], "an id the card does not have is not guessed from the name");
});

test("settleLines: only this match's lines, not the series' next game or another pair of sides; a player with no row has no entry", () => {
  const m = chase();
  const lines = [
    PRICED("a1", "Finn Allen", "New Zealand", "runs", 12.5, { start_utc: "2026-10-30T07:00:00Z" }), // the next game between the same sides
    PRICED("a1", "Finn Allen", "New Zealand", "runs", 13.5, { match: "Pakistan vs Sri Lanka" }),
    PRICED("a1", "Finn Allen", "New Zealand", "runs", 14.5, { match: "India vs New Zealand", start_utc: "2026-10-27T10:30:00Z" }), // sides either way round, books 3.5 h off
    PRICED("sa", "Mitchell Santner", "New Zealand", "runs", 10.5), // not on the card yet
  ];
  assert.deepEqual(settleLines(m, lines).map((x) => [x.line, x.value]), [[14.5, 40]]);
  assert.deepEqual(settleLines(m, [], CHASE_IDN), []);
  assert.deepEqual(settleLines(m, undefined), []);
  assert.deepEqual(settleLines(null, lines), []);
});

test("settleLines: a player the named XI rules out has no value and is marked, and the books' name or the table's id keeps a namesake from being called out", () => {
  const m = xiMatch(XI);
  const lines = [
    PRICED("sh", "Dasun Shanaka", "Sri Lanka", "runs", 10.5, { match: "Pakistan vs Sri Lanka", start_utc: "" }),
    PRICED("bm", "BKG Mendis", "Sri Lanka", "runs", 20.5, { match: "Pakistan vs Sri Lanka", start_utc: "", book_name: "Kusal Mendis" }), // in the eleven under the books' name
    PRICED("hd", "PWH de Silva", "Sri Lanka", "runs", 15.5, { match: "Pakistan vs Sri Lanka", start_utc: "" }), // Hasaranga: P6
    PRICED("zz", "X Linked", "Sri Lanka", "runs", 5.5, { match: "Pakistan vs Sri Lanka", start_utc: "" }), // linked, and his id is not among the eleven
  ];
  const idn = identityIndex({ v: 1, s: { hd: "P6", zz: "ZZZ" } });
  assert.deepEqual(settleLines(m, lines, idn).map(({ pid, value, state, verdict, notInXI }) => [pid, value, state, verdict, notInXI]), [
    ["sh", null, "live", null, true],
    ["zz", null, "live", null, true],
  ]);
});

test("settleLines: in a finished match every number is final, found by the books' name, and a line met exactly is a push", () => {
  const row = { id: "x", status: "live", fmt: "ODI", start: "2026-10-27T08:00:00.000Z", teams: [{ name: "Pakistan", abbr: "PAK" }, { name: "Sri Lanka", abbr: "SL" }], innings: [], players: [] };
  const m = buildMatch(row, parseMatchPage(pkSl), null); // Kusal Mendis 62 (60), 6 fours, 2 sixes; the match page says status 2
  const line = (stat, ln, extra) => PRICED("bm", "BKG Mendis", "Sri Lanka", stat, ln, { fmt: "ODI", match: "Pakistan vs Sri Lanka", start_utc: "2026-10-27T08:00:00Z", book_name: "Kusal Mendis", ...extra });
  const got = settleLines(m, [line("runs", 49.5), line("runs", 62), line("runs", 62.5), line("sixes", 2), line("fours", 5.5), line("wickets", 0.5)]);
  assert.deepEqual(got.map(({ stat, line: ln, value, state, verdict }) => [stat, ln, value, state, verdict]), [
    ["runs", 49.5, 62, "final", "cleared"],
    ["runs", 62, 62, "final", "push"],
    ["runs", 62.5, 62, "final", "missed"],
    ["sixes", 2, 2, "final", "push"],
    ["fours", 5.5, 6, "final", "cleared"],
  ]);
});

test("lineStanding: the server's settled entry first, then the archive's stored result, then the browser's own reading, then the data's game", () => {
  const m = chase(), line = { pid: "s1", player: "V Suryavanshi", book_name: "", team: "India", stat: "runs", line: 25.5 };
  const served = { ...m, lines: [{ pid: "s1", stat: "runs", line: 25.5, value: 31, state: "out", verdict: "cleared" }] };
  assert.deepEqual(lineStanding(served, line, CHASE_IDN, { stored: 99, settled: 98 }), { v: 31, state: "out", verdict: "cleared" }, "the server's word beats everything else");
  assert.deepEqual(lineStanding(served, { ...line, line: 30.5 }, CHASE_IDN, { stored: 44 }), { v: 44, state: "final", verdict: "cleared" }, "no entry for this line: the stored result");
  assert.deepEqual(lineStanding(null, line, CHASE_IDN, { stored: 20 }), { v: 20, state: "final", verdict: "missed" }, "an old match: no live feed, no matching, the archive file's result");
  assert.deepEqual(lineStanding(null, { ...line, line: 20 }, CHASE_IDN, { stored: 20 }), { v: 20, state: "final", verdict: "push" });
  assert.deepEqual(lineStanding(m, line, CHASE_IDN), { v: 13, state: "live", verdict: null }, "a body with no settled lines: his row on the card, found by his id");
  assert.equal(lineStanding(m, line), null, "and by name alone he is not found");
  assert.deepEqual(lineStanding(null, line, CHASE_IDN, { settled: 7 }), { v: 7, state: "final", verdict: "missed" }, "the data's game is the last resort");
  assert.equal(lineStanding(null, line, CHASE_IDN), null);
  const noValue = { ...m, lines: [{ pid: "s1", stat: "runs", line: 25.5, value: null, state: "live", verdict: null, notInXI: true }] };
  assert.equal(lineStanding(noValue, line, CHASE_IDN, { stored: 12 }).v, 12, "a ruled-out entry has no value to show");
});

test("lineNotIn: the server's word when it settled the player, the browser's reading of the card otherwise", () => {
  const m = xiMatch(XI), line = { pid: "sh", player: "Dasun Shanaka", team: "Sri Lanka", stat: "runs", line: 10.5 };
  assert.equal(lineNotIn(m, line), true, "no entry: read off the card, nobody of that surname among the eleven");
  assert.equal(lineNotIn({ ...m, lines: [{ pid: "sh", stat: "runs", line: 10.5, value: null, state: "live", verdict: null, notInXI: true }] }, line), true);
  assert.equal(lineNotIn({ ...m, lines: [{ pid: "sh", stat: "runs", line: 10.5, value: 4, state: "live", verdict: null }] }, line), false, "the server found a row for him");
  assert.equal(lineNotIn(null, line), false);
});

test("unlistedRows: a match our file calls Completed without a result is not final until its own page says so (a Test still being played)", () => {
  const csv = ["start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result",
    '2026-10-27T08:30Z,aus-vs-sa-3rd-test,Australia tour of South Africa 2026,Test,male,South Africa,Australia,"Newlands, Cape Town",Completed,/cricket-live-score/aus-vs-sa-3rd-test,',
    '2026-10-27T07:00Z,ind-vs-nz-3rd-t20i,India tour of New Zealand 2026,T20,male,New Zealand,India,"Hnry Stadium, Wellington",Completed,/cricket-live-score/ind-vs-nz-3rd-t20i,India won by 5 runs'].join("\n");
  const books = bookFixtures({ events: [{ match: "South Africa vs Australia", start_utc: "2026-10-27T08:30:00Z" }, { match: "India vs New Zealand", start_utc: "2026-10-27T07:00:00Z" }] });
  const rows = unlistedRows([], books, parseFixtureCsv(csv), "", Date.parse("2026-10-27T14:00:00Z"));
  assert.deepEqual(rows.map((r) => [r.id, r.status]), [["aus-vs-sa-3rd-test", "live"], ["ind-vs-nz-3rd-t20i", "final"]]);
  const day1 = parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "South Africa", team2_f_n: "Australia", status: 1, inning: 1, score1: "308-6", over1: "(76.0)" } }));
  assert.equal(buildMatch(rows[0], day1, null).status, "live", "the match page says it is on");
  const over = parseMatchPage(pageHtml({ [LIVE]: { team1_f_n: "South Africa", team2_f_n: "Australia", status: 2, inning: 4, score1: "308-6", over1: "(76.0)", B: "South Africa won by 5 wickets" } }));
  assert.equal(buildMatch(rows[0], over, null).status, "final", "and once it says it is over, it is");
});
