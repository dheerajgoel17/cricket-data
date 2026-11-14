import { isHexPlayerId, resolvePlayerLabel } from "@cricket/engine/player-label.js";
import { useDataMaybe } from "@/lib/data";

export { isHexPlayerId, resolvePlayerLabel };

/**
 * A player's name. Our data names players by initials and surname ("P Rathnayake"); the source lists the full name. With room to spare (`always`, or from the
 * md breakpoint up) the full name is shown, on a phone row the short one. Without a full name (not linked, or the names file is not built yet) the short one
 * always shows. `fallback` is the name to use when the data holds only an id (a book's own spelling).
 */
export function PlayerName({ idx, always, fallback }: { idx: number; always?: boolean; fallback?: string }) {
  const d = useDataMaybe();
  const pid = d?.store?.P?.id?.[idx];
  const raw = d?.store?.playerName?.(idx) ?? fallback ?? "";
  const full = (pid && d?.names?.[pid]) || undefined;
  const short = resolvePlayerLabel(raw, { bookName: fallback, catalogName: full });
  // Prefer the source full name in roomy headers even when short already resolved from the catalog.
  if (full && always) return <>{full}</>;
  if (!full || full === short) return <>{short}</>;
  return <><span className="md:hidden">{short}</span><span className="hidden md:inline" title={short}>{full}</span></>;
}
