import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOK_LOGOS, bookLogo, bookVariant } from "./books";

describe("book logos", () => {
  it("every listed logo is a file in site/public", () => {
    for (const [book, path] of Object.entries(BOOK_LOGOS)) expect(existsSync(join(process.cwd(), "public", path)), `${book}: ${path}`).toBe(true);
  });
  it("finds a logo by the name the feed uses, in any case", () => {
    expect(bookLogo("Ladbrokes")).toBe(BOOK_LOGOS.ladbrokes);
    expect(bookLogo("LeoVegas")).toBe(BOOK_LOGOS.leovegas);
    expect(bookLogo("bet365")).toBe(BOOK_LOGOS.bet365);
    expect(bookLogo("Dafabet")).toBe(BOOK_LOGOS.dafabet);
    expect(bookLogo("Puntit")).toBe(BOOK_LOGOS.puntit);
    expect(bookLogo("Reddybook")).toBe(BOOK_LOGOS.reddybook);
    expect(bookLogo("polymarket")).toBe(BOOK_LOGOS.polymarket);
    expect(bookLogo("nobody")).toBeUndefined();
  });
  it("resolves compound and Premium/Fancy feed names for every book we ship", () => {
    expect(bookLogo("moviodds_bet365")).toBe(BOOK_LOGOS.bet365);
    expect(bookLogo("feedx_bet365")).toBe(BOOK_LOGOS.bet365);
    expect(bookLogo("feedg_ladbrokes")).toBe(BOOK_LOGOS.ladbrokes);
    expect(bookLogo("FairWin247 Premium")).toBe(BOOK_LOGOS.fairwin247);
    expect(bookLogo("FairWin247 Fancy")).toBe(BOOK_LOGOS.fairwin247);
    expect(bookLogo("moviodds_leovegas")).toBe(BOOK_LOGOS.leovegas);
    expect(bookLogo("feed_dafabet")).toBe(BOOK_LOGOS.dafabet);
  });
});

describe("a book's feeds", () => {
  it("share the book's logo and name their feed", () => {
    expect(bookLogo("FairWin247 Premium")).toBe(BOOK_LOGOS.fairwin247);
    expect(bookLogo("FairWin247 Fancy")).toBe(BOOK_LOGOS.fairwin247);
    expect([bookVariant("FairWin247 Premium"), bookVariant("FairWin247 fancy"), bookVariant("bet365")]).toEqual(["Premium", "fancy", ""]);
  });
});
