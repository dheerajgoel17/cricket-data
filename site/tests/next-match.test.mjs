import test from "node:test";
import assert from "node:assert/strict";
import { atGround, matchPhase, nextMatchRates, pickPricedMatch, vsSide } from "../src/engine/next-match.js";

const e = (value, extra = {}) => ({ value, ...extra });

test("vsSide folds Women / (W) so a WBBL opponent matches the history's short name (hand-computed)", () => {
  const rows = [e(22, { opp: "Sydney Sixers" }), e(10, { opp: "Sydney Sixers (W)" }), e(40, { opp: "Melbourne Stars Women" })];
  assert.equal(vsSide(rows, "Sydney Sixers Women").length, 2);
  assert.equal(vsSide(rows, "Sydney Sixers").length, 2);
  assert.equal(vsSide(rows, "Melbourne Stars").length, 1);
});

test("atGround matches the first comma-part: Allan Border Field, Brisbane is Allan Border Field", () => {
  const rows = [e(20, { venueName: "Allan Border Field" }), e(8, { venueName: "Allan Border Field, Brisbane" }), e(30, { venueName: "The Gabba" })];
  assert.equal(atGround(rows, "Allan Border Field, Brisbane").length, 2);
  assert.equal(atGround(rows, "The Gabba, Brisbane").length, 1);
});

test("nextMatchRates: 8 of 15 over 17.5 at the ground is 53% / fair 1.88; 3 of 7 vs the side is 43% / fair 2.33 (hand-computed)", () => {
  const here = [...Array(8).fill(18), ...Array(7).fill(10)].map((value) => e(value, { venueName: "Allan Border Field", opp: "Perth Scorchers" }));
  const versus = [...Array(3).fill(25), ...Array(4).fill(5)].map((value) => e(value, { venueName: "SCG", opp: "Sydney Sixers Women" }));
  const dnp = [e(null, { venueName: "Allan Border Field", opp: "Sydney Sixers Women" })]; // DNP never counts
  const next = { ground: "Allan Border Field, Brisbane", opp: "Sydney Sixers Women" };
  const { here: h, versus: v } = nextMatchRates([...here, ...versus, ...dnp], next, 17.5, "over");
  assert.equal(h.played, 15);
  assert.equal(h.hits, 8);
  assert.equal(Math.round(h.p * 100), 53);
  assert.equal(h.fair, 1.88); // 1 / (8/15) = 1.875 → 1.88
  assert.equal(v.played, 7);
  assert.equal(v.hits, 3);
  assert.equal(Math.round(v.p * 100), 43);
  assert.equal(v.fair, 2.33); // 1 / (3/7) = 2.333… → 2.33
});

test("nextMatchRates: a ground with no counted innings is played 0, not a 0% hit rate", () => {
  const { here } = nextMatchRates([e(20, { venueName: "The Gabba", opp: "Sydney Sixers" })], { ground: "Allan Border Field", opp: "Sydney Sixers" }, 17.5);
  assert.equal(here.played, 0);
  assert.equal(here.p, null);
  assert.equal(here.fair, null);
});

test("nextMatchRates: men's sides, the under, and a bowling line use the same rules", () => {
  const rows = [e(2, { venueName: "Eden Park", opp: "India" }), e(4, { venueName: "Eden Park, Auckland", opp: "India" }), e(1, { venueName: "MCG", opp: "Australia" })];
  const { here, versus } = nextMatchRates(rows, { ground: "Eden Park, Auckland", opp: "India" }, 2.5, "under");
  assert.equal(here.played, 2);
  assert.equal(here.hits, 1); // 2 is under 2.5, 4 is not
  assert.equal(versus.played, 2);
  assert.equal(versus.hits, 1);
  assert.equal(here.fair, 2); // 1 / 0.5
});

test("pickPricedMatch keeps a just-finished T20 (5 h after the start) and prefers it over a later unpriced-looking next game", () => {
  const now = Date.parse("2026-10-30T13:00:00Z");
  const done = { pid: "ck", stat: "runs", fmt: "T20", line: 22.5, match: "Brisbane Heat Women vs Sydney Sixers Women",
    start_utc: "2026-10-30T08:10:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.83, under: 1.83 }] };
  const later = { ...done, match: "Brisbane Heat Women vs Melbourne Stars Women", start_utc: "2026-11-01T08:10:00Z", books: [] };
  assert.equal(pickPricedMatch({ lines: [done, later] }, "ck", "T20", now).match, "Brisbane Heat Women vs Sydney Sixers Women");
  assert.equal(pickPricedMatch({ lines: [done] }, "ck", "T20", Date.parse("2026-10-31T09:10:00Z")), null, "25 h after the start it is gone");
  assert.equal(pickPricedMatch({ lines: [done] }, "ck", "ODI", now), null);
});

test("matchPhase: the live feed's word wins; otherwise the first 5 h after a T20 start are still in play", () => {
  const start = "2026-10-30T08:10:00Z";
  const now = Date.parse("2026-10-30T13:00:00Z"); // 4 h 50 min after the start
  assert.equal(matchPhase(start, Date.parse("2026-10-30T07:00:00Z"), undefined, "T20"), "upcoming");
  assert.equal(matchPhase(start, now, "live", "T20"), "live");
  assert.equal(matchPhase(start, now, "final", "T20"), "final");
  assert.equal(matchPhase(start, now, undefined, "T20"), "live", "no feed yet, still inside 5 h");
  assert.equal(matchPhase(start, Date.parse("2026-10-30T14:00:00Z"), undefined, "T20"), "final", "past 5 h with no feed: finished");
});

test("nextMatchRates: every miss is 0% with no fair over price; a 100% under is fair 1.00", () => {
  const rows = [e(10, { venueName: "Lords", opp: "Australia" }), e(12, { venueName: "Lords", opp: "Australia" })];
  const over = nextMatchRates(rows, { ground: "Lords", opp: "Australia" }, 20.5, "over");
  assert.equal(over.here.hits, 0);
  assert.equal(over.here.p, 0);
  assert.equal(over.here.fair, null);
  const under = nextMatchRates(rows, { ground: "Lords", opp: "Australia" }, 20.5, "under");
  assert.equal(under.here.hits, 2);
  assert.equal(under.here.fair, 1);
});
