import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOK_LOGOS, bookLogo } from "./books";

describe("book logos", () => {
  it("every listed logo is a file in site/public", () => {
    for (const [book, path] of Object.entries(BOOK_LOGOS)) expect(existsSync(join(process.cwd(), "public", path)), `${book}: ${path}`).toBe(true);
  });
  it("finds a logo by the name the feed uses, in any case", () => {
    expect(bookLogo("Ladbrokes")).toBe(BOOK_LOGOS.ladbrokes);
    expect(bookLogo("LeoVegas")).toBe(BOOK_LOGOS.leovegas);
    expect(bookLogo("bet365")).toBe(BOOK_LOGOS.bet365);
    expect(bookLogo("nobody")).toBeUndefined();
  });
});
