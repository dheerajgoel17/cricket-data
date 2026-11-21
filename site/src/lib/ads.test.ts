import { describe, expect, it } from "vitest";
import { adsAllowed } from "./ads";
import { slotForPath, AD_SLOTS } from "./ad-slots";

describe("adsAllowed / slotForPath", () => {
  it("has an empty catalogue until slots are remapped", () => {
    expect(AD_SLOTS).toEqual([]);
  });

  it("mounts nothing on former ad paths", () => {
    for (const p of [
      "/fixture/2026-11-08-a-v-b/fancy",
      "/player/42",
      "/props",
      "/leagues",
      "/league/1",
      "/competitions",
      "/teams",
      "/team/1",
      "/venue/1",
      "/players",
      "/glossary",
      "/about",
      "/",
      "/fancy",
      "/admin/ads",
    ]) {
      expect(slotForPath(p)).toBeNull();
      expect(adsAllowed(p)).toBe(false);
    }
  });
});
