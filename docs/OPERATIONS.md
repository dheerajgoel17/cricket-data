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
| `SITE_URL` | GitHub variable | repo Settings -> Variables | sitemap.xml / robots.txt; and the `value-bets.yml` step that reads `<SITE_URL>/api/live` to store finished matches' results in the archive (skipped when unset) |
| `XAI_API_KEY`, `XAI_MODEL` | Vercel env (Production) | `vercel env add` or dashboard | `site/api/ask.js` |
| `GEMINI_API_KEY`, `GEMINI_MODELS` | Vercel env (optional) | same | `site/api/ask.js` fallback |
| `ASK_PER_MINUTE`, `ASK_DAILY_CAP` | Vercel env (optional) | same | rate limits (defaults 12 / 800) |
| `SYNC_LIMIT` | workflow input / env | `site.yml` | max images copied per run (default 1500) |
| `LIVE_SOURCE_BASE`, `LIVE_SITEMAP_DIR`, `IMG_CDN_BASE`, `BASE_DATA_URL`, `PRICE_FEED_URL`, `EXCHANGE_API_URL`, `BETFAIR_SSO_URL`, `BETFAIR_API_URL`, `FEEDK_URL` (the feed root), `FEEDK_BOOKS` (`id=Name,id=Name`: its account ids and the names the prices are published under), `FEEDE_BOOKS` (`id=Name@root,id=Name@root`: Feed E's books, each with the name its prices are published under and its feed root) | GitHub **secrets** (masked in public logs) | repo Settings -> Secrets; values are not written anywhere in the repo, ask the maintainer | every workflow's top-level `env:`; read by `cricket_data.hosts.host()` |
| `LIVE_SOURCE_BASE`, `VITE_IMG_CDN` | Vercel env (Production, Preview) | `vercel env add` | `site/api/live.js` (runtime), `site/src/lib/photos.js` (build time) |
| `IDENTITY_URL` | Vercel env (optional) | `vercel env add` | `site/api/live.js`: where to fetch the identity table when the file shipped with the function is missing (default: the production domain's `/data/identity.json`) |
| `CV_SOURCES` | GitHub variable | repo Settings -> Variables | value-bets adapter list |
| `ODDS_API_KEY`, `BETFAIR_*`, `CRICKETDATA_API_KEY`, `RAPIDAPI_CRICKET_KEY` | GitHub secrets (all optional) | | value-bets / scraper extras |

**Source hosts live in the environment, never in the tree.** No tracked file names a data source's host (`scripts/check_public_safe.py` fails on it, comparing hashes so the script lists none), and committed data stores host-relative links. Locally put the same names in a git-ignored `site/.env.local` (the dev server loads it into the API handlers) or export them before running Python. Tests use placeholder hosts (`tests/conftest.py`, `site/tests/*`).

Never commit `.env*`, tokens, or keys. `site/.env.local` created by `vercel link` must be deleted (it holds an OIDC token).

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
