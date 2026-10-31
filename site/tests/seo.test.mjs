import test from "node:test";
import assert from "node:assert/strict";
import { headTags, pages, render } from "../scripts/seo.mjs";
import { ROUTES, UNLISTED, fullTitle, pageMeta, clipDesc, shareMetas, THEME, CARD_W, CARD_H } from "../src/lib/seo.js";

const TPL = "<html><head><!--seo-head--></head><body><div id=\"root\"><!--seo-body--></div></body></html>";
const fx = [{ id: "2026-10-29-afghanistan-v-zimbabwe", a: "Afghanistan", b: "Zimbabwe", start: "2026-10-29T14:30Z", venue: "Sharjah Cricket Stadium, Sharjah", status: "Upcoming" }];
const index = { players: { nm: ["A Name", "Harry Brook"] }, teams: [{ n: "India", g: 0 }, { n: "India", g: 1 }], events: ["Global T20 Canada 2026"], venues: ["Sharjah Cricket Stadium, Sharjah"] };
const SITE = "https://fancy.cash";

test("titles carry the brand once, and a page that names itself gets a description built from the name", () => {
  assert.equal(fullTitle("About"), "About | Fancy.cash");
  assert.equal(fullTitle("Fancy.cash: free cricket"), "Fancy.cash: free cricket");
  assert.match(pageMeta("/player/1", "Harry Brook: stats, hit rates and form | Fancy.cash").description, /^Harry Brook: hit rates over any line, recent form and listed lines/);
  assert.equal(pageMeta("/about", "x").description, ROUTES.about.description);
  assert.equal(pageMeta("/privacy-policy", "x").description, UNLISTED["privacy-policy"].description);
  assert.equal(pageMeta("/privacy-policy").noindex, true);
  assert.equal(pageMeta("/terms-of-use").noindex, true);
  assert.equal(pageMeta("/docs").noindex, true);
  assert.equal(pageMeta("/privacy").noindex, true);
  assert.equal(pageMeta("/saved", "Saved").noindex, true);
});

test("share tags cover Facebook, X, LinkedIn, WhatsApp, Discord and Slack: image size, alt, large-card, theme colour", () => {
  assert.equal(CARD_W, 1200);
  assert.equal(CARD_H, 630);
  assert.equal(THEME, "#27da8e");
  assert.ok(clipDesc("a".repeat(50)).length === 50);
  assert.ok(clipDesc("word ".repeat(80)).length <= 180);
  const tags = shareMetas({ title: "Harry Brook: runs over 24.5 at 1.90 | Fancy.cash", description: "Harry Brook (England), runs over 24.5, listed 1.90 at Smarkets in England vs India. Hit rates and form on Fancy.cash.", url: "https://fancy.cash/share/player/0/runs/24.5", image: "https://fancy.cash/card/v7/player/0/runs/24.5.jpg", alt: "Harry Brook: runs over 24.5 at 1.90" });
  const get = (k) => tags.find((t) => t[1] === k)?.[2];
  assert.equal(get("og:image:width"), "1200");
  assert.equal(get("og:image:height"), "630");
  assert.equal(get("og:image:type"), "image/jpeg");
  assert.equal(get("og:image:alt"), "Harry Brook: runs over 24.5 at 1.90");
  assert.equal(get("twitter:card"), "summary_large_image");
  assert.equal(get("twitter:image"), get("og:image"));
  assert.equal(get("theme-color"), THEME);
  assert.ok(get("og:description").length <= 180);
});

test("every page gets its own title, description, canonical link and structured data", () => {
  const list = pages({ site: SITE, index, fixtures: fx, sitemap: ["/", "/player/1", "/team/1", "/league/0", "/player/9", "/venue/0"] });
  const by = Object.fromEntries(list);
  const f = render(TPL, by["fixture/2026-10-29-afghanistan-v-zimbabwe"]);
  assert.match(f, /<title>Afghanistan v Zimbabwe: stats, props and listed lines \| Fancy.cash<\/title>/);
  assert.match(f, /og:url" content="https:\/\/fancy.cash\/share\/fixture\/2026-10-29-afghanistan-v-zimbabwe"/);
  assert.match(f, /og:image:type" content="image\/jpeg"/);
  assert.match(f, /rel="canonical" href="https:\/\/fancy.cash\/fixture\/2026-10-29-afghanistan-v-zimbabwe"/);
  assert.match(f, /"@type":"SportsEvent"/);
  assert.match(f, /Sharjah Cricket Stadium/);
  assert.match(f, /<h1>Afghanistan v Zimbabwe/);
  assert.match(render(TPL, by["player/1"]), /<title>Harry Brook: stats, hit rates and form/);
  assert.match(render(TPL, by["team/1"]), /India Women: stats and player grid/); // the women's side keeps its name
  assert.ok(by["league/0"] && !by["player/9"]); // a player the data does not know gets no page
  assert.match(render(TPL, by["venue/0"]), /<title>Sharjah Cricket Stadium, Sharjah: ground stats/);
  assert.match(render(TPL, by.saved), /noindex, follow/);
  assert.ok(!by.privacy && !by["privacy-policy"] && !by.docs && !by["terms-of-use"]);
  assert.doesNotMatch(render(TPL, by[""]), /href="\/privacy|href="\/docs|href="\/terms/);
});

test("the home page has no canonical link (the app shell also serves unknown paths) but has the site data", () => {
  const home = render(TPL, Object.fromEntries(pages({ site: SITE, index, fixtures: [], sitemap: [] }))[""]);
  assert.doesNotMatch(home, /rel="canonical"/);
  assert.match(home, /"@type":"WebSite"/);
  assert.match(home, /og:image" content="https:\/\/fancy.cash\/og.png"/);
});

test("markup in a name cannot break out of the tags, and a template without the markers is an error", () => {
  const t = headTags({ title: 'Bad "name" <script>', description: "d <b>", jsonld: [{ n: "</script><script>alert(1)" }] });
  assert.doesNotMatch(t, /<script>alert|<b>|"name" </);
  assert.throws(() => render("<html></html>", { title: "x", description: "y" }), /seo markers/);
});

test("wrapped fixtures.json is unwrapped for SEO, and a wrap with no key does not crash the Vercel build", async () => {
  const { build, unwrapJson } = await import("../scripts/seo.mjs");
  const { wrap } = await import("../src/engine/wrap.js");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = mkdtempSync(join(tmpdir(), "seo-wrap-"));
  mkdirSync(join(d, "data"));
  writeFileSync(join(d, "index.html"), TPL);
  const wrapped = await wrap(fx, "ci-test-key");
  writeFileSync(join(d, "data/fixtures.json"), JSON.stringify(wrapped));
  writeFileSync(join(d, "data/index.json"), JSON.stringify(index));
  assert.deepEqual(unwrapJson(wrapped, "ci-test-key"), fx);
  const n = build(d, SITE, "ci-test-key");
  assert.ok(n > Object.keys(ROUTES).length, "fixture pages are written after unwrap");
  const d2 = mkdtempSync(join(tmpdir(), "seo-wrap2-"));
  mkdirSync(join(d2, "data"));
  writeFileSync(join(d2, "index.html"), TPL);
  writeFileSync(join(d2, "data/fixtures.json"), JSON.stringify(wrapped));
  writeFileSync(join(d2, "data/index.json"), JSON.stringify(index));
  assert.equal(build(d2, SITE, ""), Object.keys(ROUTES).length, "no key: skip wrapped fixtures rather than throw");
});

test("the site address is SITE_URL, else the one in the sitemap the data build wrote", async () => {
  const { siteOf } = await import("../scripts/seo.mjs");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = mkdtempSync(join(tmpdir(), "seo-"));
  assert.equal(siteOf(d, ""), "");
  writeFileSync(join(d, "sitemap.xml"), '<urlset><url><loc>https://fancy.cash/</loc></url><url><loc>https://fancy.cash/players</loc></url></urlset>');
  assert.equal(siteOf(d, ""), "https://fancy.cash");
  assert.equal(siteOf(d, "https://other.test/"), "https://other.test");
});
