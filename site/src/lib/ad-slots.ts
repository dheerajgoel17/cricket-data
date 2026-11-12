/** Catalogue of banner slots: sizes and which paths mount them. Keep in sync with `ad_slots` seeds in supabase/migrations/20261112_manual_ads.sql and 20261112_ad_slots_props.sql. */

export type AdSlotId = "fancy_detail_top" | "stats_top" | "player_detail_top" | "props_list_top";

export type AdSlotDef = {
  id: AdSlotId;
  label: string;
  sizeNote: string;
  /** Path patterns this slot is mounted on (for the admin UI and docs). */
  paths: RegExp[];
};

export const AD_SLOTS: AdSlotDef[] = [
  {
    id: "fancy_detail_top",
    label: "Match Fancy detail top strip",
    sizeNote: "Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).",
    paths: [/^\/fixture\/[^/]+\/fancy\/?$/],
  },
  {
    id: "player_detail_top",
    label: "Player prop detail top strip",
    sizeNote: "Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).",
    paths: [/^\/player\/[^/]+\/?$/],
  },
  {
    id: "props_list_top",
    label: "Player props list top strip",
    sizeNote: "Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).",
    paths: [/^\/props\/?$/],
  },
  {
    id: "stats_top",
    label: "Stats pages top strip",
    sizeNote: "Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).",
    paths: [
      /^\/leagues?(\/|$)/,
      /^\/competitions$/,
      /^\/teams?(\/|$)/,
      /^\/venue\//,
      /^\/players$/,
      /^\/glossary$/,
      /^\/about$/,
    ],
  },
];

export const adSlotById = (id: string) => AD_SLOTS.find((s) => s.id === id);

/** Which catalogue slot a path should mount (if any). */
export function slotForPath(pathname: string): AdSlotId | null {
  for (const s of AD_SLOTS) if (s.paths.some((r) => r.test(pathname))) return s.id;
  return null;
}

export const CREATIVE_BUCKET = "ad-creatives";
export const CREATIVE_MAX_BYTES = 2_097_152;
export const CREATIVE_MIME = ["image/gif", "image/png", "image/webp", "image/jpeg"] as const;
