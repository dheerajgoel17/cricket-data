import test from "node:test";
import assert from "node:assert/strict";
import { fancyCardHtml, propCardHtml } from "../cloudflare/card-html.js";

const prop = { kind: "prop", name: "Harry Brook", team: "England", opp: "India", fmt: "T20", stat: "Runs", line: 24.5, price: 1.83, book: "bet365", source: "bet365", initials: "HB",
  photos: ["https://img.example/face.png"], kitPhotos: ["https://img.example/kit.png"], l5: { hits: 3, played: 5, p: 0.6 }, last5: [{ value: 30, vs: "India" }, { value: 10, vs: "New Zealand" }, { value: 24.5, vs: "Pakistan" }, { value: 40, vs: "Oman" }, { value: 5, vs: "Nepal" }] };

test("the Cloudflare prop card carries the line, price, book logo, hit count and the last five from the same fields as the canvas card", () => {
  const html = propCardHtml(prop, { origin: "https://site.example", css: "https://site.example/assets/index-x.css" });
  assert.match(html, /OVER 24\.5/);
  assert.match(html, /1\.83/);
  assert.match(html, /3\/5/);
  assert.match(html, /<img src="https:\/\/site\.example\/books\/bet365\.svg"/);
  assert.match(html, /href="https:\/\/site\.example\/assets\/index-x\.css"/); // Satoshi + Barlow Condensed come from the site's own stylesheet
  assert.match(html, /face\.png/);
  assert.equal((html.match(/class="col"/g) || []).length, 5);
  assert.match(html, /NZ|NEW/i);
});

test("a prop card without form or photo still draws: initials in place of the portrait, no chart, no sticker", () => {
  const html = propCardHtml({ ...prop, photos: [], kitPhotos: [], l5: undefined, last5: undefined }, {});
  assert.match(html, /HB/);
  assert.doesNotMatch(html, /LAST 5 INNINGS/);
  assert.doesNotMatch(html, /class="sticker"/);
});

test("the fancy card shows both sides' lines with the better one outlined, the hit count and the fair price", () => {
  const ff = { label: "Sixes", team: null, fmt: "T20", a: "India", b: "New Zealand", line: 19.5, overLine: 19.5, underLine: 19.5, over: 1.83, under: 1.83, overBook: "bet365", underBook: "bet365", overStem: "bet365", underStem: "bet365",
    side: "over", hits: 6, played: 10, fair: 1.82, at: { over: 5, under: 3, n: 8 }, last: [{ v: 20, s: "hit" }, { v: 12, s: "miss" }, { v: 19.5, s: "push" }] };
  const html = fancyCardHtml(ff, { origin: "https://site.example", aLogo: "https://img.example/a.png" });
  assert.match(html, /6\/10/);
  assert.match(html, /1\.82/);
  assert.match(html, /5\/8/);
  assert.match(html, /inset 0 0 0 3px #27da8e/); // the over tile
  assert.equal((html.match(/inset 0 0 0 3px #27da8e/g) || []).length, 1);
});
