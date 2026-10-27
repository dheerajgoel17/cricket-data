# StatsHub sitemap -> cricket (what we copied, what we changed)

Inspected `statshub.com/sitemap.xml` (static pages, blog, leagues ~900, teams ~4.7k, players ~94k, fixtures ~9.5k) and each page type.
Their app pages are client-rendered over a first-party API (`/api/props/screener`, `/api/tournament/upcoming-fixtures-multi`);
odds are served from their own backend (bookmaker logos, plus a "Sportsbook Odds API" they sell), so there is no public odds source to copy.

| StatsHub page | What it is | Our page | Notes |
|---|---|---|---|
| `/` Fixtures | date tabs with counts, league strip, competition cards, side rail | `/` (landing hero + fixtures + side rail) | cards group by series; filter pills by format/gender |
| `/fixture/<slug>/<id>` | match page: player x last-fixtures grid, next-match countdown | `/fixture/<date-teams>` | **Player grid** for both teams, **Trends**, **Team markets**, countdown |
| `/player/<slug>/<id>` | hero, next match, Game logs / Table / Charts, stat tabs, line + games steppers, hit rate, odds, traits, season table | `/player/<idx>` | Charts tab (line/games steppers, L5-L50, DNP, balls line), Game logs, Table & splits, correlated props. No minutes, traits radar or season table yet |
| `/team/<slug>/<id>` | hero, next match, overview list/grid, charts, results table | `/team/<idx>` | Player grid, Markets, Top batter, next-match card, About text |
| `/league/<slug>/<id>` | competition page (standings, stats) | `/league/<event idx>` | Markets, Teams (W/L), Results. Standings need points rules per tournament: not built |
| `/player-trends` | cards of players clearing a line, with per-game strip | `/trends` | pick an upcoming fixture, stat, line, min hit rate |
| `/prophunter`, `/prop-screener` | find players clearing a line, then check the price | `/props` (Prop Hunter) + `/trends` | price comes from our value-bets output, not a bookmaker feed |
| `/team-screener`, `/team-stats`, `/player-stats` | landing + screeners | `/teams`, `/players`, `/tools` | |
| `/referees` | referee card stats | not built | Base has officials; umpire/referee markets are rare for cricket |
| `/odds-converter` | fractional/decimal/American converter | `/odds` | **decimal only** (house rule): implied probability, margin removal, EV, Kelly |
| `/stats-explained` | glossary with category/difficulty filters | `/glossary` | markets, void rules, DNP, hit rate, fair odds |
| `/free-tools`, `/features` | tools hub | `/tools` (and `/features`) | |
| `/free-bets` | affiliate offers | not built | we run no affiliate links |
| `/betting-academy/*` | blog | not built | could reuse the glossary as articles |
| `/saved`, login | favourites | `/saved` (stars, browser-only) | no accounts |
| footer | tools, popular leagues, resources, responsible gambling | footer with the same three columns | |

## Routing and SEO
The app routes on the URL hash internally, and also accepts path URLs (`/player/123`): `vercel.json` rewrites unknown paths to `index.html`
and the app maps the path onto its route. The builder writes `sitemap.xml` and `robots.txt` (top ~3,000 players, 800 teams, 400 competitions,
tool pages) when `--site-url` is given; CI passes the repository variable `SITE_URL`. Pages are client-rendered with per-route titles; for
real search-engine indexing a server-rendered or pre-rendered variant would be the next step.

## Not copied, on purpose
Paid odds-feed product, affiliate pages, login/paywall, bookmaker logos, and any branding or imagery.
