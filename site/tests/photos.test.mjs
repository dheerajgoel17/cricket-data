process.env.VITE_IMG_CDN = "https://img.test";
import test from "node:test";
import assert from "node:assert/strict";
import { leagueLogos, playerPhoto, playerPhotos, teamLogos, teamLogo, fold } from "@cricket/engine/photos.js";

const photos = { p: { "4ae1755b": "c:1IG", "bad0cafe": "w:Jos buttler.JPG" }, t: { india: "O", "west indies": "V", "mumbai indians": "F" } };

test("player photos: the source first, Commons fallback, none otherwise", () => {
  assert.equal(playerPhoto(photos, "4ae1755b"), "https://img.test/players/org/1IG.png");
  assert.match(playerPhoto(photos, "bad0cafe"), /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/Jos%20buttler\.JPG\?width=240$/);
  assert.equal(playerPhoto(photos, "nope"), null);
  assert.equal(playerPhoto(null, "4ae1755b"), null);
});

test("team logos resolve display names, including women's sides, flag-less teams and clubs", () => {
  assert.equal(teamLogo(photos, "West Indies"), "https://img.test/Teams/V.png");
  assert.equal(teamLogo(photos, "India (W)"), "https://img.test/Teams/O.png");
  assert.equal(teamLogo(photos, "Mumbai Indians"), "https://img.test/Teams/F.png");
  assert.equal(teamLogo(photos, "Nowhere XI"), null);
  assert.equal(fold("Côte d'Ivoire"), "cote d ivoire");
});

test("our own copy (Supabase Storage) is tried first once we hold it, the source stays as the fallback", () => {
  const own = { ...photos, base: "https://store.example/storage/v1/object/public/avatars", s: { p: ["1IG"], t: ["V"] } };
  assert.deepEqual(playerPhotos(own, "4ae1755b"), ["https://store.example/storage/v1/object/public/avatars/players/1IG.png", "https://img.test/players/org/1IG.png"]);
  assert.deepEqual(teamLogos(own, "West Indies"), ["https://store.example/storage/v1/object/public/avatars/teams/V.png", "https://img.test/Teams/V.png"]);
  assert.deepEqual(teamLogos(own, "India"), ["https://img.test/Teams/O.png"]); // not copied yet
});

test("league logos are looked up by the event's folded name, the newest season's file, the source first and our own copy once we hold it", () => {
  const lg = { ...photos, l: { "indian premier league": "1PW", "women s big bash league": "2KG" } };
  assert.deepEqual(leagueLogos(lg, "Indian Premier League"), ["https://img.test/Series/1PW.png"]);
  assert.deepEqual(leagueLogos(lg, "Women's Big Bash League"), ["https://img.test/Series/2KG.png"]);
  assert.deepEqual(leagueLogos(lg, "Some Local Cup"), []);
  assert.deepEqual(leagueLogos(photos, "Indian Premier League"), [], "a photos file from before leagues were added");
  const own = { ...lg, base: "https://store.example/storage/v1/object/public/avatars", s: { l: ["1PW"] } };
  assert.deepEqual(leagueLogos(own, "Indian Premier League"), ["https://store.example/storage/v1/object/public/avatars/leagues/1PW.png", "https://img.test/Series/1PW.png"]);
});
