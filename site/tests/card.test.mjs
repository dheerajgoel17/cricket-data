import test from "node:test";
import assert from "node:assert/strict";
import { cardFields, cardPath, cardQuery, cardText, propForm, renderCard } from "@cricket/engine/card.js";
import { parseShare } from "../api/share.js";

const data = {
  index: { players: { id: ["aaaa1111", "bbbb2222"], nm: ["Harry Brook", "Rashid Khan"], tm: [0, 1] }, teams: [{ n: "England", g: 0 }, { n: "Afghanistan", g: 0 }], venues: ["Sharjah Cricket Stadium, Sharjah"] },
  photos: { p: { aaaa1111: "c:1IG" }, t: { england: "1", india: "2" } },
  lines: { lines: [
    { pid: "aaaa1111", player: "Harry Brook", team: "England", fmt: "T20", stat: "runs", line: 24.5, match: "England vs India", start_utc: "2026-10-29T14:30Z", books: [{ source: "bet365", over: 1.83, under: 1.90 }, { source: "smarkets", over: 1.9, under: 1.85 }] },
    { pid: "aaaa1111", stat: "runs", line: 30.5, match: "England vs India", books: [{ source: "bet365", over: 2.4 }] },
  ] },
  fixtures: [{ id: "2026-10-29-afghanistan-v-zimbabwe", a: "Afghanistan", b: "Zimbabwe", start: "2026-10-29T14:30Z", venue: "Sharjah Cricket Stadium, Sharjah", series: "Afghanistan vs Zimbabwe in UAE 2026" }],
  form: { aaaa1111: {
    last: { value: 25, date: "25 Oct", vs: "India" },
    hit: { p: 0.6, n: 5 },
    l5: { p: 0.6, played: 5, hits: 3, mean: 18 },
    last5: [{ value: 10 }, { value: 20 }, { value: 5 }, { value: 30 }, { value: 25 }],
  } },
};

test("a prop card has the player, the line, and the best over price with its book; the numbers come only from the data", () => {
  const f = cardFields({ p: "0", stat: "runs", line: "24.5" }, data);
  assert.deepEqual([f.kind, f.name, f.team, f.stat, f.line, f.price, f.book, f.source, f.books, f.match, f.opp, f.fmt, f.role], ["prop", "Harry Brook", "England", "Runs", 24.5, 1.9, "Smarkets", "smarkets", 2, "England vs India", "India", "T20", "Batter"]);
  assert.equal(f.when, undefined); // kickoff time stays off the picture
  assert.equal(f.last.value, 25);
  assert.equal(f.hit.p, 0.6);
  assert.equal(f.l5.mean, 18);
  assert.equal(f.last5.length, 5);
  assert.match(cardText(f).title, /^Harry Brook: runs over 24\.5 at 1\.90$/);
  assert.match(cardText(f).description, /listed 1\.90 at Smarkets in England vs India/);
});

test("a line the books do not price has no price, a player alone is a player card, an unknown stat or player or fixture gives nothing", () => {
  assert.equal(cardFields({ p: "0", stat: "runs", line: "99.5" }, data).price, undefined);
  assert.equal(cardFields({ p: "1" }, data).kind, "player");
  assert.equal(cardFields({ p: "0", stat: "nonsense", line: "1.5" }, data).kind, "player");
  assert.equal(cardFields({ p: "7" }, data), null);
  assert.equal(cardFields({ f: "nope" }, data), null);
  assert.match(cardText(cardFields({ f: "2026-10-29-afghanistan-v-zimbabwe" }, data)).description, /Sharjah Cricket Stadium/);
});

test("a player URL with no stat still draws his booked line, so the picture is not an empty name card", () => {
  const future = { ...data, lines: { lines: data.lines.lines.map((l) => ({ ...l, start_utc: "2026-11-02T14:30Z" })) } };
  const f = cardFields({ p: "0" }, future);
  assert.equal(f.kind, "prop");
  assert.equal(f.stat, "Runs");
  assert.equal(f.line, 24.5);
  assert.equal(f.price, 1.9);
});

test("every kind of card draws a JPEG small enough for link previews, with or without a photo", async () => {
  for (const q of [{ p: "0", stat: "runs", line: "24.5" }, { p: "1" }, { f: "2026-10-29-afghanistan-v-zimbabwe" }, { v: "0" }]) {
    const img = await renderCard(cardFields(q, data));
    assert.deepEqual([...img.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.ok(img.length < 300 * 1024, `${img.length} bytes`);
  }
});

test("L5 mean, hit rate and last innings are the last five played values vs the line, counted by windowRate", () => {
  // 10, 20, 5, 30, 25 vs 16.5 over: hits 20/30/25 = 3/5, mean (10+20+5+30+25)/5 = 18, last = 25
  const f = propForm(
    [{ value: 10, date: "2026-09-01", opp: "A" }, { value: 20, date: "2026-09-08", opp: "B" }, { value: null, date: "2026-09-15", opp: "C" },
      { value: 5, date: "2026-09-22", opp: "D" }, { value: 30, date: "2026-10-01", opp: "E" }, { value: 25, date: "2026-10-25", opp: "India" }],
    16.5,
  );
  assert.equal(f.l5.played, 5);
  assert.equal(f.l5.hits, 3);
  assert.equal(f.l5.p, 0.6);
  assert.equal(f.l5.mean, 18);
  assert.equal(f.last.value, 25);
  assert.equal(f.last.vs, "India");
  assert.deepEqual(f.last5.map((e) => e.value), [10, 20, 5, 30, 25]);
});

test("a prop card draws the book's own mark from public/books", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const bookLogo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../public/books/bet365.svg"));
  const img = await renderCard(cardFields({ p: "0", stat: "runs", line: "24.5" }, data), { bookLogo });
  assert.deepEqual([...img.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.ok(img.length < 300 * 1024);
});

test("a prop card draws the site mark from public/icon-192.png", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const brandLogo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../public/icon-192.png"));
  const img = await renderCard(cardFields({ p: "0", stat: "runs", line: "24.5" }, data), { brandLogo });
  assert.deepEqual([...img.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.ok(img.length < 300 * 1024);
});

test("share paths name the player, his stat and line, or a fixture, and nothing else", () => {
  assert.deepEqual(parseShare("player/12/runs/24.5"), { card: { p: "12", stat: "runs", line: "24.5" }, page: "/player/12?stat=runs&line=24.5" });
  assert.deepEqual(parseShare("player/12"), { card: { p: "12" }, page: "/player/12" });
  assert.deepEqual(parseShare("fixture/2026-10-29-a-v-b"), { card: { f: "2026-10-29-a-v-b" }, page: "/fixture/2026-10-29-a-v-b" });
  assert.deepEqual(parseShare("venue/3"), { card: { v: "3" }, page: "/venue/3" });
  assert.deepEqual(parseShare("player%2F12"), { card: { p: "12" }, page: "/player/12" });
  assert.equal(parseShare("player/x"), null);
  assert.equal(parseShare("admin/1"), null);
  assert.equal(parseShare("player/12/runs/abc").card.stat, undefined); // a line that is not a number is dropped
});

test("a card's file-like path and its query are each other's inverse", () => {
  for (const q of [{ p: "12", stat: "runs", line: "24.5" }, { p: "12" }, { f: "2026-10-29-a-v-b" }, { v: "3" }]) assert.deepEqual(cardQuery(cardPath(q)), q);
  assert.equal(cardPath({ p: "12", stat: "runs", line: "24.5" }), "/card/v7/player/12/runs/24.5.jpg");
  assert.deepEqual(cardQuery("player/12/runs/24.5.jpg"), { p: "12", stat: "runs", line: "24.5" }); // older /card/player/...jpg still draws
  assert.deepEqual(cardQuery("admin/1.jpg"), {});
});
