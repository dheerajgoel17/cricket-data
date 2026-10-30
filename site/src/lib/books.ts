/**
 * Bookmaker logos, in site/public/books: the brand's mark as supplied, cropped to the mark or scaled down and never redrawn. A book with no file here shows a name chip:
 * add its file and one line below when the brand supplies one. The site is dark, so a white or reversed version is best.
 */
export const BOOK_LOGOS: Record<string, string> = {
  bet365: "/books/bet365.svg",
  ladbrokes: "/books/ladbrokes.svg",
  leovegas: "/books/leovegas.png",
  fairwin247: "/books/fairwin247.png",
  reddybook: "/books/reddybook.png",
  polymarket: "/books/polymarket.svg",
  dafabet: "/books/dafabet.png",
};

/** A book that quotes two feeds with their own rules is published as two names ("FairWin247 Premium", "FairWin247 Fancy"): one logo, the feed's name beside it. */
const VARIANT = /^(.*\S)\s+(Premium|Fancy)$/i;
export const bookVariant = (source: string): string => VARIANT.exec(String(source))?.[2] ?? "";

/** The logo file for a book as the feed names it ("bet365", "Ladbrokes", "smarkets", "FairWin247 Premium"...), if we hold one. */
export const bookLogo = (source: string): string | undefined => BOOK_LOGOS[String(source).replace(VARIANT, "$1").toLowerCase()];
