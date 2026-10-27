# Cricket Props Hub: the free stats site (`site/`)

A free player-props and fancy-markets stats site built on this repo's data. Static pages plus one small serverless function,
hosted on **Vercel Hobby**. Nothing paid, no database, no model hosting.

## What it does
| Page | What you get |
|---|---|
| Home / **Ask** | Type a question in your own words (typos fine). A free Gemini model turns it into a *query plan*; the site runs that plan on the real data and shows the answer, the filters used, the sample size and the data freshness. |
| **Fixtures** | Upcoming internationals/leagues from `data/fixtures/upcoming.csv` only. The bookmaker feed is for odds, never for fixtures or start times (books serve different regions). |
| **Players** | Runs, balls, 4s, 6s, wickets, runs conceded. Hit rate over/under any line, a ladder of lines, median/mean, last-N form, fair decimal odds, split by opposition, venue, home/away/neutral, batting first/chasing, batting position, year and competition. One format at a time, never mixed. |
| **Teams & venues** | Match totals and fancy markets: match 4s/6s, 30s, 50s, 100s, double-digit and single-digit scores, ducks, highest over, most runs conceded by a bowler, top score, team markets (team batting first only), and who tops the batting card. |
| **Partnerships** | For any two batters: who is dismissed first, stand sizes, split by format, opposition and venue; opening pair only if you like. |
| **Prop Hunter** | The best-value props for upcoming matches from `value_bets/out/value_bets_latest.json`, read live from GitHub (falls back to the snapshot built into the site). |

See [SITE_MAP.md](SITE_MAP.md) for the page-by-page comparison with StatsHub.

## How the numbers are produced
```
Cricsheet all_json.zip ─┐
data/provisional/*.json ─┼─► python -m cricket_site.build ─► site/public/data/*.json ─► browser engine (site/src/engine)
data/fixtures, value_bets ┘                                                              ▲
                                                question ─► /api/ask (Gemini) ─► plan ───┘  (validated, then run on the rows)
```
* **Builder** (`src/cricket_site`, stdlib only): parses the ball-by-ball JSON into per-innings batting rows (position, innings order,
  runs/balls/4s/6s, dismissal), bowling spells, partnerships (who was out, runs, balls, opening flag) and match-market aggregates.
  Provisional (scraped) matches are added as player-total rows when Cricsheet does not have the fixture yet (same dedupe as
  `cricket-data query`: same teams, +/-1 day) and only when `link-players` gave the player a Cricsheet id.
  Output is ~35 MB of JSON (~12 MB compressed): `meta.json`, `index.json`, `matches.json`, 64 player shards `p/NN.json`, `fixtures.json`, `props.json`.
  I checked ~71,000 player rows against `data/players`: every difference was a super-over (the site ignores super overs on purpose).
* **Engine** (`site/src/engine`, no dependencies, runs in the browser and in node): filters, hit rates, fair odds, markets, partnerships,
  name resolution with typo tolerance, and the plan runner. **Every number on a page is computed here from the rows.**
* **The model never supplies a number.** `/api/ask` (`site/api/ask.js`) sends only the question text to Gemini with a fixed instruction and gets
  back JSON, which `sanitizePlan` reduces to whitelisted fields. The plan is then resolved against the real player/team/venue tables and executed
  in the browser. If the key is missing, rate-limited or the reply is unusable, the built-in rule parser (`engine/nl.js`) answers instead.

## Settlement rules and definitions
* T20 summary markets are void unless both innings reach 80% of the scheduled balls (96 of 120); ODI likewise (240 of 300); The Hundred 80 of 100.
  Tests: void unless there is a result, or 300 overs (5-day) / 200 overs (4-day) were bowled. Void matches are left out of match/team markets.
* 30s = 30-49, 50s = 50-99, 100s = 100+, double-digit = 10+, single-digit = 1-9 (ducks excluded). Team markets count only the team batting first.
* Retired hurt is not a wicket. Penalty runs count. Runs conceded = batter runs + wides + no-balls + penalty (as in `data/players`). Super overs are ignored.
* Formats: T20 = T20 + T20I, ODI = ODI + domestic List A, Test = Tests only, **The Hundred is its own format**. First-class (`MDM`) is not included.
* Fair decimal odds = 1 / hit rate on the filtered sample (pushes on whole-number lines are void). Decimal odds only.
* Home/away/neutral is *inferred*, because Cricsheet has no home flag: the event ("X tour of Y"), the venue's tour history, its country in
  `value_bets/mappings/venue_geo.csv`, then the team that plays at least half of the venue's internationals. Unknown hosts are left out of home/away filters.

## Player screen (app-style UI)
The player page (`/player/<idx>`) is `site/src/pages/Player.tsx`: a sticky app bar on phones, a prop rail (stat), a hero (photo, name, round buttons, a 3x2 stat grid and a hit-rate ring), a format switch, one tappable bar chart with Over/Under, a line stepper and look-back pills that show each window's hit rate (`engine/windows.js`, unit-tested by hand-computed numbers), a bottom sheet for filters and for a tapped game, and Lines / Game log / Splits tabs. The chart keeps the line and side in the URL with `replaceState`, so a page can be shared. UI library: shadcn/ui (Radix) with Motion for animation; see PROJECT_GUIDE 5.3.

**Bookmaker lines.** The value-bets pipeline saves every matched two-sided player line (runs, sixes, fours, wickets; decimal over/under per book) to `value_bets/out/book_lines.json` (`src/value_bets/booklines.py`, matched to Cricsheet player ids). The site builder bundles it as `data/lines.json`, and the player page reads the live file from GitHub (falling back to the bundle). For a player with a priced upcoming match, the chart opens on the market's **main line** (the one priced closest to evens, `engine/lines.js`) instead of the median-based default, and a "Bookmaker lines" card shows each book's prices, the no-margin market probability and his own hit rate over each line; tap a line to put it on the chart. Players or stats with no market line keep the median default (floor(median) + 0.5, `suggestLines`).

## Known limits (be aware before betting)
* Provisional matches carry player totals only (no batting order, dismissals or fall of wickets), so they feed player props but **not**
  partnerships, batting position, innings order or match markets. The site says how many provisional rows a view includes.
* Fixtures only cover what the free schedule scrape and the odds sources list; men's domestic fixtures can be missing.
* Small samples are common: every answer shows `n` and a 90% interval for the hit rate. Fair odds have no margin and ignore form, pitch and XIs.

## Run it locally
```bash
pip install -e .
curl -fsSL -o all_json.zip https://cricsheet.org/downloads/all_json.zip
python -m cricket_site.build --zip all_json.zip --data data --out site/public/data     # ~30 s
cd site && npm ci && npm test          # engine + resolver + parser + API handler + components (node >= 20)
npm run dev                            # http://localhost:4173  (set GEMINI_API_KEY to try the AI parse)
```
Python tests: `pytest -q tests/site`. The JS tests run on a tiny synthetic dataset with hand-known numbers
(`tests/site/synth.py`, regenerated by `python scripts/make_site_fixture.py`; a pytest fails if the committed fixture is stale).

## Deploy (Vercel Hobby, free)
The Vercel project root is `site/` (static `public/` + `api/ask.js`; `site/vercel.json` already sets this).
1. **Once:** `cd site && npx vercel link --project cricket-props-hub` then, after building the data, `npx vercel deploy --prod`.
2. **AI key for the chat box.** Either **xAI Grok**: create a key at console.x.ai (API Keys), add it as the Vercel env var `XAI_API_KEY`, and set `XAI_MODEL` to a model name from the console's Models page (Grok API usage is billed per token, a few hundred tokens per question; check your credits). Or **Gemini (free tier):** create a key in Google AI Studio, then add it as the *Vercel* environment variable `GEMINI_API_KEY`
   (Project → Settings → Environment Variables, Production) and redeploy. Optional: `GEMINI_MODELS` (comma list, default
   `gemini-2.5-flash-lite,gemini-2.5-flash`; change it if Google retires a model), `ASK_PER_MINUTE` (default 12 per IP), `ASK_DAILY_CAP`
   (default 800 calls/day, under the free-tier limits). Without a key the site still answers with the built-in parser.
3. **Daily refresh:** `.github/workflows/site.yml` runs **every hour** (and after "Daily update", and on demand): the scraper commits new provisional matches every 30 minutes, so each run rebuilds
   `site/public/data` from the latest repo data and deploys. The Cricsheet zip, people register and player photos are cached once a day, so hourly runs stay light. Add three **GitHub repository secrets**: `VERCEL_TOKEN` (vercel.com/account/tokens),
   `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (both in `site/.vercel/project.json` after `vercel link`). Without them it builds and tests but does not deploy.
   PRs touching the site build and test only.
4. Prop Hunter reads `value_bets_latest.json` from GitHub at view time, so it stays hourly-fresh without any redeploy.

Never commit tokens or API keys: the key lives only in Vercel's environment, the deploy secrets only in GitHub secrets (`scripts/check_public_safe.py` runs in CI).

## Player photos and team logos
Sources, in order: **CREX** (the repo already scrapes it) then **Wikidata/Wikimedia Commons**, then a flag (national sides) or initials/silhouette.
The builder reads CREX's public sitemaps (`crex.com/crex_sitemap/player.xml`, `team.xml`: ~9.8k players, ~1k teams), matches CREX full names to Cricsheet
names conservatively (surname + first initial, ambiguous names skipped, see `src/cricket_site/crex_assets.py`) and stores only ids in `data/photos.json`.
The browser loads images from CREX's CDN (`cricketvectors.akamaized.net/players/org/<id>.png`, `/Teams/<id>.png`); nothing is copied into the repo.
About 54% of recently active players and most national and franchise teams get a CREX image today; the rest fall back. Those images belong to CREX:
check their terms before using the site commercially, or replace the source later by returning a different URL from `playerPhoto` in `site/src/lib/photos.js`.

## Our own copy of the images and id maps (Supabase, free plan)
So the site keeps working if CREX changes or removes its images, `src/cricket_site/assets_sync.py` copies each player photo / team logo once into a
public Supabase Storage bucket (`avatars`) and records it in Postgres (`assets`, `crex_players`, `crex_teams`; public read, writes only with the service key).
The Site workflow runs it hourly (resumable, at most `SYNC_LIMIT` new images per run, politely paced) and adds `base` + `s` (ids we hold) to `photos.json`;
the browser then tries our copy first and CREX second. Setup: repository variable `SUPABASE_URL` and secret `SUPABASE_SERVICE_KEY`
(dashboard -> Project Settings -> API Keys -> service role / secret key; never commit it). Without them the step is skipped and CREX is used directly.
Schema: see the `cricket_assets_schema` migration (tables above plus the `avatars` bucket: public, 200 KB limit, png/webp/jpeg only).

## UI libraries and the iOS / Android apps
The apps are planned natively (Expo / React Native), like props.cash, whose website is a plain React SPA with separate store apps. So the website and the apps share
**data and logic, not components**:
* `site/src/engine/*` (plain ESM, no DOM) and the JSON data files are the shared core. Keep every number and rule there; never import React or the DOM into the engine.
* Web UI uses free MIT components from the shadcn CLI and its registries (`@magicui`, `@kibo-ui`, `@originui`, `@animate-ui` are registered in `site/components.json`; add with `npx shadcn@latest add @kibo-ui/<name>`),
  not hand-built widgets. Check the install diff: the CLI can overwrite `ui/*` files and the `.dark` tokens in `index.css`.
* Prefer touch-first components: nothing that only works on hover (for example the Magic UI dock's magnification), targets of at least 44 px on phones, and `env(safe-area-inset-*)`
  for fixed bars (`viewport-fit=cover` is set in `site/index.html`, which iOS needs for the insets to be non-zero).
* The look is iOS-inspired: true black with system grays, translucent materials (blur), large titles, a segmented control, 17 px list rows with inset separators at every width (no data tables), a floating glass tab bar on phones and a translucent source-list sidebar on wide screens.

## Type and spacing scales (no hard-coded sizes)
Sizes are named by role and defined once, in `site/src/index.css` (`@theme`). Pages and shared components use the names, never `text-[13px]`, `text-sm`, `mt-5` or `gap-3`.
`site/src/lib/design-tokens.test.ts` fails the build if a governed file does; add a file to its `GOVERNED` list when its page is migrated (the old pages are not yet).

| Type | Size | Used for |
| --- | --- | --- |
| `text-display` | 32 to 36 px, fluid | page title (large title) |
| `text-title` | 22 px | section titles, sheet titles, key values |
| `text-body` | 17 px | names, row titles, primary text |
| `text-callout` | 15 px | secondary lines, chips and control labels |
| `text-footnote` | 13 px | meta and captions |
| `text-caption` | 11 px | micro labels (EDGE), small badges, tab labels |
| `text-metric` / `text-stat` | 26 / 40 px | timers and big numbers / hero statistic |

| Spacing | Size | Used for |
| --- | --- | --- |
| `hair` | 4 px | icon and text micro gaps |
| `tight` | 8 px | inside a component, chip rows |
| `snug` | 12 px | between controls in a row, list-row padding |
| `stack` | 20 px | between stacked blocks |
| `group` | 28 px | between groups inside a section |
| `section` | 44 px | between page sections |
| `inset` | 20 px | padding inside cards and panels |
| `gutter` | 16 px, 24 px from md | page side padding; list rows use it so photos line up with the page edge |

Type is in rem, so it follows the browser's font-size setting. One `cn()` (`site/src/lib/utils.ts`) merges classes for the whole app, including shadcn's `ui/*` (they import it as `cn`; see the alias in `vite.config.ts` and `tsconfig.json`); it knows these scales, so `text-body` replaces a component's own `text-sm` instead of fighting it.

