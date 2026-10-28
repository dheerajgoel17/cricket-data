// What a page tells search engines and link previews: one place for the browser (`lib/title.ts`) and the build step (`scripts/seo.mjs`). Plain ESM, no DOM.
export const BRAND = "Fancy.cash";
export const TAGLINE = "Free cricket player props, hit rates and fair prices";
export const DEFAULT_DESC = "Free cricket player props: hit rates over any line, fair decimal prices, every bookmaker's line side by side, partnerships and fancy markets. Built on open ball-by-ball data.";

/** Pages with a fixed title and description, by their first path segment ("" is the home page). `noindex` pages are kept out of search results. */
export const ROUTES = {
  "": { title: `${BRAND}: ${TAGLINE.toLowerCase()}`, description: DEFAULT_DESC },
  players: { title: "Cricket player stats and prop hit rates", description: "Search any cricketer: runs, wickets, sixes and fours hit rates over every line, recent form and bookmaker prop prices." },
  teams: { title: "Cricket teams and venues", description: "Team and ground stats: how many runs, sixes and fours fall at each venue, with team form and the player grid." },
  competitions: { title: "Cricket competitions and leagues", description: "Every league and series in the data: team tables, match totals, sixes, fours and top scores." },
  trends: { title: "Cricket player trends", description: "Players on a run: hit rates and form for today's matches, line by line." },
  tools: { title: "Free cricket betting tools", description: "Price calculator, partnerships, head-to-head and head-to-head for cricket stats. Free, no sign-up." },
  odds: { title: "Odds and price calculator", description: "Convert decimal odds, remove the margin and find the fair price for any cricket market." },
  glossary: { title: "Cricket stats and betting terms explained", description: "Hit rate, fair price, edge, fancy lines, void rules and the other terms used on the site, in plain words." },
  about: { title: "Rules, data and how it works", description: "Where the numbers come from, how void and settlement rules work, and what the site does not do." },
  pair: { title: "Batting partnerships", description: "Who is dismissed first, how big the stands are and how a pair does by format, opposition and venue." },
  saved: { title: "Saved", description: DEFAULT_DESC, noindex: true },
};

export const fullTitle = (t) => (!t ? BRAND : String(t).includes(BRAND) ? String(t) : `${t} | ${BRAND}`);

/**
 * The description and robots hint of a path. A page names itself (`pageTitle`); a page with a name of its own (a player, a match, a team) gets a description built from it.
 */
export function pageMeta(pathname, pageTitle = "") {
  const seg = String(pathname || "/").split("/").filter(Boolean)[0] || "";
  const fixed = ROUTES[seg];
  const name = String(pageTitle || "").split(" | ")[0].split(": ")[0].trim(); // "Harry Brook: stats, hit rates and form | Fancy.cash" -> "Harry Brook"
  if (fixed && !/\//.test(String(pathname || "/").replace(/^\/+|\/+$/g, ""))) return { description: fixed.description, noindex: !!fixed.noindex };
  const by = { player: "hit rates over any line, recent form and every bookmaker's prop price", fixture: "player props, hit rates, fair prices and every bookmaker's line", team: "form, venue record and the player grid", venue: "runs, sixes and fours at the ground", league: "team tables, match totals and top scores" };
  return { description: `${name || BRAND}: ${by[seg] || "stats, hit rates and fair prices"}. Free on ${BRAND}.`, noindex: false };
}
