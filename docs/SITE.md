# Cricket Props Hub: the free stats site (`site/`)

A free player-props and fancy-markets stats site built on this repo's data. Static pages plus two small serverless functions
(`/api/ask`, `/api/live`), hosted on **Vercel Hobby**. Nothing paid, no database, no model hosting.

## What it does
| Page | What you get |
|---|---|
| Home / **Ask** | Type a question in your own words (typos fine). A free Gemini model turns it into a *query plan*; the site runs that plan on the real data and shows the answer, the filters used, the sample size and the data freshness. |
| **Fixtures** | Upcoming internationals/leagues from `data/fixtures/upcoming.csv` only. The bookmaker feed is for odds, never for fixtures or start times (books serve different regions). Live scores (team totals, current batters/bowler, and player so-far vs booked lines) refresh about every 15 seconds from the Source A schedule, match and scorecard pages, **only for matches we have player-prop or fancy odds for**; they are never used to settle a prop. Props and Match Fancy tabs (and unpriced fancy markets) stay hidden when that match has no bookmaker line. |
| **Players** | Runs, balls, 4s, 6s, wickets, runs conceded. Hit rate over/under any line, a ladder of lines, median/mean, last-N form, fair decimal odds, split by opposition, venue, home/away/neutral, batting first/chasing, batting position, year and competition. One format at a time, never mixed. |
| **Teams & grounds** | Match totals and fancy markets: match 4s/6s, 30s, 50s, 100s, double-digit and single-digit scores, ducks, highest over, most runs conceded by a bowler, top score, team markets (team batting first only), and who tops the batting card. Ground pages show match counts by format and the next fixture at that venue. Search (⌘K and the venues list) matches grounds as well as players and teams. |
| **Partnerships** | For any two batters: who is dismissed first, stand sizes, split by format, opposition and venue; opening pair only if you like. |
| **Prop Hunter** | The best-value props for upcoming matches from `value_bets/out/value_bets_latest.json`, read live from GitHub (falls back to the snapshot built into the site). |

See [SITE_MAP.md](SITE_MAP.md) for the page-by-page comparison with StatsHub.

## How the numbers are produced
```
Base all_json.zip ─┐
data/provisional/*.json ─┼─► python -m cricket_site.build ─► site/public/data/*.json ─► browser engine (site/src/engine)
data/fixtures, value_bets ┘                                                              ▲
                                                question ─► /api/ask (Gemini) ─► plan ───┘  (validated, then run on the rows)
                                                Source A schedule + match + scorecard ─► /api/live (15 s cache) ─► fixture scores + live board + player so-far + each priced line settled (value, final, Cleared / Missed / Push, Not in XI)
```
* **Builder** (`src/cricket_site`, stdlib only): parses the ball-by-ball JSON into per-innings batting rows (position, innings order,
  runs/balls/4s/6s, dismissal), bowling spells, partnerships (who was out, runs, balls, opening flag) and match-market aggregates.
  Provisional (scraped) matches are added as player-total rows when Base does not have the fixture yet (same dedupe as
  `cricket-data query`: same teams, +/-1 day) and only when `link-players` gave the player a Base id.
  Output is ~35 MB of JSON (~12 MB compressed): `meta.json`, `index.json`, `matches.json`, 64 player shards `p/NN.json`, `fixtures.json`, `props.json`.
  I checked ~71,000 player rows against `data/players`: every difference was a super-over (the site ignores super overs on purpose).
* **Engine** (`site/src/engine`, no dependencies, runs in the browser and in node): filters, hit rates, fair odds, markets, partnerships,
  name resolution with typo tolerance, the plan runner, and live-score parsing (`live.js`). **Every number on a page is computed here from the rows
  or from the live snapshot** — never from the LLM.
* **The model never supplies a number.** `/api/ask` (`site/api/ask.js`) sends only the question text to Gemini with a fixed instruction and gets
  back JSON, which `sanitizePlan` reduces to whitelisted fields. The plan is then resolved against the real player/team/venue tables and executed
  in the browser. If the key is missing, rate-limited or the reply is unusable, the built-in rule parser (`engine/nl.js`) answers instead.
* **Live scores.** `/api/live` (`site/api/live.js`) reads Source A's schedule, match and scorecard pages (no key; Source B is not used, its cards lagged its own header), caches ~15 seconds, and returns compact team
  scores plus batting/bowling so-far **only for matches in the book feed** (player props, event markets, or fancy). The fixture header shows a
  live board (current pair: avatars on the edges, name with runs/balls under it, partnership in the middle, last wicket, bowler, this-over deliveries with a divider at the over break, CRR/RRR)
  plus a Scorecard and Recent form accordion (both closed so props stay first). The closed Recent form row shows last 3 W/L chips per side so it fits on a phone; the open body is still last 5 in this format. Scorecard has batting (how-out, R, B, 4s, 6s, SR), extras, fall of wickets, yet to bat, and bowling (O, M, R, W, Econ) — the
  same columns Source A and Source B show. Games with no odds stay off
  the rail and off the live snapshot. The schedule page (cached ~5 min) lists the games and their URLs; scores, the current pair and rates come from the **match** page
  and the full card from **match-scorecard** (`getSC4`; `max-age` 10 s, robots-allowed; we do not call `$LIVE_SOURCE_BASE/api`), so a chase shows the chasing side's pair the moment it starts.
  The browser polls that route.
  **Playing XI.** The card lists a side's eleven (batters plus yet to bat) as soon as it is down to bat, so a prop row shows **Not in XI** and is dimmed when that side's eleven are all known and the player is not one of them. The other side stays unmarked until it has batted: the source only gives its XI through an app API we do not call. Pages are fetched from 90 minutes before the start so the batting side's XI is picked up at the toss. A priced match also stays in Hot props, with its last pre-match prices, for as long as the live feed lists it as being played (otherwise 3 hours from the start).
  Unofficial and can change. Every priced line of a match is settled here (`lines` on each match: value, state, verdict, Not in XI), by the player's id through the identity table, so the browser does no matching of its own; while the match is on these are "so far", and a final number in a finished match is its result, stored in the archive (`docs/PROJECT_GUIDE.md` 5.4c). VOID/DNP rules still apply: a player with no row has no result.
  Kick-off, "today / tomorrow" and countdowns stay in the **viewer's time zone** (`site/src/lib/format.ts`).

## Settlement rules and definitions
* T20 summary markets are void unless both innings reach 80% of the scheduled balls (96 of 120); ODI likewise (240 of 300); The Hundred 80 of 100; T10 48 of 60; 60-over 288 of 360.
  Tests: void unless there is a result, or 300 overs (5-day) / 200 overs (4-day) were bowled. Void matches are left out of match/team markets.
* 30s = 30-49, 50s = 50-99, 100s = 100+, double-digit = 10+, single-digit = 1-9 (ducks excluded). Team markets count only the team batting first.
* Retired hurt is not a wicket. Penalty runs count. Runs conceded = batter runs + wides + no-balls + penalty (as in `data/players`). Super overs are ignored.
* Formats: T20 = T20 + T20I, ODI = ODI + 50-over List A, Test = Tests only, **The Hundred / T10 / 60-over are their own formats**. A T20 in a Test series must not price the Test. First-class (`MDM`) is not included.
* Fair decimal odds = 1 / hit rate on the filtered sample (pushes on whole-number lines are void). Decimal odds only.
* Home/away/neutral is *inferred*, because Base has no home flag: the event ("X tour of Y"), the venue's tour history, its country in
  `value_bets/mappings/venue_geo.csv`, then the team that plays at least half of the venue's internationals. Unknown hosts are left out of home/away filters.

## Player screen (app-style UI)
The player page (`/player/<idx>`) is `site/src/pages/Player.tsx`: a sticky app bar on phones, a prop rail (stat), a hero (photo, name, round buttons, a 3x2 stat grid and a hit-rate ring), a format switch, one tappable bar chart with Over/Under, a line stepper and look-back pills that show each window's hit rate (`engine/windows.js`, unit-tested by hand-computed numbers), a bottom sheet for filters and for a tapped game, and Lines / Game log / Splits tabs. The **next match** card (`components/app/next-match.tsx`) sits above the chart while the game has not started: both sides, the ground, the books' decimal over/under on the line the chart is on, and how often he has cleared that line at that ground and against that opponent (the same chart entries, this format; DNP/VOID out), each with a fair decimal price (`engine/next-match.js`). The chart keeps the line and side in the URL with `replaceState`, so a page can be shared. UI library: shadcn/ui (Radix) with Motion for animation; see PROJECT_GUIDE 5.3.

**Bookmaker lines.** The value-bets pipeline saves every matched two-sided player line (runs, sixes, fours, wickets; decimal over/under per book) to `value_bets/out/book_lines.json` (`src/value_bets/booklines.py`, matched to Base player ids). The site builder bundles it as `data/lines.json`, and the player page reads the live file from GitHub (falling back to the bundle). For a player with a priced upcoming match, the chart opens on the market's **main line** (the one priced closest to evens, `engine/lines.js`) instead of the median-based default, and a "Bookmaker lines" card shows each book's prices, the no-margin market probability and his own hit rate over each line; tap a line to put it on the chart. Players or stats with no market line keep the median default (floor(median) + 0.5, `suggestLines`). Books rarely quote the same line for a player and stat, so a Hot props / fixture Props row whose player is priced by 2+ books lists each book's own line and over price under the row (`bookQuotes` in `engine/lines.js`; the lowest line, and the best price at it, in the accent colour); the row's edge, hit rates and bars stay on the main line, and a row with one book shows that book next to its price. Every place a book's price appears (those rows, the player page's lines, the fancy cards) marks the book with `BookBadge` (`components/app/book-badge.tsx`): the brand's logo from `site/public/books/` when `lib/books.ts` lists one (the mark as the site owner supplied it, cropped or scaled and never redrawn; the site is dark, so a white or reversed version is best), else a plain name chip; a logo that fails to load falls back to the name. The About page says the names and logos are their owners' trademarks, shown only to say where a price comes from.

**Edge.** The EDGE figure on Hot props, the player page's best-price line and Match Fancy is `shrunk chance x best price - 1` (`sideEdge` in `site/src/engine/stats.js`, unit-tested by hand-computed numbers). The hit rate is the window shown (L5 / L10 / L20 / L30 / All; the season and head-to-head windows on Hot props), over the games he played. It is pulled toward the market's no-vig chance of that side, `(hits + 10 x market) / (played + 10)`, so the market counts as ten extra games: 8 of 10 against an even market is 0.65, not 0.80, and 40 of 60 is 0.643, not 0.667. The price is the best any book offers for the side, and no edge is shown under ten played games. At 1.90 / 1.90 a record that matches the market gives -5%, the books' margin. It is a measure of expected profit per unit, not a stake size or a promise: nothing here models the matchup, ground or conditions except through the market's price (the hourly pipeline's context model is not used by the site yet).

**Innings scope (Tests).** For a Test batter the books price the match total and his side's first innings (`inn` on the line, `docs/VALUE_BETS.md`), and the page has a three-way **Both innings / 1st innings / 2nd innings** switch (`?scope=0|1|2`, shown for every Test batting stat, a scope with no priced line still charts that innings; the sheet's "batted first / chasing" filter is a separate thing). The switch picks the lines (`bookLinesFor(..., inn)` gives one scope at a time, `bookScopesFor` lists what is priced) and the chart: a first-innings line is charted against what he made in his side's first innings of each Test only (`filters.tinn`, from `store.teamInningNo`: his side's own n-th turn, not the match's n-th innings; the plan field is `team_innings`), never against match totals. With no `scope` in the link the page opens on the match total when it is priced, else on the first scope that is. The Hot props list gives a first-innings line a row of its own, tagged with its scope.

**Props are never deleted.** A fixture that has arrived and been priced keeps its props: the list on the home page lets a finished match go after a day (`shownFixtures`), but the fixture's own page (`/fixture/<id>`) always works. When the schedule no longer lists the match, or the live book file has let its lines go, the page reads the match's archive file (`value_bets/archive/YYYY-MM/<fixture id>.json`, see `docs/VALUE_BETS.md`) through `useFixtureBooks` (`src/hooks/useEngine.ts`, `loadArchive` in `src/lib/feeds.ts`; the id is checked against the fixture-id pattern before it becomes a URL). `archiveFixture` rebuilds the fixture from the file and `withArchive` adds its lines to the book doc (`src/engine/lines.js`, unit-tested); the props list scores them from the player's history like any others, and shows each result from the file's `results` (stored by the server once the match was over, `docs/VALUE_BETS.md`), else from the data once the match is in it.

**Home rail order, and settings that need no deploy.** The rail (`src/lib/priority.ts`) lists matches in play first, then the ones still to come, then finished ones; inside each group the viewer's own team leads (read from the time zone, then the language), then the bigger match (the two sides' standing), with a lift for the viewer's part of the world and for the big tournaments. The knobs are published as `config/home_rail.json` and read at view time (`loadRail` in `src/lib/feeds.ts`, `useRail`), so changing one is a commit to that file on `main`, live in about 5 minutes (the raw-file cache), with no site build: `tiers` (group order), `bonus` (`home`, `homeWomen`, `region`, `event`), `bigEvent` (whole words looked for in the series name), `standing` (a team key such as `southafrica` to a number) and `region` (a team key to its part of the world). Anything missing or mistyped keeps the built-in value (`sanitizeRail` reads only these keys, with limits), and a test keeps the file equal to the built-in settings, so edit both when a built-in default is meant to change.

**How the home page loads (what shows when).** The three feeds the rail reads (the book lines, `config/home_rail.json`, `/api/live`) are started in `main.tsx` before the data files finish (`prefetchFeeds`, `src/lib/queries.ts`), not when the page mounts. `loadLines` fetches the bundled `lines.json` and the live file together and keeps the newer by `generated_at_utc`; the live file is given up on after 1.5 s. The rail (`useHomeRail`) shows a skeleton until the schedule and the lines are in, so it is never the unpriced schedule that the priced list then replaces. Matches in play lead the rail, so the live state has to be there for the first paint: the last `/api/live` body is kept on the device for 30 minutes (`src/lib/live-cache.ts`) and is the live query's starting point (stale, so the fresh body is asked for at once), which puts live matches in front on the first paint of a revisit. With no kept body the rail waits up to 1.2 s for the live scores (0.8 s for the rail file) and then paints with what it has. A fresh body that changes a match's state (gone live, ended) re-sorts the rail; one that changes nothing leaves it as it was. **Hot props** score only the selected day's lines (`hotLines`, `src/lib/hot-lines.ts`; tomorrow is its own query, run when asked for; a fixture page scores only its own match), fetch the player files eight at a time with the busiest file first, and show the rows once a page of them is scored, then as more files land. Rows of a match in play come first, then the higher hit rate, then the higher edge (`hotOrder`; "in play" is the live feed's word for the match, as on the rail), so that order follows the live body too.

## Known limits (be aware before betting)
* Provisional matches carry player totals (no batting order, dismissals or fall of wickets). They feed player props. Match Fancy uses a scraped match only when it **qualified** (`q = 1`: innings from ball-by-ball, or from the scorecard totals with 80% of overs). Totals-only rows stay out, so missing fours are never shown as 0. Highest over / most conceded need deliveries; a scrape without them is omitted from those two markets. The sample label says when scraped matches are included, and through which date.
* Fixtures only cover what the free schedule scrape and the odds sources list; men's domestic fixtures can be missing.
* Live scores lag up to about 20 seconds and come from the unofficial Source A pages. A player with no row yet is not "0 so far" (they may not have batted). "So far" is not a result until the match is final. A Test at stumps stays on the live feed (scores plus "Stumps" / "Close of play"); it is not treated as finished until there is a result.
* Small samples are common: every answer shows `n` and a 90% interval for the hit rate. Fair odds have no margin and ignore form, pitch and XIs.

## Run it locally
```bash
pip install -e .
curl -fsSL -o all_json.zip $BASE_DATA_URL/downloads/all_json.zip
python -m cricket_site.build --zip all_json.zip --data data --out site/public/data     # ~30 s
cd site && npm ci && npm test          # engine + resolver + parser + API handler + components (node >= 20)
npm run dev                            # http://localhost:4173  (set GEMINI_API_KEY to try the AI parse)
```
Python tests: `pytest -q tests/site`. The JS tests run on a tiny synthetic dataset with hand-known numbers
(`tests/site/synth.py`, regenerated by `python scripts/make_site_fixture.py`; a pytest fails if the committed fixture is stale).

## Deploy (Vercel Hobby, free)
The Vercel project root is `site/` (static `public/` + `api/ask.js` + `api/live.js`; `site/vercel.json` already sets this).
1. **Once:** `cd site && npx vercel link --project cricket-props-hub` then, after building the data, `npx vercel deploy --prod`.
2. **AI key for the chat box.** Either **xAI Grok**: create a key at console.x.ai (API Keys), add it as the Vercel env var `XAI_API_KEY`, and set `XAI_MODEL` to a model name from the console's Models page (Grok API usage is billed per token, a few hundred tokens per question; check your credits). Or **Gemini (free tier):** create a key in Google AI Studio, then add it as the *Vercel* environment variable `GEMINI_API_KEY`
   (Project → Settings → Environment Variables, Production) and redeploy. Optional: `GEMINI_MODELS` (comma list, default
   `gemini-2.5-flash-lite,gemini-2.5-flash`; change it if Google retires a model), `ASK_PER_MINUTE` (default 12 per IP), `ASK_DAILY_CAP`
   (default 800 calls/day, under the free-tier limits). Without a key the site still answers with the built-in parser.
3. **Daily refresh:** `.github/workflows/site.yml` runs **every hour** (and after "Daily update", and on demand): the scraper commits new provisional matches every 30 minutes, so each run rebuilds
   `site/public/data` from the latest repo data and deploys. The Base zip, people register and player photos are cached once a day, so hourly runs stay light. Add three **GitHub repository secrets**: `VERCEL_TOKEN` (vercel.com/account/tokens),
   `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (both in `site/.vercel/project.json` after `vercel link`). Without them it builds and tests but does not deploy.
   PRs touching the site build and test only.
4. Prop Hunter reads `value_bets_latest.json` from GitHub at view time, so it stays hourly-fresh without any redeploy.

Never commit tokens or API keys: the key lives only in Vercel's environment, the deploy secrets only in GitHub secrets (`scripts/check_public_safe.py` runs in CI). `/data` is cookie-gated when `DATA_WRAP_KEY` is set; browsers get the cookie from `/api/gate` with no prompt, and the wrap key as the `X-Cd-K` header (not in the JSON). `/api/live` is wrapped the same way as the small JSON files, so the Network tab shows ciphertext. Google Analytics uses `VITE_GA_MEASUREMENT_ID` (GitHub secret, `--build-env` on deploy); there is no cookie banner.

## Player identity
Live numbers, the "Not in XI" mark and the photos all need to know that "V Suryavanshi" (our history), "Vaibhav Sooryavanshi" (the live source) and whatever the books print are one player. `identity.json` links them by id (our id -> the live source's player id, plus the names the books use), built with the site data and read by the browser next to `photos.json`. `livePlayer` and `notInXI` use the id when the table has one and fall back to the name rules otherwise. The builder, the review list of priced players it could not link, and the hand-checked file `data/mappings/player_identity.csv` are described in `PROJECT_GUIDE.md` 5.7. Scraped scorecards that print a playing name ("Chamari Athapaththu") against a registry surname ("AC Jayangani") are linked in `data/mappings/player_aliases.csv`; the engine also treats those surnames as equal (`SURNAME_ALIAS` in `site/src/engine/util.js`).

## Player photos and team logos
Sources, in order: **Source A** (the repo already scrapes it) then **Wikidata/Wikimedia Commons**, then a flag (national sides) or initials/silhouette.
The builder reads Source A's public sitemaps (`$LIVE_SOURCE_BASE/crex_sitemap/player.xml`, `team.xml`: ~9.8k players, ~1k teams), matches Source A full names to Base
names conservatively (surname + first initial, ambiguous names skipped, see `src/cricket_site/crex_assets.py`) and stores only ids in `data/photos.json`.
The browser loads images from Source A's CDN (`$IMG_CDN_BASE/players/org/<id>.png`, `/Teams/<id>.png`); nothing is copied into the repo.
About 54% of recently active players and most national and franchise teams get a Source A image today; the rest fall back. Those images belong to Source A:
check their terms before using the site commercially, or replace the source later by returning a different URL from `playerPhoto` in `site/src/lib/photos.js`.

## Our own copy of the images and id maps (Supabase, free plan)
So the site keeps working if Source A changes or removes its images, `src/cricket_site/assets_sync.py` copies each player photo / team logo once into a
public Supabase Storage bucket (`avatars`) and records it in Postgres (`assets`, `crex_players`, `crex_teams`; public read, writes only with the service key).
The Site workflow runs it hourly (resumable, at most `SYNC_LIMIT` new images per run, politely paced) and adds `base` + `s` (ids we hold) to `photos.json`;
the browser then tries our copy first and Source A second. Setup: repository variable `SUPABASE_URL` and secret `SUPABASE_SERVICE_KEY`
(dashboard -> Project Settings -> API Keys -> service role / secret key; never commit it). Without them the step is skipped and Source A is used directly.
Schema: see the `cricket_assets_schema` migration (tables above plus the `avatars` bucket: public, 200 KB limit, png/webp/jpeg only).

## UI libraries and the iOS / Android apps
The apps are planned natively (Expo / React Native), like props.cash, whose website is a plain React SPA with separate store apps. So the website and the apps share
**data, logic and token names, not components**:
* `site/src/engine/*` (plain ESM, no DOM) and the JSON data files are the shared core. Keep every number and rule there; never import React or the DOM into the engine.
* Web UI uses free MIT components from the shadcn CLI and its registries (`@magicui`, `@kibo-ui`, `@originui`, `@animate-ui` are registered in `site/components.json`; add with `npx shadcn@latest add @kibo-ui/<name>`),
  not hand-built widgets. Check the install diff: the CLI can overwrite `ui/*` files and the `.dark` tokens in `index.css`. Paid libraries are not used.
* Charts stay SVG (no extra chart package). A **heatmap** is used only where the data is two-dimensional or a hit-rate scan: the team/fixture player grid (colour by how far a cell sits from the line) and a split heat strip when a split has five or more groups. A **donut** is used only when a form window has three or more outcome kinds (cleared / missed / push / not counted); two-way over/under stays a gauge or bars. Form over games stays a bar chart. Paid kits (Cue Design and similar) are not used. An area chart is not used: form is discrete games.
* Prefer touch-first components: nothing that only works on hover (for example the Magic UI dock's magnification), `h-control` / `size-control` for tappable chrome, and `env(safe-area-inset-*)`
  for fixed bars (`viewport-fit=cover` is set in `site/index.html`, which iOS needs for the insets to be non-zero).
* The **look** is iOS-inspired (grouped light gray or true-black dark, system grays, blur, fully rounded pills, a segmented control, the classic iOS tab bar on phones and tablets (Ionic's `ion-tab-bar` web component, MIT, forced to iOS mode, translucent with the hairline on top), a source-list sidebar from `lg`). The **sizes** are a compact web scale so the same site reads well in a desktop browser and in Android/iOS browsers. Do not fork the website by user-agent; one set of values, every device. Dark is the default; Light / Dark / System live in the header (stored as `fc-theme`).

When the Expo apps exist, reuse the same role names (`text-body`, `gap-stack`, `control`, `chip-radius`, …) from `site/src/index.css` `:root`. Swap only the values: HIG on iOS (17 px body, 44 px controls), Material 3 on Android. Do not copy web pixel values into native, and do not copy native HIG sizes back onto the website.

## Type and spacing scales (no hard-coded sizes)
Sizes are named by role and defined once, in `site/src/index.css` (`:root` plus `@theme`). Pages and shared components use the names, never `text-[13px]`, `text-sm`, `mt-5` or `gap-3`.
`site/src/lib/design-tokens.test.ts` fails the build if a governed file does; add a file to its `GOVERNED` list when its page is migrated (the old pages are not yet).

Web values (16 px rem). Native apps remap the names, not these numbers.

| Type | Web | Used for |
| --- | --- | --- |
| `text-display` | 24–28 px, fluid | page title |
| `text-title` | 18 px | section titles, sheet titles, key values |
| `text-body` | 15 px | names, row titles, primary text |
| `text-callout` | 13 px | secondary lines, chips and control labels |
| `text-footnote` | 12 px | meta and captions |
| `text-caption` | 10 px | micro labels (EDGE), small badges, tab labels |
| `text-metric` / `text-stat` | 20 / 30 px | timers and big numbers / hero statistic |

| Spacing | Web | Used for |
| --- | --- | --- |
| `hair` | 4 px | icon and text micro gaps |
| `tight` | 6 px | inside a component, chip rows |
| `snug` | 10 px | between controls in a row, list-row padding |
| `stack` | 16 px | between stacked blocks |
| `group` | 20 px | between groups inside a section |
| `section` | 32 px | between page sections |
| `inset` | 14 px | padding inside cards and panels |
| `gutter` | 14 px, 20 px from md, 24 px from lg | page side padding; list rows use it so photos line up with the page edge |
| `control` | 36 px | chip, icon-button and tab height (`h-control`, `size-control`) |
| `header` / `tabbar` / `row` | 48 / 49 / 56 px | top bar, phone tab bar, list-row min height |

Type is in rem, so it follows the browser's font-size setting. One `cn()` (`site/src/lib/utils.ts`) merges classes for the whole app, including shadcn's `ui/*` (they import it as `cn`; see the alias in `vite.config.ts` and `tsconfig.json`); it knows these scales, so `text-body` replaces a component's own `text-sm` instead of fighting it.

**Vertical rhythm.** A page is a `flex flex-col gap-section` of sections; a section is a `flex flex-col gap-stack` of blocks; related controls sit in a `gap-snug` group. Blocks never set their own vertical margins (the token test forbids `mt-*`/`mb-*`/`my-*` in governed files, except `mt-auto`), so every gap on a page comes from its parent.
**Switching tabs smoothly.** Content that changes height (a tab body, a filtered list) goes in `AnimatedHeight`, so the page eases between heights instead of snapping and the browser never clamps your scroll. The fixture page pins its tab bar under the pinned header (`sticky`) and, when you switch tabs while scrolled past the body, eases the new body to the top (then re-aligns once the height animation ends). Player page Lines / Game log / Splits chips scroll that section into view; chip rows scroll horizontally inside themselves and do not drag the page up to the chart.

## Light and dark
Colours live only in `site/src/index.css`. `:root` is the light (iOS grouped) palette; `.dark` is the original true-black palette. Surfaces that used to be `bg-white/10` now use `hairline`, `surface` and `surface-hover` so they work in both. The header stays the brand green in both modes.
A blocking script in `site/index.html` paints `html.dark` before CSS so the first frame does not flash. Preference is `localStorage.fc-theme` (`light` | `dark` | `system`); no stored value means dark. The sun/moon control in the header and Appearance in the profile menu call `theme_set`. The toaster follows the resolved theme.

## Breakpoints
Phone layout (tab bar, one column, 82% fixture cards) is unchanged below `lg`. From `lg` (1024px) the sidebar replaces the tab bar, `--content-max` opens the main column (72rem, 86rem from 1440px), the home rail shows wider cards, Hot props sits in two columns, and the player page puts book lines beside the chart. Tablets keep the phone chrome so the tab bar still reaches.



## SEO and share cards

* **Per-page tags.** `site/src/lib/seo.js` `shareMetas` is the one list of tags (Open Graph + `twitter:card=summary_large_image` + `theme-color` + `og:image:alt`). The browser (`lib/title.ts`), the prebuilt pages (`scripts/seo.mjs`) and `/share` (`api/share.js`) all emit that list. Player, fixture and ground pages point `og:url` at `/share/...` and `og:image` at `/card/v7/...jpg` so a crawler stays on the card HTML instead of following through to the app shell. The version is in the path because X ignores `?v=` once it has cached a failed picture. Descriptions are clipped to ~180 characters so Facebook (~155 visible) and X (~200) do not cut mid-word.
* **Prebuilt pages.** `npm run build` ends with `site/scripts/seo.mjs`, which writes real HTML (title, description, canonical, share tags, JSON-LD, a short text body) for the static pages, every fixture and the biggest players, teams, competitions and grounds of the sitemap. The site address is `SITE_URL`, else the one in the sitemap the data build wrote. Every other path gets the app shell (no canonical; the app sets it).
* **Dynamic cards.** `api/og.js` draws a **1200×630** (1.91:1) **baseline JPEG under 300 KB** — the size Facebook, LinkedIn, WhatsApp, Discord, Slack, Telegram and iMessage all accept, small enough for WhatsApp's large preview, with `og:image:width/height` so Facebook can paint on the first share. X's 2:1 large card crops ~15 px; important type sits inside a ~64 px inset. A player-prop card is the share picture: name and team on the left, portrait on the right, team crests in a white circle (full mark, sat at the tip so a badge is not cropped), the Fancy.cash mark (`public/icon-192.png`) and wordmark at the top-right tip, the book's own logo from `public/books` on the listed-price chip, L5 mean and hit rate from `windowRate` on the last five played innings in that format (DNP / VOID never count; `api/og.js` reads the player shard, 2.5 s cap), the booked line / prop / listed price, opponent (no kickoff time) and five bars of those innings vs the line. A miss still returns a 1200×630 JPEG (never a PNG from a `.jpg` URL: X drops a type mismatch, never a 302 a crawler would follow). The image is served `inline`, with `Access-Control-Allow-Origin: *`. Photos are fetched in parallel with an 800 ms cap so X's crawler is not left waiting. `robots.txt` allows Twitterbot / Facebook / WhatsApp at `/` so they can read `/card` even if they also probe `/api`. Wrapped `photos.json` / `fixtures.json` are unwrapped with `DATA_WRAP_KEY` so the function can read them. `api/share.js` is a small page (Slack only reads the first 32 KB) with the JPEG in the body and no meta-refresh or JS redirect. Link-preview crawlers (X, Facebook/Instagram/Messenger, WhatsApp, Slack, Telegram, LinkedIn, Discord, Pinterest, Reddit, Teams, Bluesky Cardyb, Mastodon, LINE, Viber) hitting `/player`, `/fixture` or `/venue` are rewritten to that share HTML by `site/middleware.js`. Search indexers (Googlebot) still get the real page. The player page's Share button copies the `/share` link. A player URL with no stat/line still draws his booked prop when the books have one, so the picture is not an empty name card.
