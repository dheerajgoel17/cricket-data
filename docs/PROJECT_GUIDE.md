# Project guide: cricket-data + Cricket Props Hub

Everything a new contributor (human or AI agent in any IDE) needs to pick this project up. Start here, then follow the links.
Operations (secrets, runbooks) live in [OPERATIONS.md](OPERATIONS.md); the site's feature list in [SITE.md](SITE.md); the StatsHub comparison in [SITE_MAP.md](SITE_MAP.md).

## 1. What this is
Two products in one repo, both **100% free to run**:

1. **The dataset** (`src/cricket_data`, `data/`): 21k+ cricket matches since 2001 (men's and women's) from [Cricsheet](https://cricsheet.org) ball-by-ball, stored as monthly
   gzipped CSVs, plus **provisional** matches scraped from CREX to cover the days before Cricsheet publishes. A `cricket-data` CLI queries and maintains it.
   An hourly **value-bets** pipeline (`src/value_bets`) prices player props against free odds sources.
2. **The site** ("Cricket Props Hub", `site/`, `src/cricket_site`): a StatsHub-style player-props and stats website on Vercel Hobby. Hit rates over any line, DNP-aware form
   charts, fair decimal odds, partnerships, team/venue/competition markets, player trends, a Prop Hunter (value bets), and an ask-anything box (an LLM turns the question into a
   structured query; **all numbers come from the data**).

### Non-negotiable rules
* **Free only**: no paid services as hard dependencies. Optional keys (xAI Grok / Gemini for the chat parser) degrade gracefully to a built-in parser.
* **Decimal odds only** (never American/fractional). Player props and fancy markets only; no match-winner focus.
* **Exchange rules**: T20/ODI summary markets void unless 80% of overs are bowled in both innings (Hundred 80/100 balls); Tests void unless a result or 300 (5-day) / 200 (4-day) overs;
  30s = 30-49, 50s = 50-99, 100s = 100+; double-digit = 10+; single-digit = 1-9 (ducks excluded); team markets count only the team batting first; retired hurt is not a wicket;
  penalty runs count; super overs ignored; **a player named in the XI who never batted (bowled) has his batting (bowling) bets void**: the chart shows VOID (named in `xi`, no row) vs DNP (not in the XI), both excluded from hit rates.
* **Never mix formats**: T20 = T20 + T20I, ODI = ODI + domestic List A, Test = Tests only, **The Hundred is its own format**, first-class (`MDM`) is excluded.
* **Show freshness** on every page: newest Cricsheet match date + whether provisional games are included.
* **Never print or commit secrets** (`scripts/check_public_safe.py` runs in CI and also bans hosted-service hostnames (Vercel, Supabase and Workers subdomains), absolute home paths and `.env*` files).

## 2. Repository map
```
.github/workflows/    CI + scheduled jobs (see section 6)
data/                 matches/ players/ (monthly csv.gz), provisional/*.json (CREX scrapes), mappings/, fixtures/, state/, reconcile_log.csv
docs/                 documentation (this file, OPERATIONS, SITE, SITE_MAP, VALUE_BETS, SCRAPER, PROVISIONAL, DATA_DICTIONARY, ...)
scripts/              check_public_safe.py, make_site_fixture.py, model_backtest/ (research)
src/cricket_data/     dataset package: Cricsheet ingest, store, provisional + reconcile, registry/link-players, CREX scraper, CLI
src/value_bets/       hourly prop-pricing pipeline (model, adapters for Smarkets / MoviOdds, weather, alerts)
src/cricket_site/     site builder (stdlib only): parse.py, build.py, crex_assets.py, assets_sync.py
site/                 the website: public/ (static app + generated data/), api/ask.js (serverless), vercel.json, tests/ (node), scripts/serve.mjs
supabase/migrations/  SQL for the image/id store (applied to the Supabase project)
tests/                pytest: dataset tests, tests/value_bets, tests/site (synthetic matches + builder + crex_assets + assets_sync)
value_bets/           committed outputs of the value-bets pipeline (out/, state/, mappings/)
AGENTS.md CLAUDE.md   instructions for AI coding agents (any IDE)
```

## 3. Data layer (`src/cricket_data`, `data/`)
* **Canonical**: `data/matches/YYYY-MM.csv.gz`, `data/players/YYYY-MM.csv.gz` (one row per player per match). Columns in [DATA_DICTIONARY.md](DATA_DICTIONARY.md). Written deterministically
  (sorted rows, gzip mtime 0) so unchanged months produce no git diff.
* **Provisional**: `data/provisional/*.json`, one per scraped match (`crex-<slug>.json`). They carry player totals only (no ball-by-ball). A provisional match is deleted once Cricsheet
  publishes the same fixture (same teams, +/-1 day) and is logged in `data/reconcile_log.csv`. Permanent classes (`cricsheet_missing`, `cricsheet_withheld`) are kept. See
  [PROVISIONAL.md](PROVISIONAL.md), [PERMANENT_MATCHES.md](PERMANENT_MATCHES.md).
* **Player ids**: `cricket-data link-players` fills Cricsheet registry ids ("Harry Brook" -> `4ae1755b`) into provisional files using `data/mappings/player_aliases.csv`; unmatched names land in
  `data/provisional_unmatched.csv`.
* **Fixtures**: `cricket-data fixtures` reads CREX's `/schedule` page (server-rendered state with the next ~20 matches) every scraper run; it never overwrites the file with an empty result. The older sitemap crawl (`--sitemap`) surfaced stale placeholder pages and is no longer the default.
* **Linking scraped players**: besides `link-players`, the site builder links still-unlinked scraped names through CREX's full-name list (e.g. Afghanistan, whose matches Cricsheet withholds): ~1.7k extra rows.
* **CREX scraper**: `crex_*.py`, `scrapers.py` (Playwright for pages, plain HTTP for the CREX sitemaps; see [SCRAPER.md](SCRAPER.md), [SCRAPING_REALITY.md](SCRAPING_REALITY.md), [SELF_HEALING.md](SELF_HEALING.md)).
* **Ball-by-ball**: `cricket-data crex-balls` scrapes CREX's commentary feed into `data/balls/` (verified against the scorecard before storing), see [CREX_BALLS.md](CREX_BALLS.md).
* **CLI**: `cricket-data update | backfill | health | fixtures | crex-balls | stats | query | link-players | freshness | export-sqlite`.
* **Freshness**: `cricket-data freshness --max-age-days 3` fails when the newest *canonical* match is old; the scraper's provisional matches still cover the gap on the site.

## 4. Value bets (`src/value_bets`)
Hourly pipeline: pulls free odds (Smarkets exchange API, an unofficial bet365 mirror), prices player props with a negative-binomial model, writes small committed outputs to
`value_bets/out/` (`value_bets_latest.json`, `new_alerts.json`, `alerts_history.jsonl`). The site's Prop Hunter reads `value_bets_latest.json` live from GitHub raw and falls back to the
snapshot built into the site. Details: [VALUE_BETS.md](VALUE_BETS.md), [MODEL_BACKTEST.md](MODEL_BACKTEST.md). No free source prices cricket player props officially: that is why edges are rare.

## 5. The site

### 5.1 Build pipeline (`src/cricket_site`)
`python -m cricket_site.build --zip all_json.zip --data data --out site/public/data [--value-bets value_bets/out] [--people people.csv --photos] [--site-url URL]`

1. `parse.py` parses each Cricsheet ball-by-ball JSON into batting rows (position = order of first appearance at the crease; runs/balls/4s/6s; dismissal kind), bowling spells
   (wickets exclude run outs/retired; runs conceded = batter runs + wides + no-balls + penalty), partnerships (pair, wicket no., runs, balls, who was out), and per-innings market
   aggregates (fours, sixes, 30s, 50s, 100s, 10+, single-digits, ducks, highest over, most conceded, top score, top-scorer ids). Super overs ignored. `qualifies()` implements the void rules.
2. `build.py` merges provisional matches (deduped against the zip), infers hosts (home/away), assigns integer ids, shards player data into 64 files and writes JSON.
3. `crex_assets.py` matches CREX sitemap names to Cricsheet players (conservative: surname + first initial; ambiguous names skipped) and teams (with a small alias table).
4. `assets_sync.py` copies images into our own Supabase Storage (see 5.6).

Output files in `site/public/data/` (all JSON, columnar = one array per field; **generated, gitignored**):

| file | content |
|---|---|
| `meta.json` | schema, build time, counts, `newest_cricsheet`, `provisional_matches`, `newest_provisional`, `provisional_included` |
| `index.json` | `players` {id,nm,g,last,n,tm,fm(format bitmask)}, `aliases`, `teams` [{n,g}], `venues`, `events`, `hosts`, `kinds`, `formats` ["T20","ODI","Test","Hundred"], `nshard` |
| `matches.json` | per match: `id d(date) f(format idx) g(0 male/1 female) i(intl) e(event idx) v(venue idx) a b(team idx) w(winner idx/-1) r(result 0 win,1 tie,2 none,3 draw) o(overs) dy(days) h(host: idx into hosts, -1 neutral, -2 unknown) fi(team idx batting first/-1) pv(provisional) q(valid for summary markets 1/0, -1 unknown) ho mc ts` and `inn` = per innings `[team, runs, wkts, balls, f4, f6, n30, n50, n100, n10, nsd, nduck, highest_over, most_conceded, top_score, ...topScorerPlayerIdx]` |
| `p/NN.json` | player shard (player id mod 64): `bat` {p m i t q o r b f s k tb mt}, `bowl` {p m i t q w c n}, `xi` {p m} (player named in the match's playing XI); `matches.json` also has `xq` (1 = the named XI is reliable), `pt` partnerships {a b m i o w r n ra rb x kd} stored under the lower player index |
| `fixtures.json` | upcoming fixtures from `data/fixtures/upcoming.csv` (refreshed every scraper run from **CREX's own schedule page**, `src/cricket_data/crex_schedule.py`: the next ~20 matches with real times, format, venue; far-future tours are kept until they pass) only (the bookmaker feed is odds-only: never a fixture or start-time source, as books serve different regions), with stable `id` (`date-team-v-team`) and team idx |
| `props.json` | snapshot of the value-bets output (Prop Hunter fallback) |
| `photos.json` | `{p: {cricsheetPlayerId: "c:<CREX id>"|"w:<Commons file>"}, t: {foldedTeamName: crexTeamId}, base, s}` (`base`/`s` added by assets_sync). **Keyed by Cricsheet id, never by array index** (indices shift between builds) |

Rebuilding is deterministic apart from timestamps. Size: ~35 MB raw, ~12 MB compressed.

### 5.2 Engine (`site/public/js/engine`, dependency-free ES modules; runs in browser and node)
`store.js` (load + join rows to matches; home/away; shards) · `filters.js` · `stats.js` (hit rate, Wilson interval, fair odds; pushes void) · `props.js` (player report, DNP-aware form chart over team
fixtures, correlated props) · `markets.js` (match/team markets, top batter) · `partnership.js` · `resolve.js` (typo-tolerant player/team/venue/competition resolution) · `plan.js` (query plans: sanitize,
resolve, run) · `nl.js` (rule-based question parser, the LLM fallback) · `prompt.js` (LLM instruction) · `rules.js`, `util.js`.
**Invariant: every number shown comes from the engine; the LLM only emits a validated plan** (`sanitizePlan` whitelists fields; see `site/tests/nlp.test.mjs`).

### 5.3 UI (`site/public/index.html`, `css/style.css`, `css/ui.css`, `js/shadcn.js`, `js/app.js`, `pages2.js`, `render.js`, `assets.js`, `photos.js`, `ui.js`)
Vanilla JS, no build step. Design tokens follow shadcn/ui's zinc dark theme (`:root` in `style.css`), and `js/shadcn.js` + `css/ui.css` port shadcn's Accordion, Tabs, Badge, Switch, Toggle group, Skeleton, Sonner-style toast and Tooltip (same anatomy, ARIA roles and keyboard behaviour; the real library needs React + Radix). Filters apply live (no Update buttons, `live()` in `ui.js`); times render in the viewer's zone, 12-hour for Indian viewers. Hash routes internally (`#/player/123`), but path URLs also work (`/player/123`): `vercel.json` rewrites unknown paths to `/` and `app.js` maps the path to the hash route.
Routes: `/` fixtures + landing, `players`, `player/<idx>`, `teams`, `team/<idx>`, `venue/<idx>`, `fixture/<id>`, `trends`, `competitions`, `league/<eventIdx>`, `props`, `pair`, `ask`, `tools`, `odds`
(decimal-only calculator), `glossary`, `saved` (stars in localStorage), `about`. Dark StatsHub-inspired design (Bebas Neue + Manrope, `#151719`/`#1f2123`, pills, 24px cards), animations respect
`prefers-reduced-motion`. Mobile: bottom tab bar; desktop: top nav + search + home side rail.

The **player page is an app screen** (`js/playerapp.js`, Ionic web components from a pinned CDN version with plain fallbacks, `css/app.css`, `js/engine/windows.js` for the look-back hit rates): see [SITE.md](SITE.md).

### 5.4 Ask-anything API (`site/api/ask.js`)
`POST /api/ask {question}` -> `{plan, model}`. Provider: **xAI Grok** if `XAI_API_KEY` (model `XAI_MODEL`, e.g. `grok-4.20-0309-non-reasoning`), else **Gemini** if `GEMINI_API_KEY`; none -> 503 and the client uses `nl.js`.
Per-IP rate limit + daily cap, key only in headers, reply passed through `sanitizePlan`. The browser resolves names and runs the plan locally.

### 5.5 Photos, flags, logos
Team logos / player photos come from CREX's public sitemaps + image CDN (`cricketvectors.akamaized.net`), fallbacks: Wikimedia Commons (Wikidata P2697->P18), flagcdn flags, initials/silhouette.
The browser tries **our own copy first** (5.6). Images belong to their owners: check terms before commercial use.

### 5.6 Our own store (Supabase, free plan; project `cricket-props-hub`, ref `fgqcuvtpguuoxgwcgqyw`, region ap-south-1)
Postgres `assets`, `crex_players`, `crex_teams` (public read, service-key write) + public Storage bucket `avatars` (200 KB, png/webp/jpeg). `assets_sync.py` runs in the Site workflow
(resumable, `SYNC_LIMIT` per run, polite). Schema: `supabase/migrations/`. If CREX disappears, the stored copies and id maps keep the site working.

## 6. Workflows (`.github/workflows`)
| workflow | trigger | what it does | secrets / vars |
|---|---|---|---|
| `ci.yml` | push to main, PRs | ruff, pytest (py3.10 + 3.12), public-safety check, `site-js` node tests | none |
| `daily-update.yml` | 05:30 UTC | Cricsheet delta + reconcile + link-players + freshness check; commits `data/`; opens `data-stale` / `update-failed` issues | none |
| `scraper-update.yml` | every 30 min (+03:17 backfill) | CREX scrape of newly finished matches into `data/provisional/` | optional API keys |
| `balls-update.yml` | every 2 h | CREX ball-by-ball for recent matches Cricsheet lacks (`data/balls/`), prune the ones it now has | none |
| `weekly-heal.yml` | Sun 06:15 | full re-sync / healing | none |
| `value-bets.yml` | hourly 03:30-17:30 UTC, weekly refit | odds -> value bets, commits `value_bets/out` | optional odds keys |
| `site.yml` | **hourly :50**, after Daily update, push to main touching site, manual | JS tests, build site data (zip/people/photos cached daily), sync images to Supabase, deploy to Vercel (PRs: build + test only) | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_SERVICE_KEY`; vars `SITE_URL`, `SUPABASE_URL` |
| `auto-merge-scraper-fixes.yml` | workflow_run | merges `scraper-fix` PRs that only touch scraper files | none |

## 7. Local development
```bash
python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev,value-bets]"
pytest -q && ruff check src tests && python scripts/check_public_safe.py
curl -fsSL -o all_json.zip https://cricsheet.org/downloads/all_json.zip
python -m cricket_site.build --zip all_json.zip --data data --out site/public/data      # ~30 s
cd site && npm test && node scripts/serve.mjs 4173                                      # http://localhost:4173 (Node >= 20, no npm install)
python scripts/make_site_fixture.py       # regenerate site/tests/fixtures after changing the builder's output format (a pytest guards drift)
```
Add `--people people.csv --photos` (people.csv from `cricsheet.org/register/people.csv`) to build photo/logo ids. Set `XAI_API_KEY` (+`XAI_MODEL`) or `GEMINI_API_KEY` to try the AI parser locally.

## 8. Testing strategy
* `tests/site/synth.py` builds **synthetic Cricsheet matches with hand-known numbers**; `test_parse.py` checks the rules, `test_build.py` the outputs/provisional dedupe/fixture drift,
  `test_crex_assets.py` the name matcher, `test_assets_sync.py` the sync with a fake HTTP layer.
* `site/tests/*.test.mjs` run the engine on the generated mini dataset (`site/tests/fixtures`): arithmetic, resolver typos, rule parser, plan sanitizing, API handler (mocked fetch), photo URL logic.
* The Gemini/Grok calls are never made in tests. Live behaviour was checked manually.

See [EDGE_CASES.md](EDGE_CASES.md) for the full table of settlement edge cases (void / DNP / N/A and why).

## 9. Gotchas and decisions (read before changing things)
* **No ball-level data in `data/`**: the CSVs hold per-player match totals only. Batting position, partnerships and fancy markets exist only because the site builder re-parses the Cricsheet zip.
* **Provisional matches** lack innings detail: they feed player props but not partnerships, position, innings order or match markets; filters drop them and say so.
* Player data sharded by `int(id,16) % 64`; partnerships live in the shard of the **lower** player index (pair lookups need only one shard).
* Home/away is **inferred** (tour name "X tour of Y", venue history, venue_geo country, majority host). Unknown hosts are excluded from home/away filters.
* `check_public_safe.py` fails on Vercel/Supabase hostnames in tracked files: pass URLs through repo variables, never write them in tracked files. Generated `sitemap.xml`/`robots.txt` are gitignored for that reason.
* YAML in workflows: an unquoted `: ` inside a `run:` one-liner breaks the whole file (GitHub reports only "workflow file issue"). Lint with `actionlint`.
* Cache key `site-dl4-<date>` in `site.yml`: bump the prefix when the format of cached downloads (e.g. `photos.json`) changes.
* macOS `sed -i` needs `''`; prefer Python for scripted edits.
* Vercel: `outputDirectory: public`; the SPA rewrite destination must be `/` (with `cleanUrls`, `/index.html` did not work). `.vercelignore` excludes tests/scripts.
* The dev server `site/scripts/serve.mjs` has the same SPA fallback as the Vercel rewrite.

## 10. Roadmap ideas (not built)
Umpire/match-referee stats (Cricsheet officials) · competition standings (per-tournament points rules) · minutes-style and traits panels on player pages · server-side rendering for SEO ·
a real odds feed (the only paid piece StatsHub has) · syncing scraped matches into Postgres for ad-hoc queries · more CREX squads/ids from scorecards to raise photo coverage (~54% of active players today).
