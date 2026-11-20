import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { BOOK_STEMS, bookDisplayName, bookLogoFile, bookLogoStem, bookVariant, bookVersion, setBookManifest, subscribeBooks } from "@cricket/engine/books.js";

const booksDir = join(dirname(fileURLToPath(import.meta.url)), "../public/books");

test("every stem has a logo file in public/books", () => {
  for (const stem of Object.keys(BOOK_STEMS)) {
    const hit = ["svg", "png", "jpg", "webp"].some((ext) => existsSync(join(booksDir, `${stem}.${ext}`)));
    assert.ok(hit, `${stem} missing from public/books`);
  }
});

test("bookLogoStem resolves every feed name we publish to its mark", () => {
  const cases = [
    ["bet365", "bet365"],
    ["moviodds_bet365", "bet365"],
    ["feedx_bet365", "bet365"],
    ["Ladbrokes", "ladbrokes"],
    ["feedg_ladbrokes", "ladbrokes"],
    ["LeoVegas", "leovegas"],
    ["FairWin247 Premium", "fairwin247"],
    ["FairWin247 Fancy", "fairwin247"],
    ["Dafabet", "dafabet"],
    ["Reddybook", "reddybook"],
    ["1xBet", "1xbet"],
    ["polymarket", "polymarket"],
    ["Swarm", "swarm"],
    ["nobody", ""],
  ];
  for (const [src, stem] of cases) assert.equal(bookLogoStem(src), stem, src);
});

test("bookVariant and display name keep Premium / Fancy when present", () => {
  assert.equal(bookVariant("FairWin247 Premium"), "Premium");
  assert.equal(bookDisplayName("FairWin247 Fancy"), "FairWin247 Fancy");
  assert.equal(bookDisplayName("moviodds_bet365"), "bet365");
  assert.equal(bookDisplayName("Ladbrokes"), "Ladbrokes");
});


test("public/books/books.json lists exactly the logo files, and every built-in book", () => {
  const manifest = JSON.parse(readFileSync(join(booksDir, "books.json"), "utf8"));
  const files = readdirSync(booksDir).filter((f) => /\.(svg|png|jpg|webp)$/i.test(f)).sort();
  assert.deepEqual(Object.values(manifest).map((v) => v.file).sort(), files, "a logo file with no manifest entry (or the reverse)");
  for (const [stem, name] of Object.entries(BOOK_STEMS)) assert.equal(manifest[stem]?.name, name, `${stem} in books.json`);
  for (const [stem, v] of Object.entries(manifest)) assert.equal(stem, v.name.toLowerCase().replace(/[^a-z0-9]+/g, ""), `${stem}: the stem is the compact form of the name feeds publish it under`);
});

test("a book published after the app was built is known from books.json alone", () => {
  assert.equal(bookLogoStem("NewBook Premium"), "");
  let pings = 0;
  const off = subscribeBooks(() => { pings++; });
  const v = bookVersion();
  assert.equal(setBookManifest({ newbook: { name: "NewBook", file: "newbook.webp" }, "bad stem": { name: "x", file: "x.png" }, evil: { name: "E", file: "../../x.png" }, none: null }), true);
  assert.equal(bookLogoStem("NewBook Premium"), "newbook");
  assert.equal(bookLogoStem("evil"), "");
  assert.equal(bookDisplayName("NewBook Premium"), "NewBook Premium");
  assert.equal(bookLogoFile("newbook"), "newbook.webp");
  assert.equal(bookLogoFile("bcgame"), "bcgame.png");
  assert.equal(bookLogoFile("bet365"), "bet365.svg");
  assert.equal(bookVersion(), v + 1);
  assert.equal(pings, 1);
  assert.equal(setBookManifest({ newbook: { name: "NewBook", file: "newbook.webp" } }), false); // unchanged: nobody re-renders
  assert.equal(setBookManifest("nonsense"), false);
  off();
});
