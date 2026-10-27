import test from "node:test";
import assert from "node:assert/strict";
import {
  ballsToOvers, bookFixtures, formatOf, buildMatch, cardPageUrl, fixtureInBooks, hasCard, liveBlurb, liveBoard, liveCard, liveForFixture, liveMarket, livePlayer, liveState, liveStat,
  namesMatch, oversToBalls, parseMatchPage, parseSchedule, parseCardPage, parseScore, pricedLive, strikeRate, teamKey, teamScore, wantsCard,
} from "../src/engine/live.js";

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
  player_full_name2: "Abhishek Sharma", run2: "23", ball2: "(6)", four2: "3", six2: "2", sr2: "383.33", st: "1",
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
  assert.equal(wantsCard(row("upcoming", "2026-10-27T06:30:00Z"), now), true);
  assert.equal(wantsCard(row("upcoming", "2026-10-27T09:00:00Z"), now), false);
  assert.equal(wantsCard(row("upcoming", "2026-10-26T07:00:00Z"), now), false); // long gone, never scored
  assert.equal(wantsCard(row("final", "2026-10-27T05:00:00Z"), now), false);
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
    st: "2", partnerruns: 40, partnerballs: 43, crr: "6.80", rrr: "--", beco: "2.42",
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
    player_full_name1: "Shaheen Afridi", run1: "0", ball1: "(4)", four1: "0", six1: "0", st: "1",
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
