import { control, HEADER_HEIGHT, radius, space, tint, type } from "./tokens";

describe("tokens derived from tokens.json", () => {
  it("matches the site's compact scale (16 px rem)", () => {
    expect(space).toEqual({ hair: 4, tight: 6, snug: 10, stack: 16, group: 20, section: 32, inset: 14, gutter: 14 });
    expect(radius).toEqual({ card: 16, chip: 999, sheet: 24 });
    expect(control).toBe(36);
    expect(HEADER_HEIGHT).toBe(56);
    expect(type.body.fontSize).toBe(15);
    expect(type.display.fontSize).toBe(28);
    expect(type.footnote.fontSize).toBe(12);
  });

  it("exposes tint helpers from color tokens", () => {
    expect(tint.primary(0.2)).toBe("rgba(39,218,142,0.2)");
    expect(tint.miss(0.45)).toBe("rgba(255,0,0,0.45)");
    expect(tint.amber(0.25)).toBe("rgba(245,165,36,0.25)");
  });
});
