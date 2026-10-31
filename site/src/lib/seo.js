// What a page tells search engines and link previews: one place for the browser (`lib/title.ts`) and the build step (`scripts/seo.mjs`). Plain ESM, no DOM.
export const BRAND = "Fancy.cash";
export const TAGLINE = "Free cricket stats and data";
export const DEFAULT_DESC = "Free cricket stats and data: hit rates over any line, form, partnerships, fancy markets and ground stats from open ball-by-ball data. Listed prices are shown as market data, not as an invitation to bet.";
export const THEME = "#27da8e";
export const CARD_W = 1200;
export const CARD_H = 630; // 1.91:1 — Facebook, LinkedIn, WhatsApp, Discord, Slack, Telegram, iMessage. X's 2:1 large card crops ~15 px top and bottom.

/** Clip a description so Facebook (~155) and X (~200) do not truncate mid-word; Discord still has room. */
export function clipDesc(s, n = 180) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const i = cut.lastIndexOf(" ");
  return `${(i > 80 ? cut.slice(0, i) : cut).replace(/[.,;:–-]+$/, "")}…`;
}

/**
 * Tags every link-preview crawler reads (Facebook, Instagram, WhatsApp, Messenger, X, LinkedIn, Slack, Discord, Telegram, iMessage, Pinterest, Reddit, Teams).
 * `url` is the address the preview should stay on (the /share page for a player, fixture or ground). `image` is an absolute https JPEG 1200×630.
 * @returns {Array<["name"|"property", string, string]>}
 */
export function shareMetas({ title, description, url = "", image = "", alt = "" }) {
  const t = String(title || BRAND), d = clipDesc(description), a = String(alt || t);
  const jpeg = /\.jpe?g(\?|$)/i.test(image);
  const out = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", BRAND],
    ["property", "og:locale", "en"],
    ["property", "og:title", t],
    ["property", "og:description", d],
    url ? ["property", "og:url", url] : null,
    image ? ["property", "og:image", image] : null,
    image ? ["property", "og:image:secure_url", image] : null,
    image ? ["property", "og:image:type", jpeg ? "image/jpeg" : "image/png"] : null,
    image ? ["property", "og:image:width", String(CARD_W)] : null,
    image ? ["property", "og:image:height", String(CARD_H)] : null,
    image ? ["property", "og:image:alt", a] : null,
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", t],
    ["name", "twitter:description", d],
    image ? ["name", "twitter:image", image] : null,
    image ? ["name", "twitter:image:alt", a] : null,
    ["name", "theme-color", THEME],
  ].filter(Boolean);
  return out;
}

/** Pages with a fixed title and description, by their first path segment ("" is the home page). `noindex` pages are kept out of search results. */
export const ROUTES = {
  "": { title: `${BRAND}: ${TAGLINE.toLowerCase()}`, description: DEFAULT_DESC },
  players: { title: "Cricket player stats and prop hit rates", description: "Search any cricketer: runs, wickets, sixes and fours hit rates over every line, recent form and listed lines." },
  teams: { title: "Cricket teams and grounds", description: "Team and ground stats: how many runs, sixes and fours fall at each venue, with team form and the player grid." },
  competitions: { title: "Cricket competitions and leagues", description: "Every league and series in the data: team tables, match totals, sixes, fours and top scores." },
  trends: { title: "Cricket player trends", description: "Players on a run: hit rates and form for today's matches, line by line." },
  tools: { title: "Free cricket stats tools", description: "Price calculator, partnerships, player search and ground stats. Free, no sign-up." },
  odds: { title: "Odds and price calculator", description: "Convert decimal odds, remove the margin and find the fair price for any cricket market." },
  glossary: { title: "Cricket stats terms explained", description: "Hit rate, fair price, edge, fancy lines, void rules and the other terms used on the site, in plain words." },
  about: { title: "Rules, data and how it works", description: "Where the numbers come from, how void and settlement rules work, and what the site does not do." },
  pair: { title: "Batting partnerships", description: "Who is dismissed first, how big the stands are and how a pair does by format, opposition and venue." },
  saved: { title: "Saved", description: DEFAULT_DESC, noindex: true },
};

/** Typed URLs only (`/privacy-policy`, `/terms-of-use`, `/docs`). Not in ROUTES, so they are not prebuilt, listed in the sitemap, or linked from crawler nav. */
export const UNLISTED = {
  "privacy-policy": { title: "Privacy policy", description: "What Fancy.cash stores on your device, the functional cookies it uses, and the anonymous analytics it may collect." },
  "terms-of-use": { title: "Terms of use", description: "Rules for using Fancy.cash: a free cricket stats and data site. It does not offer, promote or encourage gambling." },
  docs: { title: "Docs", description: "Fancy.cash is cricket stats and data. Listed prices are market data next to history. We do not offer, promote or encourage gambling." },
};
const UNLISTED_ALIAS = { privacy: "privacy-policy", terms: "terms-of-use", disclaimer: "docs" };

export const fullTitle = (t) => (!t ? BRAND : String(t).includes(BRAND) ? String(t) : `${t} | ${BRAND}`);

/**
 * The description and robots hint of a path. A page names itself (`pageTitle`); a page with a name of its own (a player, a match, a team) gets a description built from it.
 */
export function pageMeta(pathname, pageTitle = "") {
  const seg = String(pathname || "/").split("/").filter(Boolean)[0] || "";
  const hidden = UNLISTED[UNLISTED_ALIAS[seg] || seg];
  const fixed = ROUTES[seg];
  const name = String(pageTitle || "").split(" | ")[0].split(": ")[0].trim(); // "Harry Brook: stats, hit rates and form | Fancy.cash" -> "Harry Brook"
  if (hidden && !/\//.test(String(pathname || "/").replace(/^\/+|\/+$/g, ""))) return { description: hidden.description, noindex: true };
  if (fixed && !/\//.test(String(pathname || "/").replace(/^\/+|\/+$/g, ""))) return { description: fixed.description, noindex: !!fixed.noindex };
  const by = { player: "hit rates over any line, recent form and listed lines", fixture: "player stats, hit rates and listed lines", team: "form, venue record and the player grid", venue: "ground stats, runs, sixes and fours", league: "team tables, match totals and top scores" };
  return { description: `${name || BRAND}: ${by[seg] || "stats, hit rates and fair prices"}. Free on ${BRAND}.`, noindex: false };
}
