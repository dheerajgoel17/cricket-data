import test from "node:test";
import assert from "node:assert/strict";
import { cardFields, cardText, renderCard } from "../src/engine/card.js";
import { parseShare } from "../api/share.js";

const data = {
  index: { players: { id: ["aaaa1111", "bbbb2222"], nm: ["Harry Brook", "Rashid Khan"], tm: [0, 1] }, teams: [{ n: "England", g: 0 }, { n: "Afghanistan", g: 0 }] },
  photos: { p: { aaaa1111: "c:1IG" } },
  lines: { lines: [
    { pid: "aaaa1111", stat: "runs", line: 24.5, match: "England vs India", books: [{ source: "bet365", over: 1.83 }, { source: "smarkets", over: 1.9 }] },
    { pid: "aaaa1111", stat: "runs", line: 30.5, match: "England vs India", books: [{ source: "bet365", over: 2.4 }] },
  ] },
  fixtures: [{ id: "2026-10-29-afghanistan-v-zimbabwe", a: "Afghanistan", b: "Zimbabwe", start: "2026-10-29T14:30Z", venue: "Sharjah Cricket Stadium, Sharjah", series: "Afghanistan vs Zimbabwe in UAE 2026" }],
};

test("a prop card has the player, the line, and the best over price with its book; the numbers come only from the data", () => {
  const f = cardFields({ p: "0", stat: "runs", line: "24.5" }, data);
  assert.deepEqual([f.kind, f.name, f.team, f.stat, f.line, f.price, f.book, f.books, f.match], ["prop", "Harry Brook", "England", "Runs", 24.5, 1.9, "Smarkets", 2, "England vs India"]);
  assert.match(cardText(f).title, /^Harry Brook: over 24\.5 runs at 1\.90$/);
  assert.match(cardText(f).description, /best price 1\.90 at Smarkets in England vs India/);
});

test("a line the books do not price has no price, a player alone is a player card, an unknown stat or player or fixture gives nothing", () => {
  assert.equal(cardFields({ p: "0", stat: "runs", line: "99.5" }, data).price, undefined);
  assert.equal(cardFields({ p: "1" }, data).kind, "player");
  assert.equal(cardFields({ p: "0", stat: "nonsense", line: "1.5" }, data).kind, "player");
  assert.equal(cardFields({ p: "7" }, data), null);
  assert.equal(cardFields({ f: "nope" }, data), null);
  assert.match(cardText(cardFields({ f: "2026-10-29-afghanistan-v-zimbabwe" }, data)).description, /Sharjah Cricket Stadium/);
});

test("every kind of card draws a JPEG small enough for link previews, with or without a photo", async () => {
  for (const q of [{ p: "0", stat: "runs", line: "24.5" }, { p: "1" }, { f: "2026-10-29-afghanistan-v-zimbabwe" }]) {
    const img = await renderCard(cardFields(q, data));
    assert.deepEqual([...img.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.ok(img.length < 300 * 1024, `${img.length} bytes`);
  }
});

test("share paths name the player, his stat and line, or a fixture, and nothing else", () => {
  assert.deepEqual(parseShare("player/12/runs/24.5"), { card: { p: "12", stat: "runs", line: "24.5" }, page: "/player/12?stat=runs&line=24.5" });
  assert.deepEqual(parseShare("player/12"), { card: { p: "12" }, page: "/player/12" });
  assert.deepEqual(parseShare("fixture/2026-10-29-a-v-b"), { card: { f: "2026-10-29-a-v-b" }, page: "/fixture/2026-10-29-a-v-b" });
  assert.equal(parseShare("player/x"), null);
  assert.equal(parseShare("admin/1"), null);
  assert.equal(parseShare("player/12/runs/abc").card.stat, undefined); // a line that is not a number is dropped
});
