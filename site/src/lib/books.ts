/**
 * Bookmaker logos, in site/public/books: the brand's mark as supplied, cropped to the mark or scaled down and never redrawn. A book with no file here shows a name chip:
 * add its file and one line below when the brand supplies one. The site is dark, so a white or reversed version is best.
 */
export const BOOK_LOGOS: Record<string, string> = {
  bet365: "/books/bet365.svg",
  ladbrokes: "/books/ladbrokes.svg",
  leovegas: "/books/leovegas.png",
  polymarket: "/books/polymarket.svg",
};

/** The logo file for a book as the feed names it ("bet365", "Ladbrokes", "smarkets"...), if we hold one. */
export const bookLogo = (source: string): string | undefined => BOOK_LOGOS[String(source).toLowerCase()];
