/** Copy when Fancy Over and Under are not one shared book/line (player props usually are). */
export function fancySplitNote(overLine?: number | null, underLine?: number | null, overBook?: string | null, underBook?: string | null) {
  if (overLine != null && underLine != null && overLine !== underLine) return "Fancy books often list Over and Under on different lines.";
  if (overBook && underBook && overBook !== underBook) return "Best Over and Under come from different books.";
  return null;
}
