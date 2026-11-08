import { describe, expect, it } from "vitest";
import { adsAllowed } from "./ads";

describe("adsAllowed", () => {
  it("allows stats pages", () => {
    for (const p of ["/leagues", "/league/abc", "/competitions", "/teams", "/team/x", "/venue/y", "/players", "/glossary", "/about"]) expect(adsAllowed(p)).toBe(true);
  });
  it("keeps ads off anything with prices, props or lines", () => {
    for (const p of ["/", "/props", "/fancy", "/fixture/2026-11-08-a-v-b", "/trends", "/odds", "/tools", "/player/abc", "/pair", "/saved", "/privacy-policy"]) expect(adsAllowed(p)).toBe(false);
  });
});
