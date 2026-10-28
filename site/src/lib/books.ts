/**
 * Official bookmaker logos: the brand's own file (a white version, for the dark site) in site/public/books, copied unchanged and never redrawn.
 * A book with no file here shows a name chip: add its file and one line below when the brand publishes one.
 */
export const BOOK_LOGOS: Record<string, string> = {
  polymarket: "/books/polymarket.svg",
};

/** The logo file for a book as the feed names it ("bet365", "Ladbrokes", "smarkets"...), if we hold one. */
export const bookLogo = (source: string): string | undefined => BOOK_LOGOS[String(source).toLowerCase()];
