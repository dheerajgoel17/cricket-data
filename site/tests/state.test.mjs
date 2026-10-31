import test from "node:test";
import assert from "node:assert/strict";
import { settlePhase, stateRow, toLiveShape } from "@cricket/engine/state.js";
import { liveForFixture } from "@cricket/engine/live.js";

const feed = (o = {}) => ({ teams: [{ name: "India" }, { name: "Australia", display: "152/6" }], start: "2026-10-31T09:00:00Z", fmt: "T20", status: "live", session: "", summary: "Australia need 20", series: "Tour", venue: "MCG", ...o });

test("a feed match becomes one row keyed by its sides, format and start day (the order of the sides does not matter)", () => {
  const r = stateRow(feed());
  assert.equal(r.phase, "live");
  assert.equal(r.fmt, "T20");
  assert.equal(r.start_utc, "2026-10-31T09:00:00.000Z");
  assert.deepEqual(r.scores.map((s) => s.display), ["", "152/6"]);
  assert.equal(stateRow(feed({ teams: [{ name: "Australia" }, { name: "India" }] })).match_key, r.match_key);
});

test("a match with no two sides or no usable start has no row, and an unknown status is upcoming", () => {
  assert.equal(stateRow(feed({ teams: [{ name: "India" }] })), null);
  assert.equal(stateRow(feed({ start: "soon" })), null);
  assert.equal(stateRow(feed({ status: "weird" })).phase, "upcoming");
});

test("settlePhase: in play inside the keep window, over after it, to come before the start, final stays final", () => {
  const start = Date.parse("2026-10-31T09:00:00Z");
  const row = (o) => ({ phase: "live", start_utc: "2026-10-31T09:00:00Z", fmt: "T20", ...o });
  assert.equal(settlePhase(row(), start + 3600e3), "live");
  assert.equal(settlePhase(row(), start + 25 * 3600e3), "final");
  assert.equal(settlePhase(row({ phase: "upcoming" }), start - 3600e3), "upcoming");
  assert.equal(settlePhase(row({ phase: "final" }), start + 3600e3), "final");
  assert.equal(settlePhase(row({ fmt: "Test" }), start + 3 * 24 * 3600e3), "live"); // a Test stays on for six days
  assert.equal(settlePhase(row({ fmt: "Test" }), start + 7 * 24 * 3600e3), "final");
});

test("a row read back is found by the same lookup the live feed uses, with the phase as its status", () => {
  const doc = { matches: [toLiveShape({ a: "India", b: "Australia", fmt: "T20", start_utc: "2026-10-31T09:00:00.000Z", phase: "final", scores: [{ name: "Australia", display: "152/6" }], session: "", summary: "India won", series: "", venue: "" })] };
  const hit = liveForFixture(doc, { a: "Australia", b: "India", start: "2026-10-31T09:30:00Z", fmt: "T20" });
  assert.equal(hit.status, "final");
  assert.equal(hit.teams.find((t) => t.name === "Australia").display, "152/6");
});
