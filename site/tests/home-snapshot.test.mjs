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
  assert.equal(homeSnapshot([{ ...fixture, status: "Started" }], lines, now), "");
});

test("browser worker hashing decodes the existing wire format", async () => {
  const { sha256 } = await import("@noble/hashes/sha256");
  const { wrap, unwrap } = await import("@cricket/engine/wrap.js");
  const value = { fixtures: Array.from({ length: 130 }, (_, i) => ({ id: i, name: "São Paulo" })) };
  const secret = "test key";
  const wire = await wrap(value, secret, new Uint8Array(16));
  assert.deepEqual(await unwrap(wire, secret, sha256), value);
});

test("the first response includes every current priced live fixture even before its score arrives", () => {
  const live = Array.from({ length: 6 }, (_, i) => ({
    ...fixture, id: `2026-11-22-alpha-v-team-${i}`, b: `Team ${i}`,
    start: "2026-11-22T08:00:00Z", status: "Live",
  }));
  const stale = { ...live[0], id: "2026-11-20-alpha-v-old", b: "Old", start: "2026-11-20T08:00:00Z" };
  const unpriced = { ...live[0], id: "2026-11-22-alpha-v-unpriced", b: "Unpriced" };
  const events = [...live, stale, fixture].map((f) => ({ match: `${f.a} vs ${f.b}`, start_utc: f.start, fmt: f.fmt }));
  const html = homeSnapshot([...live, stale, unpriced, fixture], { events }, now);
  assert.equal((html.match(/href="\/fixture\//g) || []).length, 6);
  assert.match(html, /Score updating/);
  assert.doesNotMatch(html, /alpha-v-(old|unpriced|beta)/);
});
