/**
 * Bookmaker logos, in site/public/books: the brand's mark as supplied, cropped to the mark or scaled down and never redrawn. A book with no file shows a name chip.
 * The list of books is data: add the file and one entry to public/books/books.json (stem, display name, file name). The site and the apps fetch it at run time
 * (`loadBookManifest`), so an app installed before the book existed shows its logo too. The site is dark, so a white or reversed version is best.
 */
import { BOOK_STEMS, bookLogoFile, bookLogoStem, bookVariant, setBookManifest } from "@cricket/engine/books.js";

export { bookVariant };

/** The built-in books' logo addresses (the fallback before the manifest arrives; use `bookLogo` for any book). */
export const BOOK_LOGOS: Record<string, string> = Object.fromEntries(Object.keys(BOOK_STEMS).map((stem) => [stem, `/books/${bookLogoFile(stem)}`]));

/** The logo file for a book as the feed names it ("bet365", "Ladbrokes", "FairWin247 Premium", "moviodds_bet365"...), if we hold one. */
export const bookLogo = (source: string): string | undefined => {
  const stem = bookLogoStem(source);
  const file = bookLogoFile(stem);
  return file ? `/books/${file}` : undefined;
};

let loaded: Promise<void> | null = null;
/** Fetch books.json once and merge it into the engine's table (badges re-render through `subscribeBooks`). `base` is "" on the web and the site address in the apps. A failure keeps the built-in table. */
export function loadBookManifest(base = ""): Promise<void> {
  loaded ??= fetch(`${base}/books/books.json`).then((r) => (r.ok ? r.json() : null)).then((m) => { setBookManifest(m); }).catch(() => { loaded = null; });
  return loaded;
}
