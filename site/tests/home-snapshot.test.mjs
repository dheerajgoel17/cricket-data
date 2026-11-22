import assert from "node:assert/strict";
import { test } from "node:test";
import { homeSnapshot } from "../scripts/seo.mjs";

const now = Date.parse("2026-11-22T09:00:00Z");
const fixture = { id: "2026-11-22-alpha-v-beta", a: "Alpha", b: "Beta", start: "2026-11-22T11:00:00Z", status: "Upcoming", fmt: "T20", venue: "<Ground>" };
const lines = { events: [{ match: "Alpha vs Beta", start_utc: fixture.start, fmt: "T20" }] };

test("the initial homepage contains tappable, escaped cards for priced fixtures", () => {
  const html = homeSnapshot([fixture, { ...fixture, id: "2026-11-22-alpha-v-gamma", b: "Gamma" }], lines, now);
  assert.match(html, /href="\/fixture\/2026-11-22-alpha-v-beta"/);
  assert.match(html, /&lt;Ground&gt;/);
  assert.doesNotMatch(html, /Gamma/);
});

test("a past or unpriced fixture cannot appear as an upcoming card", () => {
  assert.equal(homeSnapshot([fixture], lines, Date.parse("2026-11-22T12:00:00Z")), "");
  assert.equal(homeSnapshot([fixture], null, now), "");
  assert.equal(homeSnapshot([{ ...fixture, status: "Live" }], lines, now), "");
});
