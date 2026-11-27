import test from "node:test";
import assert from "node:assert/strict";
import { cardFields, cardPath, cardQuery, cardText, propForm, renderCard, CARD_V } from "@cricket/engine/card.js";
import { parseShare } from "../api/share.js";
import { renderPoster } from "@cricket/engine/poster.js";

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
  assert.deepEqual([f.kind, f.name, f.team, f.stat, f.line, f.side, f.price, f.book, f.source, f.books, f.match, f.opp, f.fmt, f.role], ["prop", "Harry Brook", "England", "Runs", 24.5, "over", 1.9, "Smarkets", "smarkets", 2, "England vs India", "India", "T20", "Batter"]);
  assert.equal(f.when, undefined); // kickoff time stays off the picture
  assert.equal(f.last.value, 25);
  assert.equal(f.hit.p, 0.6);
  assert.equal(f.l5.mean, 18);
  assert.equal(f.last5.length, 5);
  assert.match(cardText(f).title, /^Harry Brook: runs over 24\.5 at 1\.90$/);
  assert.match(cardText(f).description, /listed 1\.90 at Smarkets in England vs India/);
});

test("an under prop card uses the best under price and under wording (same line, other play)", () => {
  const f = cardFields({ p: "0", stat: "runs", line: "24.5", side: "under" }, data);
  assert.equal(f.side, "under");
  assert.equal(f.price, 1.90); // bet365 under 1.90 beats smarkets 1.85
  assert.equal(f.book, "bet365");
  assert.match(cardText(f).title, /^Harry Brook: runs under 24\.5 at 1\.90$/);
  assert.match(cardText(f).description, /runs under 24\.5, listed 1\.90 at bet365/);
  assert.equal(cardPath({ p: "0", stat: "runs", line: "24.5", side: "under" }), `/card/v${CARD_V}/player/0/runs/24.5/under.jpg`);
  assert.deepEqual(cardQuery(cardPath({ p: "0", stat: "runs", line: "24.5", side: "under" })), { p: "0", stat: "runs", line: "24.5", side: "under" });
});

test("propForm hit rates follow the play: under counts games under the line", () => {
  // last five: 20, DNP, 5, 30, 25 vs 16.5 under: 4 played, hits only 5 = 1/4
  const rows = [{ value: 10, date: "2026-09-01", opp: "A" }, { value: 20, date: "2026-09-08", opp: "B" }, { value: null, date: "2026-09-15", opp: "C" },
    { value: 5, date: "2026-09-22", opp: "D" }, { value: 30, date: "2026-10-01", opp: "E" }, { value: 25, date: "2026-10-25", opp: "India" }];
  const u = propForm(rows, 16.5, undefined, { side: "under" });
  assert.equal(u.l5.played, 4);
  assert.equal(u.l5.hits, 1);
  assert.equal(u.l5.p, 0.25);
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
  const future = { ...data, lines: { lines: data.lines.lines.map((l) => ({ ...l, start_utc: "2099-01-01T14:30Z" })) } };
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

test("L5 mean, hit rate and last innings count the last five games like the site's row (a DNP takes a slot), by windowRate", () => {
  // last five games: 20, DNP, 5, 30, 25 vs 16.5 over: 4 played, hits 20/30/25 = 3/4, mean (20+5+30+25)/4 = 20, last = 25
  const f = propForm(
    [{ value: 10, date: "2026-09-01", opp: "A" }, { value: 20, date: "2026-09-08", opp: "B" }, { value: null, date: "2026-09-15", opp: "C" },
      { value: 5, date: "2026-09-22", opp: "D" }, { value: 30, date: "2026-10-01", opp: "E" }, { value: 25, date: "2026-10-25", opp: "India" }],
    16.5,
  );
  assert.equal(f.l5.played, 4);
  assert.equal(f.l5.hits, 3);
  assert.equal(f.l5.p, 0.75);
  assert.equal(f.l5.mean, 20);
  assert.equal(f.last.value, 25);
  assert.equal(f.last.vs, "India");
  assert.deepEqual(f.last5.map((e) => e.value), [20, 5, 30, 25]);
});

test("a prop card draws every book's mark from public/books next to the price", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/books");
  const files = readdirSync(dir).filter((n) => /\.(svg|png|jpg|webp)$/i.test(n));
  assert.ok(files.length >= 7, `expected every stem logo, got ${files.join(",")}`);
  const fields = cardFields({ p: "0", stat: "runs", line: "24.5" }, data);
  for (const name of files) {
    const bookLogo = readFileSync(join(dir, name));
    const img = await renderCard(fields, { bookLogo });
    assert.deepEqual([...img.subarray(0, 3)], [0xff, 0xd8, 0xff], name);
    assert.ok(img.length < 300 * 1024, name);
  }
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
  assert.deepEqual(parseShare("player/12/runs/24.5/under"), { card: { p: "12", stat: "runs", line: "24.5", side: "under" }, page: "/player/12?stat=runs&line=24.5&side=under" });
  assert.deepEqual(parseShare("player/12"), { card: { p: "12" }, page: "/player/12" });
  assert.deepEqual(parseShare("fixture/2026-10-29-a-v-b"), { card: { f: "2026-10-29-a-v-b" }, page: "/fixture/2026-10-29-a-v-b" });
  assert.deepEqual(parseShare("venue/3"), { card: { v: "3" }, page: "/venue/3" });
  assert.deepEqual(parseShare("player%2F12"), { card: { p: "12" }, page: "/player/12" });
  assert.equal(parseShare("player/x"), null);
  assert.equal(parseShare("admin/1"), null);
  assert.equal(parseShare("player/12/runs/abc").card.stat, undefined); // a line that is not a number is dropped
});

test("a card's file-like path and its query are each other's inverse", () => {
  for (const q of [{ p: "12", stat: "runs", line: "24.5" }, { p: "12", stat: "runs", line: "24.5", side: "under" }, { p: "12" }, { f: "2026-10-29-a-v-b" }, { v: "3" }]) assert.deepEqual(cardQuery(cardPath(q)), q);
  assert.equal(cardPath({ p: "12", stat: "runs", line: "24.5" }), `/card/v${CARD_V}/player/12/runs/24.5.jpg`);
  assert.deepEqual(cardQuery("player/12/runs/24.5.jpg"), { p: "12", stat: "runs", line: "24.5" }); // older /card/player/...jpg still draws
  assert.deepEqual(cardQuery("admin/1.jpg"), {});
});

test("a card can be asked for by player id as well as by index: the same fields; an unknown or malformed id gives nothing", () => {
  assert.deepEqual(cardFields({ pid: "aaaa1111", stat: "runs", line: "24.5" }, data), cardFields({ p: "0", stat: "runs", line: "24.5" }, data));
  assert.equal(cardFields({ pid: "bbbb2222" }, data).name, "Rashid Khan");
  assert.equal(cardFields({ pid: "cccc3333" }, data), null);
  assert.equal(cardFields({ pid: "aaaa1111; drop" }, data), null);
  for (const q of [{ pid: "aaaa1111", stat: "runs", line: "24.5" }, { pid: "aaaa1111" }]) assert.deepEqual(cardQuery(cardPath(q)), q);
  assert.equal(cardPath({ pid: "aaaa1111", stat: "runs", line: 24.5 }), `/card/v${CARD_V}/pid/aaaa1111/runs/24.5.jpg`);
  assert.deepEqual(cardQuery("pid/zz/runs/1.jpg"), {}); // not an id
});

test("propForm: calendar-year hit rate, fair odds from the bigger sample, and his games at the ground", () => {
  const rows = [["2025-12-01", 10, "A"], ["2026-01-02", 30, "B"], ["2026-01-09", 40, "C"], ["2026-01-15", 5, "D"], ["2026-01-20", 31, "E"], ["2026-01-25", 28, "F"]]
    .map(([date, value, opp], i) => ({ date, value, opp, venueName: i % 2 ? "Adelaide Oval, Adelaide" : "Optus Stadium, Perth" }));
  const f = propForm(rows, 23.5, (x) => x, { year: "2026", ground: "Adelaide Oval, Adelaide" });
  assert.deepEqual(f.season, { year: "2026", p: 0.8, played: 5, hits: 4, mean: 26.8 });
  assert.deepEqual(f.fair, { odds: 1.25, label: "2026" }); // 5 games this year: 1 / 0.8
  assert.equal(f.atGround.name, "Adelaide Oval");
  assert.deepEqual([f.atGround.played, f.atGround.hits], [3, 2]);
  assert.equal(propForm(rows.slice(0, 2), 23.5, (x) => x, { year: "2026" }).fair, undefined); // 2 games: no fair price
});

test("a prop card lists the books' other lines for the match, nearest four, and its ground from the fixture", async () => {
  const d = { ...data, lines: { lines: [...data.lines.lines.map((l) => ({ ...l, fmt: "T20", start_utc: "2026-10-29T14:30Z" })), { pid: "aaaa1111", fmt: "T20", stat: "runs", line: 20.5, match: "England vs India", start_utc: "2026-10-29T14:30Z", books: [{ source: "bet365", over: 1.6 }] }] },
    fixtures: [{ id: "x", a: "England", b: "India", start: "2026-10-29T14:30Z", venue: "Lord's, London" }] };
  const f = cardFields({ p: "0", stat: "runs", line: "24.5" }, d);
  assert.deepEqual(f.bookLines.map((b) => b.line), [20.5, 24.5, 30.5]);
  assert.equal(f.ground, "Lord's, London");
  assert.equal(f.year, "2026");
  const img = await renderCard({ ...f, ...propForm([{ value: 30, date: "2026-01-02", opp: "B", venueName: "Lord's, London" }, { value: 12, date: "2026-02-02", opp: "C", venueName: "Lord's, London" }, { value: 40, date: "2026-03-02", opp: "D", venueName: "Lord's, London" }], 24.5, (x) => x, { year: "2026", ground: f.ground }) });
  assert.ok(img.length < 300 * 1024);
});

test("propForm counts the last 5 games the way the site's row does (a DNP takes a slot), and gives the record against the opponent", () => {
  const rows = [["2026-01-01", 30, "Sydney Sixers"], ["2026-01-05", 5, "Perth Scorchers"], ["2026-01-09", 40, "Sydney Sixers"], ["2026-01-12", null, "Hobart Hurricanes"], ["2026-01-15", 30, "Sydney Sixers"], ["2026-01-19", 10, "Perth Scorchers"]]
    .map(([date, value, opp]) => ({ date, value, opp }));
  const f = propForm(rows, 23.5, (x) => x, { year: "2026", opp: "Sydney Sixers" });
  assert.deepEqual([f.l5.fixtures, f.l5.played, f.l5.hits], [5, 4, 2]); // last 5 games = 5 slots, 4 played
  assert.deepEqual([f.h2h.played, f.h2h.hits], [3, 3]);
  assert.equal(f.last5.length, 4);
});

test("the shareable poster is a 1080x1350 PNG with or without form, books and photos", async () => {
  const f = cardFields({ p: "0", stat: "runs", line: "24.5" }, data);
  const full = { ...f, ...propForm([{ value: 30, date: "2026-01-02", opp: "B", venueName: "Lord's, London" }, { value: 12, date: "2026-02-02", opp: "C", venueName: "Lord's, London" }, { value: 40, date: "2026-03-02", opp: "D" }], 24.5, (x) => x, { year: "2026", ground: "Lord's, London", opp: "India" }), bookLines: [{ line: 20.5, price: 1.6, book: "Bet365" }, { line: 24.5, price: 1.9, book: "Smarkets" }] };
  for (const x of [f, full]) {
    const png = await renderPoster(x);
    assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1080, 1350]);
  }
  assert.equal(propForm([{ value: 5, date: "2026-01-01", opp: "A" }], 3.5, (x) => x, { year: "2026" }).season.mean, 5);
});

test("a women's fixture draws the women's team logos (the '<name> women' team), a men's one the plain team", () => {
  const photos = { p: {}, t: { england: "E1", "england women": "E2", india: "I1", "india women": "I2" } };
  const mk = (gender) => cardFields({ p: "0", stat: "runs", line: "24.5" }, { ...data, photos, lines: { lines: data.lines.lines.map((l) => ({ ...l, fmt: "T20", start_utc: "2026-10-29T14:30Z" })) }, fixtures: [{ id: "x", a: "England", b: "India", start: "2026-10-29T14:30Z", venue: "Lord's, London", gender }] });
  const w = mk("female"), m = mk("male");
  assert.ok(w.teamPhotos[0].includes("E2") && w.oppPhotos[0].includes("I2"));
  assert.ok(m.teamPhotos[0].includes("E1") && m.oppPhotos[0].includes("I1"));
});

test("a book's Fancy market is never set beside the line: not the listed price, not a row; one line left lists each book's price at it", () => {
  const rows = [
    { pid: "aaaa1111", fmt: "T20", stat: "runs", line: 24.5, match: "England vs India", start_utc: "2026-10-29T14:30Z", books: [{ source: "FairWin247 Premium", over: 1.85, under: 1.85 }, { source: "Dafabet", over: 1.87, under: 1.84 }] },
    { pid: "aaaa1111", fmt: "T20", stat: "runs", line: 22.5, match: "England W vs India W", start_utc: "2026-10-29T14:30Z", books: [{ source: "FairWin247 Fancy", over: 2, under: null }] },
  ];
  const f = cardFields({ p: "0", stat: "runs", line: "24.5" }, { ...data, lines: { lines: rows } });
  assert.equal(f.price, 1.87);
  assert.deepEqual(f.bookLines.map((b) => [b.line, b.price, b.best]), [[24.5, 1.87, true], [24.5, 1.85, false]]);
  assert.equal(f.bookTitle, "BOOKS AT 24.5");
});

test("a Match Fancy market link has its own card path, share path and words", () => {
  const q = { f: "2026-10-29-afghanistan-v-zimbabwe", fm: "match_sixes", sc: "-1" };
  assert.equal(cardPath(q), `/card/v${CARD_V}/fixture/2026-10-29-afghanistan-v-zimbabwe/fancy/match_sixes/-1.jpg`);
  assert.deepEqual(cardQuery(cardPath(q)), q);
  assert.deepEqual(parseShare("fixture/2026-10-29-afghanistan-v-zimbabwe/fancy/match_sixes/-1").card, q);
  assert.equal(parseShare("fixture/x/fancy/match_sixes/0").page, "/fixture/x/fancy?fm=match_sixes&sc=0");
  const f = cardFields(q, data);
  assert.equal(f.kind, "fancyLink");
  assert.match(cardText(f).title, /Afghanistan v Zimbabwe: sixes/i);
});
