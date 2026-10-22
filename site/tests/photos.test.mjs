import test from "node:test";
import assert from "node:assert/strict";
import { playerPhoto, teamLogo, fold } from "../public/js/photos.js";

const photos = { p: { 5: "c:1IG", 9: "w:Jos buttler.JPG" }, t: { india: "O", "west indies": "V", "mumbai indians": "F" } };

test("player photos: CREX first, Commons fallback, none otherwise", () => {
  assert.equal(playerPhoto(photos, 5), "https://cricketvectors.akamaized.net/players/org/1IG.png");
  assert.match(playerPhoto(photos, 9), /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/Jos%20buttler\.JPG\?width=240$/);
  assert.equal(playerPhoto(photos, 1), null);
  assert.equal(playerPhoto(null, 5), null);
});

test("team logos resolve display names, including women's sides, flag-less teams and clubs", () => {
  assert.equal(teamLogo(photos, "West Indies"), "https://cricketvectors.akamaized.net/Teams/V.png");
  assert.equal(teamLogo(photos, "India (W)"), "https://cricketvectors.akamaized.net/Teams/O.png");
  assert.equal(teamLogo(photos, "Mumbai Indians"), "https://cricketvectors.akamaized.net/Teams/F.png");
  assert.equal(teamLogo(photos, "Nowhere XI"), null);
  assert.equal(fold("Côte d'Ivoire"), "cote d ivoire");
});
