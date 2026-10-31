# Operations runbook

Accounts and where things live (names only, never paste secrets in chat, issues or commits):

| thing | where | notes |
|---|---|---|
| Code + CI | GitHub `dheerajgoel17/cricket-data` | default branch `main`; PRs; squash merges |
| Website | Vercel Hobby, project `cricket-props-hub` | root dir `site/`; linked via `site/.vercel` (gitignored) |
| Image/id store | Supabase project `cricket-props-hub` (ref `fgqcuvtpguuoxgwcgqyw`, Mumbai) | free plan; tables + `avatars` bucket |
| LLM parser | xAI Grok (`XAI_API_KEY`) or Gemini free tier (`GEMINI_API_KEY`) | env vars in **Vercel** project settings |

## Secrets and variables
| name | kind | where set | used by |
|---|---|---|---|
| `VERCEL_TOKEN` | GitHub secret | vercel.com/account/tokens | `site.yml` deploy |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub secrets | from `site/.vercel/project.json` after `vercel link` | `site.yml` deploy |
| `SUPABASE_SERVICE_KEY` | GitHub secret | Supabase dashboard -> Project Settings -> API Keys (service role / secret) | `assets_sync` (write access) |
| `SUPABASE_URL` | GitHub variable | repo Settings -> Variables | `assets_sync` |
| `DATA_WRAP_KEY` | GitHub secret | `openssl rand -hex 32` | wrap small JSON at build and `/api/live` at runtime; `site.yml` injects it as a Vercel **build** env (so `seo.mjs` can unwrap fixtures) and a runtime env (gate header + live wrap). `value-bets.yml` uses it to unwrap `/api/live` when storing results. Do not paste it into the repo |
| `VITE_GA_MEASUREMENT_ID` | GitHub secret | GA4 measurement id (`G-…`) | inlined at the Vercel build (`site.yml` `--build-env`). Empty or unset: no Google tag. Never commit the id |
| `SITE_URL` | GitHub variable | repo Settings -> Variables | sitemap.xml / robots.txt; the `value-bets.yml` step that reads `<SITE_URL>/api/live` to store finished matches' results in the archive (skipped when unset); and local `npm run dev` (copy into gitignored `site/.env.local`) which then proxies `/data`, `/api/gate` and `/api/live` so the UI uses production JSON and scores |
| `XAI_API_KEY`, `XAI_MODEL` | Vercel env (Production) | `vercel env add` or dashboard | `site/api/ask.js` |
| `GEMINI_API_KEY`, `GEMINI_MODELS` | Vercel env (optional) | same | `site/api/ask.js` fallback |
| `ASK_PER_MINUTE`, `ASK_DAILY_CAP` | Vercel env (optional) | same | rate limits (defaults 12 / 800) |
| `SYNC_LIMIT` | workflow input / env | `site.yml` | max images copied per run (default 1500) |
| `LIVE_SOURCE_BASE`, `LIVE_SITEMAP_DIR`, `IMG_CDN_BASE`, `BASE_DATA_URL`, `PRICE_FEED_URL`, `EXCHANGE_API_URL`, `BETFAIR_SSO_URL`, `BETFAIR_API_URL`, `FEEDG_NAME` and `FEEDG_API` (another exchange's published name and its API root; the odds host comes from its own catalogue call), `FEEDF_NAME` (the name the book is published under), `FEEDF_API` (an exchange's root: event list, menu, session markets), `FEEDF_PREMIUM` (its sportsbook root), `FEEDF_TENANT` (the account id its pages send), `FEEDK_URL` (the feed root), `FEEDK_BOOKS` (`id=Name,id=Name`: its account ids and the names the prices are published under), `FEEDE_BOOKS` (`id=Name@root,id=Name@root`: Feed E's books, each with the name its prices are published under and its feed root), `FEEDH_URL` (Feed H's sportsbook root), `FEEDH_NAME` (the name its prices are published under), `FEEDH_RELAY` and `FEEDH_RELAY_KEY` (required for a real pull — or reuse Feed G's pair; add this book's domain to the Worker's `RELAY_ALLOW_EXTRA`). Feed H never runs on a laptop: only GitHub Actions, and only through the Cloudflare Worker relay, so a home IP is never on the book's logs. | GitHub **secrets** (masked in public logs) | repo Settings -> Secrets; values are not written anywhere in the repo, ask the maintainer | every workflow's top-level `env:`; read by `cricket_data.hosts.host()` |
| `LIVE_SOURCE_BASE`, `VITE_IMG_CDN` | Vercel env (Production, Preview) | `vercel env add` | `site/api/live.js` (runtime), `site/src/lib/photos.js` (build time) |
| `IDENTITY_URL` | Vercel env (optional) | `vercel env add` | `site/api/live.js`: where to fetch the identity table when the file shipped with the function is missing (default: the production domain's `/data/identity.json`) |
| `CV_SOURCES` | GitHub variable | repo Settings -> Variables | value-bets adapter list |
| `ODDS_API_KEY`, `BETFAIR_*`, `CRICKETDATA_API_KEY`, `RAPIDAPI_CRICKET_KEY` | GitHub secrets (all optional) | | value-bets / scraper extras |

**Source hosts live in the environment, never in the tree.** No tracked file names a data source's host (`scripts/check_public_safe.py` fails on it, comparing hashes so the script lists none), and committed data stores host-relative links. Locally put the same names in a git-ignored `site/.env.local` (the dev server loads it into the API handlers) or export them before running Python. Tests use placeholder hosts (`tests/conftest.py`, `site/tests/*`).

Never commit `.env*`, tokens, or keys. `site/.env.local` created by `vercel link` must be deleted (it holds an OIDC token).

**Anti-scrape (silent, browsers are not prompted):** set `DATA_WRAP_KEY`. The Site workflow wraps the smaller `/data` JSON files (not `index.json` / `matches.json` / shards: those are too big to decrypt on a phone) and `/api/live` wraps the same way, so a Network-tab response is `{v, iv, ct}` rather than scores. `/api/gate` puts the key in the `X-Cd-K` header, not the JSON body. The Edge middleware requires the `/api/gate` cookie (known scraper UAs are refused; `meta.json` stays readable). A 403 on `/data` is `no-store` so a first-request cookie race is not cached as "Data not found". The hourly archive job unwraps `/api/live` with the same secret. This is a speed bump, not a secret from a real browser: the page still has to unwrap to draw numbers.

## Cadence (odds vs scores)
Job times, what is shown, and Test innings 0/1/2 rules: [SITE.md — Cadence and what we show](SITE.md#cadence-and-what-we-show). Short version: odds are hourly 09:00–23:00 IST **pre-match only** (no in-play prices); `/api/live` is ~15 s scores and so-far for books-priced matches; a priced match stays 24 hours after kick-off (6 days for a Test) as one match with the closing line plus live so-far. Do not add a 15 s odds route: `docs/VALUE_BETS.md` parked that on 2026-10-28.

## Routine tasks
**Rotate the xAI key**: console.x.ai -> API Keys -> create new, delete old; then `cd site && printf '%s' "$NEW" | npx vercel env add XAI_API_KEY production --sensitive --yes` (or the dashboard), then redeploy (`npx vercel deploy --prod --yes`).
**Change the LLM model**: set `XAI_MODEL` (names from `GET https://api.x.ai/v1/models`) and redeploy.
**Deploy manually**: build data (see PROJECT_GUIDE section 7) then `cd site && npx vercel deploy --prod --yes && rm -f .env.local`.
**Force a site refresh now**: Actions -> Site -> Run workflow (optionally `sync_limit`).
**First image backfill**: run Site with `sync_limit=6000` once; afterwards hourly runs only add new ids.
**Add a column/table in Supabase**: add a migration file in `supabase/migrations/` and apply it (Supabase MCP `apply_migration` or SQL editor); keep RLS on and reads public, writes service-only.
**Base looks stale**: expected for a few days; the scraper's provisional matches cover the gap. A `data-stale` issue opens if canonical data is > 3 days old; the Site workflow warns only if both sources are old.
**Scraper broke (Source A layout change)**: see [SELF_HEALING.md](SELF_HEALING.md), run `cricket-data health --out diagnostics`; `auto-merge-scraper-fixes` merges fixes labelled `scraper-fix`.
**A workflow shows "workflow file issue"**: YAML error. `pip install actionlint-py && actionlint .github/workflows/*.yml`.
**A priced player shows no live numbers, or a wrong "Not in XI"**: the name could not be linked to the live source. Open the latest Site run's summary ("Player identity: names to review"), pick the right source player from the suggestions (or look the player up on the source) and add `<our id>,<source id>,<note>` to `data/mappings/player_identity.csv`; the next build applies it (and gives the player his source photo).
**A finished match's lines show no result, or a wrong one**: open the deployment's `/api/live` and look at `matches[].lines` of that match (`linked` in the body is how many ids the identity table holds; 0 means the table did not load and names decide). A wrong or missing value is a matching fix (identity CSV, above) or a `settleLines` fix: one server change, no browser change. Results already stored in `value_bets/archive/**/<fixture id>.json` (`results`) are never rewritten by a job: correct the value in that file by hand in a PR.
**Site shows no photos**: `data/photos.json` missing? (cache restored an old format: bump the cache key prefix in `site.yml`). Source A CDN down: the browser falls back to our Supabase copy / flags / silhouettes.
**Vercel deploy limits**: Hobby allows ~100 deploys/day; hourly = 24.

## Health checks
* Site: `/data/meta.json` (`built_at`, `newest_base`, `newest_provisional`), `/sitemap.xml`, a deep link like `/player/<idx>`.
* API: `POST /api/ask {"question":"..."}` returns a plan (503 = no key; 429 = rate limit; 502 = provider error: client falls back).
* Supabase: `select count(*) from assets;` should approach ~5.5k after the backfill.
* CI: all four checks on PRs (`build`, `site-js`, `test (3.10)`, `test (3.12)`).

## Cost and limits
Everything runs on free tiers (GitHub Actions on a public repo, Vercel Hobby, Supabase free). Watch: Supabase free projects pause after inactivity (the hourly sync keeps it active);
1 GB storage / 500 MB DB; Vercel function limits; xAI Grok is the one **metered** dependency (a few hundred tokens per question), remove `XAI_API_KEY` to go fully free.


## Mumbai relay (Feed G, Feed H)
Feed G's book refuses GitHub's US servers (403) but answers a server in India. `relay/` is a Cloudflare Worker (`relay/worker.js`, `relay/wrangler.jsonc`) placed near Mumbai (`placement.region` = `aws:ap-south-1`): it forwards one request to a host on its allow list and returns the answer, and refuses anything without its key. Set as Worker secrets: `RELAY_KEY` (a long random string), `RELAY_ALLOW` (the first book's domains, comma separated) and `RELAY_ALLOW_EXTRA` (further books, same shape, so an extra book can be added without rewriting the first list). Set as repository secrets: `FEEDG_RELAY` (the Worker's address) and `FEEDG_RELAY_KEY` (the same key). With both set, `adapters/feedg.py` sends every request through the relay: the book sees an Indian Cloudflare edge address, whoever called the relay (checked from a GitHub US runner). Feed H **always** uses the same relay (its own `FEEDH_RELAY` pair, or Feed G's if those are already set): there is no direct call, and `fetch` is a no-op on a laptop (`GITHUB_ACTIONS` unset), so a home IP never reaches the book or the relay. Feed H's domain goes in `RELAY_ALLOW_EXTRA`. Deploy from `relay/` with Wrangler (or the Cloudflare dashboard). The Worker's own hostname is configuration, never committed. No machine of ours is involved and nothing runs unless the hourly GitHub run calls it. A dispatch-only probe (`.github/workflows/feedh.yml`) pulls Feed H alone through the same relay and prints counts; it never commits.

## India runner (Feed G), the alternative
(Not needed while the relay works.)
Feed G's book answers GitHub's US servers with 403, so its read runs on a small server in an India region (not a personal computer) that is registered as a self-hosted runner with the label `india`. `.github/workflows/feedg-india.yml` runs only there, on a schedule and by hand (a pull request or push never reaches it, since the repository is public), and commits `value_bets/state/feedg_latest.json`; the hourly value-bets run uses that file when the book refuses it (at most `CV_FEEDG_STATE_MAX_HOURS`, default 3, old, and only for matches that have not started).
1. Create the server (Ubuntu 24.04, 1 GB is enough, SSH key only) in an India region, e.g. DigitalOcean Bangalore.
2. `sudo apt-get update && sudo apt-get install -y python3-venv git`.
3. GitHub: Settings, Actions, Runners, New self-hosted runner, Linux. Run the download and configure commands it shows on the server, with the label `india`, then `sudo ./svc.sh install && sudo ./svc.sh start`.
4. When the runner shows Idle, set the repository variable `FEEDG_INDIA_RUNNER` to `on` (Settings, Secrets and variables, Actions, Variables). Set it back to anything else to switch the job off. Until it is `on` the job is skipped, not queued.
5. Run "Feed G (India runner)" once by hand and check that `value_bets/state/feedg_latest.json` is committed; the next value-bets run then lists Feed G as ok.
The book may also refuse a cloud server's address: then the manual run fails with 403 and the server can be deleted. Nothing else depends on it.

## Analytics
The site counts page views and a few button taps with Vercel Web Analytics (`@vercel/analytics`, MIT, free tier, no cookies, no personal data, so no consent banner). The script is added in `site/src/main.tsx`; events go through `site/src/lib/analytics.ts` (`player_filter`, `share`, `books_open`, `fancy_market`) and are forwarded to GA as well. To read the host dashboard, turn on **Analytics** once (Project, Analytics, Enable); nothing is collected until then. Events with properties need the Pro plan to be filtered there; the free plan counts page views and shows custom events as totals. The SPA catch-all rewrite skips `/api/` and `/_vercel/` so the insights script is not swallowed.

Google Analytics 4 loads the same way when `VITE_GA_MEASUREMENT_ID` is set (`site/src/lib/ga.ts`): no cookie banner, ads cookies denied, SPA `page_view` from `App` with referrer, UTM, device, OS, language and an `is_bot` flag (headless Chrome, webdriver, known crawler UAs — so a Linux browser from an edge POP is tagged separately from a person). `/api/geo` reads the edge country/region headers (host and Cloudflare) and sets them as user properties. The measurement id is a GitHub secret, inlined at build; it is never in source. Without the secret the tag is not injected. Country/city tables in GA fill after a few hours of traffic; empty breakdowns before that are the property being new, not a missing tag.

**Errors and speed.** Page errors are counted as events named by kind: `error_chunk` (a script of an older deploy was gone; the page reloads itself), `error_render` (a page threw, the Reload button showed), `error_script` and `error_promise` (anything else), at most five per page load, so the totals read on the free plan (the message and page go along as properties, readable on Pro). Loading speed (Core Web Vitals per page) comes from Vercel Speed Insights (`@vercel/speed-insights`, Apache-2.0, free tier): turn on **Speed Insights** in the same project dashboard. Watch for a rise in `error_chunk` right after a deploy (normal, small) and any `error_render` (a bug).

