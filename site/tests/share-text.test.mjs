import test from "node:test";
import assert from "node:assert/strict";
import { shareText } from "../packages/engine/share-text.js";

const e = (value, opp, venueName) => ({ value, opp, venueName });
const entries = [e(18, "India", "Eden Gardens, Kolkata"), e(44, "India", "Seddon Park, Hamilton"), e(30, "Pakistan", "Seddon Park, Hamilton"), e(12, "Australia", "MCG, Melbourne"), e(41, "Sri Lanka", "Seddon Park, Hamilton"), e(null, "Oman", "X"), e(25, "Ireland", "Y"), e(8, "Scotland", "Z")];

test("a prop's text is the last five, the ground, the opponent, the fair price and the link, from the entries", () => {
  const t = shareText({ entries, line: 24.5, fmt: "T20", price: 1.83, ground: "Seddon Park, Hamilton", opp: "India", url: "https://x.test/share/player/12/runs/24.5" });
  assert.equal(t, [
    "📊 Last 5 (T20): 30 | 12 | 41 | 25 | 8", // the DNP is skipped
    "✅ Over 24.5 in 3 of 5 (60%), avg 23.2",
    "📍 Seddon Park: 44 | 30 | 41 · 3 of 3",
    "🆚 India: 18 | 44 · 1 of 2",
    "⚖️ Fair 1.67 vs 1.83 listed",
    "",
    "https://x.test/share/player/12/runs/24.5",
  ].join("\n"));
});

test("lines with no data are left out, an under line reads Under, and nothing to say is null", () => {
  const t = shareText({ entries: entries.slice(-3), line: 24.5, side: "under", ground: "Nowhere", opp: "Nobody" });
  assert.equal(t, "📊 Last 2: 25 | 8\n✅ Under 24.5 in 1 of 2 (50%), avg 16.5");
  assert.equal(shareText({ entries: [], line: 24.5 }), null);
  assert.equal(shareText({ entries, line: null }), null);
});

import { fancyShareText, matchShareText } from "../packages/engine/share-text.js";

test("a shared fancy line leads with the teams and the pick, then the ground and the recent matches", () => {
  const t = fancyShareText({ a: "New Zealand", b: "India", label: "Total fours", line: 30.5, side: "under", price: 1.9, ground: "Seddon Park, Hamilton", groundValues: [22, 25, 23, 30, 31, 35, 36], values: [37, 23, 28, 27], url: "https://x.test/share/fixture/f" });
  assert.equal(t, [
    "🏏 NEW ZEALAND 🇳🇿 vs INDIA 🇮🇳",
    "🎯 TOTAL FOURS: UNDER 30.5 @ 1.90",
    "📍 Seddon Park: 22 | 25 | 23 | 30 | 31 | 35 | 36 · under 4 of 7",
    "📊 Last 4 matches: 37 | 23 | 28 | 27 · under 3 of 4",
    "",
    "https://x.test/share/fixture/f",
  ].join("\n"));
  assert.equal(fancyShareText({ a: "A", b: "B", label: "X", line: null }), null);
});

test("a shared match names the sides, the day and the ground, and a club has no flag", () => {
  assert.equal(matchShareText({ a: "Afghanistan", b: "Zimbabwe", when: "Today, 8:00 pm", venue: "Sharjah Cricket Stadium", url: "u" }), "🏏 AFGHANISTAN 🇦🇫 vs ZIMBABWE 🇿🇼\n🗓 Today, 8:00 pm · Sharjah Cricket Stadium\n📊 Props, hit rates and fancy lines, free\n\nu");
  assert.match(matchShareText({ a: "Sydney Sixers", b: "Perth Scorchers" }), /^🏏 SYDNEY SIXERS vs PERTH SCORCHERS\n/);
});
