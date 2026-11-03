/**
 * Bookmaker logos, in site/public/books: the brand's mark as supplied, cropped to the mark or scaled down and never redrawn. A book with no file here shows a name chip:
 * add its file and one line in packages/engine/books.js when the brand supplies one. The site is dark, so a white or reversed version is best.
 */
import { BOOK_STEMS, bookLogoStem, bookVariant } from "@cricket/engine/books.js";

export { bookVariant };

export const BOOK_LOGOS: Record<string, string> = Object.fromEntries(
  Object.keys(BOOK_STEMS).map((stem) => {
    // svg preferred where we ship one; png for the rest (matches public/books)
    const ext = ["bet365", "ladbrokes", "polymarket"].includes(stem) ? "svg" : "png";
    return [stem, `/books/${stem}.${ext}`];
  }),
);

/** The logo file for a book as the feed names it ("bet365", "Ladbrokes", "FairWin247 Premium", "moviodds_bet365"...), if we hold one. */
export const bookLogo = (source: string): string | undefined => {
  const stem = bookLogoStem(source);
  return stem ? BOOK_LOGOS[stem] : undefined;
};
