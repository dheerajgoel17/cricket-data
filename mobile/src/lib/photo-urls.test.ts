import { faceUrls, leagueUrls, shirtUrls, teamUrls } from "./photo-urls";

describe("photo urls", () => {
  it("returns the same array for the same photos file and name (one answer per badge, not per render)", () => {
    const photos = {};
    expect(teamUrls(photos, "India", 40)).toBe(teamUrls(photos, "India", 40));
    expect(leagueUrls(photos, "IPL")).toBe(leagueUrls(photos, "IPL"));
    expect(faceUrls(photos, "p1")).toBe(faceUrls(photos, "p1"));
    expect(shirtUrls(photos, "India", false)).toBe(shirtUrls(photos, "India", false));
  });

  it("starts over when the photos file is replaced", () => {
    expect(teamUrls({}, "India", 40)).not.toBe(teamUrls({}, "India", 40));
  });

  it("falls back to a flag-size URL by size band and never throws on a missing file", () => {
    expect(() => teamUrls(undefined, "India", 40)).not.toThrow();
    expect(teamUrls(undefined, "India", 40)).not.toBe(teamUrls(undefined, "India", 64) as unknown);
  });
});
