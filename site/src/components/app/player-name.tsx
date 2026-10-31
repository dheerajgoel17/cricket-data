import { useDataMaybe } from "@/lib/data";

/**
 * A player's name. Our data names players by initials and surname ("P Rathnayake"); the source lists the full name. With room to spare (`always`, or from the
 * md breakpoint up) the full name is shown, on a phone row the short one. Without a full name (not linked, or the names file is not built yet) the short one
 * always shows. `fallback` is the name to use when the data holds only an id (a book's own spelling).
 */
export function PlayerName({ idx, always, fallback }: { idx: number; always?: boolean; fallback?: string }) {
  const d = useDataMaybe();
  const raw = d?.store?.playerName?.(idx) ?? fallback ?? "";
  const short = /^[0-9a-f]{8}$/.test(raw) ? fallback || raw : raw;
  const full = d?.names?.[d.store?.P?.id?.[idx]];
  if (!full || full === short) return <>{short}</>;
  return always ? <>{full}</> : <><span className="md:hidden">{short}</span><span className="hidden md:inline" title={short}>{full}</span></>;
}
