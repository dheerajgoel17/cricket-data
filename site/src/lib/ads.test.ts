import { describe, expect, it } from "vitest";
import { adsAllowed } from "./ads";
import { slotForPath, AD_SLOTS } from "./ad-slots";

describe("adsAllowed / slotForPath", () => {
  it("maps Match Fancy, player, props and stats pages to catalogue slots", () => {
    expect(slotForPath("/fixture/2026-11-08-a-v-b/fancy")).toBe("fancy_detail_top");
    expect(adsAllowed("/fixture/2026-11-08-a-v-b/fancy")).toBe(true);
    expect(slotForPath("/player/42")).toBe("player_detail_top");
    expect(adsAllowed("/player/42")).toBe(true);
    expect(slotForPath("/props")).toBe("props_list_top");
    expect(adsAllowed("/props")).toBe(true);
    for (const p of ["/leagues", "/league/abc", "/competitions", "/teams", "/team/x", "/venue/y", "/players", "/glossary", "/about"]) {
      expect(slotForPath(p)).toBe("stats_top");
      expect(adsAllowed(p)).toBe(true);
    }
  });
  it("keeps home, fixture overview and tools off the catalogue", () => {
    for (const p of ["/", "/fancy", "/fixture/2026-11-08-a-v-b", "/trends", "/odds", "/tools", "/pair", "/saved", "/privacy-policy", "/admin/ads"]) {
      expect(slotForPath(p)).toBeNull();
      expect(adsAllowed(p)).toBe(false);
    }
  });
  it("catalogue has the four v1 slots", () => {
    expect(AD_SLOTS.map((s) => s.id).sort()).toEqual(["fancy_detail_top", "player_detail_top", "props_list_top", "stats_top"]);
  });
});
