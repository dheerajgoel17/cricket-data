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
