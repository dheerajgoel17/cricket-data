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
