import test from "node:test";
import assert from "node:assert/strict";
import { CARD_BUDGET_MS, createFeed } from "@cricket/engine/feed.js";
import { NO_IDENTITY } from "@cricket/engine/identity.js";

function pageHtml(payload) {
  return `<script id="app-root-state">${JSON.stringify(payload).replace(/"/g, "&q;")}</script>`;
}

const FIXTURE = "https://src.test/fixture/getFixture";
const LIVE = "https://src.test/v3/getSV3";
const START = "2026-11-05T03:00:00Z";

const schedule = pageHtml({
  [FIXTURE]: [
    {
      team1: "West Indies", team2: "Bangladesh", t1SName: "WI", t2SName: "BAN",
      s1: "13-1", o1: "4.3", t: Date.parse(START), status: 1, winningTeam: -1, w: -1,
      statusText: "Live", fo: "Test", mf: "LIVE1", link: "/match/live",
    },
    {
      team1: "India", team2: "New Zealand", t1SName: "IND", t2SName: "NZ",
      s1: "143-5", o1: "22.4", s2: "185", o2: "40.2", t: Date.parse("2026-11-04T03:00:00Z"), status: 2, winningTeam: 1, w: 1,
      result: "IND won by 5 wickets", fo: "ODI", mf: "DONE1", link: "/match/done",
    },
  ],
});

const livePage = pageHtml({
  [LIVE]: {
    team1_f_n: "West Indies", team2_f_n: "Bangladesh", status: 1,
    score1: "20-1", over1: "6.0", player_full_name1: "Kavem Hodge", run1: "4", ball1: "(3)",
  },
});

test("snapshot returns live cards without waiting on a slow finished card", async () => {
  assert.equal(CARD_BUDGET_MS, 700);
  const calls = [];
  let t = 0;
  const feed = createFeed({
    now: () => t,
    cardBudgetMs: 40,
    base: () => "https://src.test",
    booksUrl: "books",
    scheduleUrl: "schedule.csv",
    getJson: async () => ({
      lines: [
        { match: "West Indies vs Bangladesh", start_utc: START, fmt: "Test" },
        { match: "India vs New Zealand", start_utc: "2026-11-04T03:00:00Z", fmt: "ODI" },
      ],
    }),
    getText: async () => "",
    loadIdentity: async () => NO_IDENTITY,
    getHtml: async (url) => {
      calls.push(url);
      if (url.endsWith("/") || url.endsWith("/schedule")) return schedule;
      if (url.includes("/match/live")) return livePage;
      if (url.includes("/match/done")) {
        await new Promise((r) => setTimeout(r, 200));
        return livePage;
      }
      return "";
    },
  });
  const t0 = Date.now();
  const body = await feed.snapshot();
  const wall = Date.now() - t0;
  assert.ok(wall < 180, `snapshot waited ${wall}ms for the slow card`);
  const live = body.matches.find((m) => m.id === "LIVE1");
  const done = body.matches.find((m) => m.id === "DONE1");
  assert.ok(live, "priced live match is in the body");
  assert.ok((live.players || []).some((p) => p.name === "Kavem Hodge"), "the live match page was read");
  assert.equal((done?.players || []).length, 0, "the slow finished card is not in this response");
  await new Promise((r) => setTimeout(r, 250));
  t += 20_000;
  const again = await feed.snapshot();
  const done2 = again.matches.find((m) => m.id === "DONE1");
  assert.ok((done2?.players || []).length > 0, "the finished card is kept for the next snapshot");
  assert.ok(calls.some((u) => u.includes("/match/done")), "the finished card was still requested");
});

test("the fast score feed refreshes live cards while reusing discovery and completed cards", async () => {
  const calls = [];
  let at = Date.parse(START) - 12 * 60 * 60_000;
  const feed = createFeed({
    now: () => at,
    ttlMs: 3000,
    base: () => "https://src.test",
    getJson: async () => ({ lines: [
      { match: "West Indies vs Bangladesh", start_utc: START, fmt: "Test" },
      { match: "India vs New Zealand", start_utc: "2026-11-04T03:00:00Z", fmt: "ODI" },
    ] }),
    getText: async () => "",
    loadIdentity: async () => NO_IDENTITY,
    getHtml: async (url) => {
      calls.push(url);
      return url.includes("/match/") ? livePage : schedule;
    },
  });
  const first = await feed.snapshot();
  assert.deepEqual(first.matches.map((match) => match.id), ["LIVE1", "DONE1"]);
  assert.equal(first.delaySec, 3);
  at += 2999;
  assert.equal(await feed.snapshot(), first);
  at += 1;
  assert.notEqual(await feed.snapshot(), first);
  assert.equal(calls.filter((url) => url.endsWith("/schedule")).length, 1);
  assert.equal(calls.filter((url) => url.endsWith("/match/live")).length, 2);
  assert.equal(calls.filter((url) => url.endsWith("/match/done")).length, 1);
});

test("a busy day: 22 live and 12 upcoming do not crowd out a finished match's scorecard, and it is kept", async () => {
  const row = (i, status, t, extra = {}) => ({
    team1: `Home ${i}`, team2: `Away ${i}`, t1SName: `H${i}`, t2SName: `A${i}`, t: Date.parse(t), fo: "T20", mf: `M${i}`, link: `/match/m${i}`, ...extra,
    ...(status === "live" ? { s1: "50-1", o1: "6.0", status: 1, winningTeam: -1, w: -1, statusText: "Live" } : status === "final" ? { s1: "150-5", o1: "20.0", s2: "151-4", o2: "19.0", status: 2, winningTeam: 1, w: 1, result: "Away won" } : { status: 0, statusText: "Upcoming" }),
  });
  const rows = [
    ...Array.from({ length: 22 }, (_, i) => row(i, "live", "2026-11-05T02:00:00Z")),
    ...Array.from({ length: 12 }, (_, i) => row(100 + i, "upcoming", "2026-11-05T03:20:00Z")),
    row(200, "final", "2026-11-05T00:00:00Z"),
  ];
  const sched = pageHtml({ [FIXTURE]: rows });
  const page = pageHtml({ [LIVE]: { team1_f_n: "Home 200", team2_f_n: "Away 200", status: 2, score1: "150-5", over1: "20.0", score2: "151-4", over2: "19.0", player_full_name1: "Kavem Hodge", run1: "40", ball1: "(30)" } });
  let t = Date.parse("2026-11-05T03:00:00Z");
  const feed = createFeed({
    now: () => t, cardBudgetMs: 1000, base: () => "https://src.test", booksUrl: "books", scheduleUrl: "schedule.csv",
    getJson: async () => ({ lines: rows.map((r) => ({ match: `${r.team1} vs ${r.team2}`, start_utc: new Date(r.t).toISOString().replace(".000", ""), fmt: "T20" })) }),
    getText: async () => "", loadIdentity: async () => NO_IDENTITY,
    getHtml: async (url) => (url.endsWith("/") || url.endsWith("/schedule") ? sched : url.includes("/match/m200") ? page : url.includes("/match/") ? "" : ""),
  });
  const body = await feed.snapshot();
  assert.equal(body.matches.filter((m) => m.status === "live").length, 22);
  const done = body.matches.find((m) => m.id === "M200");
  assert.ok((done?.players || []).some((p) => p.name === "Kavem Hodge"), "the finished match has its scorecard");
  t += 20_000;
  const again = await feed.snapshot();
  assert.ok((again.matches.find((m) => m.id === "M200")?.players || []).length > 0, "and it is still there on the next round");
});

// --- paced reads: a day with 25 live and 40 upcoming ---
function busyDay({ live = 25, upcoming = 40, final = 10, start = "2026-11-05T03:00:00Z" } = {}) {
  const row = (i, status, t) => ({
    team1: `Home ${i}`, team2: `Away ${i}`, t1SName: `H${i}`, t2SName: `A${i}`, t: Date.parse(t), fo: "T20", mf: `M${i}`, link: `/match/m${i}`,
    ...(status === "live" ? { s1: "50-1", o1: "6.0", status: 1, winningTeam: -1, w: -1, statusText: "Live" } : status === "final" ? { s1: "150-5", o1: "20.0", s2: "151-4", o2: "19.0", status: 2, winningTeam: 1, w: 1, result: "Away won" } : { status: 0, statusText: "Upcoming" }),
  });
  const rows = [
    ...Array.from({ length: live }, (_, i) => row(i, "live", "2026-11-05T02:00:00Z")),
    ...Array.from({ length: upcoming }, (_, i) => row(100 + i, "upcoming", "2026-11-05T03:20:00Z")),
    ...Array.from({ length: final }, (_, i) => row(200 + i, "final", "2026-11-05T00:00:00Z")),
  ];
  const sched = pageHtml({ [FIXTURE]: rows });
  const page = (id) => pageHtml({ [LIVE]: Number(id) >= 100 && Number(id) < 200 ? { team1_f_n: `Home ${id}`, team2_f_n: `Away ${id}`, status: 0 } : Number(id) >= 200 ? { team1_f_n: `Home ${id}`, team2_f_n: `Away ${id}`, status: 2, score1: "150-5", over1: "20.0", score2: "151-4", over2: "19.0" } : { team1_f_n: `Home ${id}`, team2_f_n: `Away ${id}`, status: 1, score1: "60-1", over1: "7.0", player_full_name1: "Kavem Hodge", run1: "40", ball1: "(30)" } });
  const calls = [];
  let t = Date.parse(start);
  const mk = (over = {}) => createFeed({
    now: () => t, cardBudgetMs: 50, liveWaitMs: 200, pageMs: 100, base: () => "https://src.test", booksUrl: "books", scheduleUrl: "schedule.csv",
    getJson: async () => ({ lines: rows.map((r) => ({ match: `${r.team1} vs ${r.team2}`, start_utc: new Date(r.t).toISOString().replace(".000", ""), fmt: "T20" })) }),
    getText: async () => "", loadIdentity: async () => NO_IDENTITY,
    getHtml: async (url) => { calls.push(url); if (url.endsWith("/") || url.endsWith("/schedule")) return sched; const id = /\/match\/m(\d+)/.exec(url)?.[1]; return id ? page(id) : ""; },
    ...over,
  });
  return { mk, calls, advance: (ms) => { t += ms; } };
}

test("a busy day: every live card is read, the rest are paced inside the budget and nothing is read twice in a round", async () => {
  const { mk, calls } = busyDay();
  const feed = mk({ readBudget: 40 });
  const body = await feed.snapshot();
  const reads = calls.filter((u) => u.includes("/match/m"));
  assert.ok(reads.length <= 40 * 2, `at most 2 page reads per match within the budget, got ${reads.length}`);
  assert.equal(body.matches.filter((m) => m.status === "live").length, 25, "all 25 live");
  assert.equal(body.reads.live, 25);
  assert.ok(body.reads.skipped >= 0);
  for (let i = 0; i < 25; i++) assert.ok(reads.some((u) => u.endsWith(`/match/m${i}`)), `live match ${i} was read`);
  assert.equal(new Set(reads).size, reads.length, "no page is read twice in one round");
});

test("upcoming matches are read from 30 minutes before the start, and once in two minutes; finished ones once in ten", async () => {
  const day = busyDay({ live: 2, upcoming: 3, final: 2, start: "2026-11-05T02:00:00Z" }); // upcoming start 03:20: 80 minutes off
  const feed = day.mk();
  await feed.snapshot();
  assert.equal(day.calls.filter((u) => u.endsWith("/match/m100")).length, 0, "80 minutes before the start: not read");
  day.advance(60 * 60e3); // 03:00, 20 minutes before
  await feed.snapshot();
  assert.equal(day.calls.filter((u) => u.endsWith("/match/m100")).length, 1, "inside 30 minutes: read");
  day.advance(20_000);
  await feed.snapshot();
  assert.equal(day.calls.filter((u) => u.endsWith("/match/m100")).length, 1, "not again within two minutes");
  const finals = () => day.calls.filter((u) => u.endsWith("/match/m200")).length;
  const heldAt = finals();
  day.advance(2 * 60e3);
  await feed.snapshot();
  assert.equal(day.calls.filter((u) => u.endsWith("/match/m100")).length, 2, "again after two minutes");
  assert.equal(finals(), heldAt, "a finished match is held for ten minutes: no read in these rounds");
});

test("a live page that is slow or fails keeps its last good read, marked stale, and the response still goes out", async () => {
  const row = (i) => ({ team1: `Home ${i}`, team2: `Away ${i}`, t1SName: `H${i}`, t2SName: `A${i}`, t: Date.parse("2026-11-05T02:00:00Z"), fo: "T20", mf: `M${i}`, link: `/match/m${i}`, s1: "50-1", o1: "6.0", status: 1, winningTeam: -1, w: -1, statusText: "Live" });
  const rows = [0, 1, 2].map(row);
  const sched = pageHtml({ [FIXTURE]: rows });
  const page = (id) => pageHtml({ [LIVE]: { team1_f_n: `Home ${id}`, team2_f_n: `Away ${id}`, status: 1, score1: "60-1", over1: "7.0", player_full_name1: "Kavem Hodge", run1: "40", ball1: "(30)" } });
  let down = false, t = Date.parse("2026-11-05T03:00:00Z");
  const feed = createFeed({
    now: () => t, cardBudgetMs: 50, liveWaitMs: 300, pageMs: 100, base: () => "https://src.test", booksUrl: "books", scheduleUrl: "schedule.csv",
    getJson: async () => ({ lines: rows.map((r) => ({ match: `${r.team1} vs ${r.team2}`, start_utc: new Date(r.t).toISOString().replace(".000", ""), fmt: "T20" })) }),
    getText: async () => "", loadIdentity: async () => NO_IDENTITY,
    getHtml: (url) => (down && url.includes("/match/m1") ? new Promise(() => {}) : Promise.resolve(url.endsWith("/") || url.endsWith("/schedule") ? sched : /\/match\/m(\d+)/.test(url) ? page(/\/match\/m(\d+)/.exec(url)[1]) : "")),
  });
  const first = await feed.snapshot();
  assert.ok(first.matches.find((m) => m.id === "M1").teams.some((x) => x.display), "read fine the first time");
  down = true;
  t += 20_000; // past the 15 s the snapshot is held
  const t0 = Date.now();
  const second = await feed.snapshot();
  assert.ok(Date.now() - t0 < 2000, "the response did not wait for the hung page");
  const m1 = second.matches.find((m) => m.id === "M1");
  assert.ok(m1.teams.some((x) => x.display), "it still has its last good score");
  assert.equal(m1.stale, true, "marked stale");
  assert.equal(second.matches.find((m) => m.id === "M0").stale, undefined, "the others are fresh");
  assert.equal(second.reads.timedOut, 1);
});

test("the published T20 feed shows a ground delay and clears it when play resumes", async () => {
  let t = Date.parse(START);
  let delayed = true;
  const list = (comment1) => pageHtml({ [FIXTURE]: [{
    team1: "Side A", team2: "Side B", fo: "T20", mf: "T20-1", link: "/match/t20",
    t: Date.parse(START), s1: "120-5", status: 1, statusText: "Live", comment1,
  }] });
  const feed = createFeed({
    now: () => t, base: () => "https://src.test", cardBudgetMs: Infinity,
    getJson: async () => ({ lines: [{ match: "Side A vs Side B", start_utc: START, fmt: "T20" }] }),
    getText: async () => "", loadIdentity: async () => NO_IDENTITY,
    getHtml: async (url) => {
      if (url.endsWith("/schedule")) return list("");
      if (url.endsWith("/")) return list(delayed ? "Ground delay" : "");
      if (url.endsWith("/match/t20")) return pageHtml({ [LIVE]: {
        team1_f_n: "Side A", team2_f_n: "Side B", score1: "120-5", score2: "101-4",
        status: 1, comment1: "Side B need 20 runs",
      } });
      return "";
    },
  });

  const [paused] = (await feed.snapshot()).matches;
  assert.equal(paused.status, "live");
  assert.equal(paused.session, "Ground delay");
  assert.equal(paused.summary, "Ground delay");
  assert.equal(paused.teams[1].runs, 101);
  delayed = false;
  t += 20_000;
  const [resumed] = (await feed.snapshot()).matches;
  assert.equal(resumed.status, "live");
  assert.equal(resumed.session, "");
  assert.equal(resumed.summary, "Side B need 20 runs");
});
