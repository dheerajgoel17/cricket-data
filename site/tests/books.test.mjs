import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BOOK_STEMS, bookDisplayName, bookLogoStem, bookVariant } from "@cricket/engine/books.js";

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
    ["Puntit", "puntit"],
    ["Reddybook", "reddybook"],
    ["polymarket", "polymarket"],
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
