/** The link to share for a player or one of his props: a /share path, which link previews read as a card (photo, name, line, listed price) and people are sent on to the real page. */
export function sharePlayerUrl(origin: string, idx: number, stat?: string | null, line?: number | null): string {
  const base = `${origin.replace(/\/+$/, "")}/share/player/${idx}`;
  return stat && line != null && Number.isFinite(line) ? `${base}/${encodeURIComponent(stat)}/${line}` : base;
}
export const shareFixtureUrl = (origin: string, id: string) => `${origin.replace(/\/+$/, "")}/share/fixture/${encodeURIComponent(id)}`;
export const shareVenueUrl = (origin: string, idx: number) => `${origin.replace(/\/+$/, "")}/share/venue/${idx}`;
