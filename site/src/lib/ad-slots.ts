/** Catalogue of banner slots: sizes and which paths mount them.
 * Keep in sync with `ad_slots` rows in Supabase when remounting.
 * Empty until placements are remapped — no path mounts ads. */

export type AdSlotId = string;

export type AdSlotDef = {
  id: AdSlotId;
  label: string;
  sizeNote: string;
  /** Path patterns this slot is mounted on (for the admin UI and docs). */
  paths: RegExp[];
};

/** No live mounts until a remapped catalogue is added. */
export const AD_SLOTS: AdSlotDef[] = [];

export const adSlotById = (id: string) => AD_SLOTS.find((s) => s.id === id);

/** Which catalogue slot a path should mount (if any). */
export function slotForPath(pathname: string): AdSlotId | null {
  for (const s of AD_SLOTS) if (s.paths.some((r) => r.test(pathname))) return s.id;
  return null;
}

export const CREATIVE_BUCKET = "ad-creatives";
export const CREATIVE_MAX_BYTES = 2_097_152;
export const CREATIVE_MIME = ["image/gif", "image/png", "image/webp", "image/jpeg"] as const;
