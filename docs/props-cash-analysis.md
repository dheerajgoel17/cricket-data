# Props.cash frontend architecture, and why Cricket Props Hub does not feel like an app

Investigation date: 26 October 2026. This is analysis only. No product code was changed.

Baseline for the cricket site is `main` at `13e0a85` (`site: props.cash design, components and Motion animations; React migration plan (#41)`). The earlier implementation branch `cursor/app-shell-perf-6a65` (PR #42) was closed and is not part of this baseline.

Labels:

- **Confirmed.** Observed in a response header, in the HTML document, or in a downloaded bundle, with the evidence named.
- **Assumed.** A reasonable reading that was not observed end to end. Logged-in Props.cash traffic was not captured. There is no HAR.

## 1. How Props.cash was inspected

Public document and assets, unauthenticated:

| What | Evidence |
|---|---|
| Player URL returns the app shell, not a player document | `GET https://props.cash/nfl/cfc93f5e-105e-4a5e-88d3-f4279893cfa8` → `200`, `content-type: text/html`, `content-length: 3660`, `etag: W/"e4c-FbnUnMRyDbEMHmdCNNZ+5/ES0u0"`, `cache-control: no-cache`, `x-powered-by: Express`, `server: Heroku`. Same length and etag as `GET https://props.cash/`. |
| Entry bundles | HTML contains `<script defer src="/static/js/main.c4f0e042.js">` and `<link href="/static/css/main.c29c4d2e.css">`. JS: `content-length: 302834`, `cache-control: public, max-age=31536000, immutable`. CSS: `content-length: 107324`, same immutable header. |
| League UI chunk | Downloaded `/static/js/817.b524f82d.chunk.js` (1,505,133 bytes), plus `588.3829c212.chunk.js` (411,030) and `860.b8dd90b9.chunk.js` (33,584). |
| API probes | `GET https://api.props.cash/nfl/matchup-overview` → `401`, body `Unauthorized`, `access-control-allow-origin: *`, no `Cache-Control`. `GET https://live.props.cash/v1/nfl/snapshot` → `401`, body `{"error":"missing"}`, `www-authenticate: Bearer realm="live"`. `GET https://props.cash/schedule`, `/slate-cards`, and `/health` were not used as API proof; those paths are on the API host in the bundle, not on the website origin. |

Successful authenticated JSON responses, their cache headers, and a real click-path through a logged-in board were **not** observed.

## 2. Props.cash: how the in-app feel is built

### 2.1 Framework and bundles

**Confirmed.** Create React App output served by Express on Heroku, not Next.js.

- HTML: `<div id="root">`, `<noscript>You need to enable JavaScript to run this app.</noscript>`, body `background:#0f0f0f`.
- `main.c4f0e042.js` is a webpack runtime. Chunk map in that file:

```text
{73:"990a69fc",85:"3b275991",262:"eb4627e8",430:"a4ff27af",588:"3829c212",
 728:"95cd7e52",755:"f42c1046",817:"b524f82d",843:"6a5d531b",850:"d36daeaf",
 860:"b8dd90b9",874:"b40ff59a",922:"bfaf2fee"}
```

`n.miniCssF` emits `static/css/<id>.9d9194f9.chunk.css`. The league chunk assigns `self.webpackChunkplayer_props`.

- `GET https://props.cash/asset-manifest.json` → `200`, `cache-control: public, max-age=3600`.
- `GET https://props.cash/index.css` → `200`, `content-length: 0`, `cache-control: public, max-age=3600`. The stylesheet linked from HTML is empty; the real CSS is the hashed file.
- Route chunks are `React.lazy` wrappers. From `main.c4f0e042.js`:

```text
T=function(t,n){return(0,e.lazy)((function(){return t().then((function(e){return{default:e[n]}}))}))}
I=function(){return Promise.all([n.e(860),n.e(588),n.e(817)]).then(n.bind(n,857))}
N=T(I,"LeagueRoutes")
```

The same pattern loads `GoLivePage` (`843`+`874`), `AffiliatePage` (`860`+`73`), `Terms` (`755`), `PrivacyPolicy` (`850`), `BillingSuccess` (`262`), `BillingCancelled` (`430`), `Login` (`85`), `Signup` (`728`). `Suspense` appears 11 times in `main.c4f0e042.js`.

- If any `localStorage` key starts with `@@auth0spajs@@`, `I()` runs immediately, so the league chunks download before the user opens a league. Confirmed in `main.c4f0e042.js`.
- Web vitals are a separate chunk: `n.e(922)` then `getCLS`, `getFID`, `getFCP`, `getLCP`, `getTTFB`. GTM id `GTM-PD9NTW9` is initialized in the same file. HTML also loads gtag `G-8M619TBGQW`, Stripe.js, Rewardful, and Auth0's domain `props-helper.us.auth0.com`.
- A publishable Stripe key and Stripe price ids are inlined in chunk `817`. They are client-side identifiers. This report does not repeat them.

**Assumed.** `588` is a shared UI/runtime chunk (it contains `unstable_batchedUpdates` and DOM viewport measurement helpers, not a data API). `860` is a small shared chunk (33 KB) pulled in beside the league UI. Those roles are inferred from what the chunks contain, not from source maps.

### 2.2 Client routing and transitions

**Confirmed.** One HTML document. React Router v5 (`Route` / `Switch` / `Redirect`, `exact:!0`, a `render` prop). In the bundle those components are `r.AW`, `r.rs`, and `r.l_`.

Top-level paths in `main.c4f0e042.js`: `/`, `/app`, `/signup`, `/login`, `/privacy`, `/terms`, `/cancelled`, `/success`, `/promo`, then league paths `/nba`, `/nhl`, `/mlb`, `/wnba`, `/ncaaf`, `/nfl`. `/csgo`, `/nflszn`, and `/ncaam` are `<Redirect to="/nfl">`. Each real league renders `LeagueRoutes` with a league string (`"NFL"`, and so on). The reference URL is therefore a client route inside the NFL shell, not a second document.

Inside `817.b524f82d.chunk.js`, `Switch` registers, with `n` the league prefix:

| Path | What it renders |
|---|---|
| `{n}/recap` | recap page |
| `{n}/watchlist` and `{n}/pinned-props` | watchlist page |
| `{n}/markets` | markets page |
| `{n}/search` | search page |
| `{n}/team/:teamAbbr` | team page |
| `{n}/player/:playerId` | redirect to `{n}/{playerId}` |
| `{n}/game/:gameId` | redirect to the league root |
| `{n}/:playerId` and exact `{n}` | the same component (`tF`) |

The board and the player are one shell. A tab strip in that chunk is `Props` (`path:""`), `Markets` (`/markets`), `Watchlist` (`/watchlist`), with classes `bg-white/[0.07] backdrop-blur-xl border border-white/10`.

Navigation into a player keeps board state on the history entry. Chunk `817` does `ce.push("/" + league, { savedState, activePropKey })` and also `push` with `{ propLine, activePropKey, activePropType, savedState }`. One fullscreen overlay calls `history.pushState({__propsFullScreen:true}, "")` and listens for `popstate`. Its enter classes are Headless UI style: `enter:"ease-out duration-250"`, `enterFrom:"translate-x-f…"`. The tab indicator animates width, height, and transform (`width Nms ease-in-out, height Nms ease-in-out, transform Nms ease-in-out`) and fades opacity.

Compiled CSS (`main.c29c4d2e.css`, 107,324 bytes): 38 `transition`, 8 `animation`, 4 `overscroll`, 5 `position:fixed`, 3 `sticky`, 5 `100vh`, 0 `skeleton`, 0 `safe-area`. `@media` widths are the Tailwind defaults: 640, 768, 1024, 1280, 1440, 1536, plus `prefers-reduced-motion: reduce`.

**Assumed.** The shared `tF` shell is what makes the board-to-player move feel like a panel change rather than a new page. That was not clicked in a browser session for this note; it is what the route table says.

### 2.3 Data fetching, batching, polling, websockets

**Confirmed.** Two origins, both hard-coded.

Authenticated and unauthenticated JSON clients live in `main.c4f0e042.js`:

```text
i="https://api.props.cash"
fetch(i + path, { method:"GET", headers:{ Authorization:"Bearer " + token, "Content-Type":"application/json" }})
```

Export `gq` is that bearer GET. Export `u` is the same GET without `Authorization`. Two POST helpers send a JSON body, one with a bearer token and one without. There is no axios, no react-query, no SWR (those strings are absent from `main.c4f0e042.js` and from chunk `817`).

`gq(` templates in chunk `817` (the path is passed as a string; the client always GETs):

`/`, `/churnkey/hash`, `/customer?auth0id=`, `/mlb/bvp-insight?hitterId=`, `/mlb/bvp-pitcher-summary?`, `/mlb/game-matchup?team=`, `/mlb/hitter-splits-by-year?playerId=`, `/mlb/hitter-vs-pitcher?pitcherId=`, `/mlb/k-per-alt?year=`, `/mlb/lineup?team=`, `/mlb/pitch-distribution/`, `/mlb/pitch-location-chart?hitterId=`, `/mlb/pitcher-splits-by-year?playerId=`, `/mlb/team-offense?team=`, `/mlb/team-records`, `/mlb/weather?date=`, `/multi-league/matchup-rating?opponentTeam=`, `/multi-league/search?league=`, `/nba/play-type?playerId=`, `/ncaaf/conferences`, `/ncaaf/returning-production/`, `/ncaaf/team-defense?team=`, `/nfl/matchup-overview?`, `/nfl/trench-stats`, `/nhl/linemates?playerId=`, `/nhl/shot-chart?team=`, `/nhl/shot-outcomes?player=`, `/nhl/special-teams`, `/preferences/pinned-props?league=`, `/wnba/play-type?playerId=`.

Further path strings in the same chunk, used as `/{league}{path}` rather than as one batched body:

`/player-feed?playerId=`, `/player-insights?playerId=`, `/player-line-history?playerId=`, `/player-correlations?playerId=`, `/player-books?playerId=`, `/player-minute-avg?playerId=`, `/player-participation?playerId=`, `/dynamic-hitrates?`, `/dynamic-hitrates-trending?limit=5`, `/def-vs-pos-rankings?…`, `/depth-chart?team=`, `/game-boxscore?gameId=`, `/game-lines`, `/historical-lines?team=`, `/market-movers?`, `/past-games?team=`, `/position-defense-hit-rates?`, `/roster?team=`, `/roster-activity?playerId=`, `/schedule`, `/slate-cards`, `/snapshot?`, `/streaks?`, `/stream?`, `/top-performers`, `/watchlist`, `/pinned-props`, `/projections`, `/lines`, `/markets`.

A player dashboard fills missing players with `Promise.all` of `gq("/" + league + "/player-feed?playerId=" + id)`. That is parallel per-player GETs, not one POST body.

NBA-only static file, in chunk `817`:

```text
"NBA"===n.toUpperCase() && fetch("https://s3.us-east-1.amazonaws.com/cash.props.nba/general/players.json")
```

From this environment that URL returned `403` from Amazon S3. The URL is confirmed; a public `200` was not.

Live odds client, also in chunk `817`:

```text
xn = env.REACT_APP_LIVE_API_URL || "https://live.props.cash"
gn = ("true" === env.REACT_APP_LIVE_API_ENABLED)
bn = new Set(["nba","wnba"])
Fn(league) = xn + "/v1/" + league + "/stream?"
```

The inlined env object ends at `REACT_APP_API_URL`. It does not contain `REACT_APP_LIVE_API_URL` or `REACT_APP_LIVE_API_ENABLED`, so both reads are `undefined`, `gn` is false, and `yn(league)` is false for every league. The stream code is still present: `fetch` with `Accept: text/event-stream`, `Authorization: Bearer`, optional `Last-Event-ID`, and an `AbortController` signal. Reconnect delay is `Math.min(Math.round(1.5 * Y.current), 30000)` with jitter (`1 + 0.5 * (2 * Math.random() - 1)`). A `setInterval` every `5000` ms is the stream watchdog. After repeated failure it calls `p("streamRetry", …, 60000)`. There is no `WebSocket` constructor and no `EventSource` in `main.c4f0e042.js`, chunk `817`, or chunk `588`. The word `batch` in chunk `588` is React's `unstable_batchedUpdates`. The word `viewport` there is layout measurement (`viewportWidth` / `viewportHeight`), not a data prefetch.

`setInterval` in `main.c4f0e042.js` is the Auth0 popup poll, not a stats poll.

**Assumed.** While logged in, the board stays fresh because many small JSON calls land in React state (and, when `gn` is turned on for NBA/WNBA, because the SSE snapshot replaces that state). That cache is component state. Nothing in the bundles is a normalized query cache.

### 2.4 HTTP cache, client cache, prefetch

**Confirmed.**

| Resource | Cache-Control |
|---|---|
| HTML shell | `no-cache` (revalidate, do not store as fresh) |
| `/static/js/main.c4f0e042.js`, `/static/css/main.c29c4d2e.css` | `public, max-age=31536000, immutable` |
| `/manifest.json`, `/asset-manifest.json`, `/index.css` | `public, max-age=3600` |
| `https://classic.props.cash/` | `public, max-age=0` |
| API `401` and live `401` | no `Cache-Control` on the responses seen here |

HTML also preconnects `https://d3h3srgdkbxwlh.cloudfront.net` and `https://propsdotcash-assets.s3.amazonaws.com`. The string `prefetch` does not appear in chunk `817` or chunk `588`. There is no `<link rel="prefetch">` in the shell. The only early fetch of the league UI is the Auth0-key check above.

No `indexedDB`, `serviceWorker`, `workbox`, `react-query`, or `useSWR` in those bundles. One `AbortController` in chunk `817` (the live fetch). `AbortController` hits in `main.c4f0e042.js` are the polyfill plus a fetch timeout, not a screen-level request cache.

**Assumed.** Hashed immutable assets are why repeat visits skip JS and CSS. API payloads are kept in React state for the session and are not HTTP-cached; the `401` responses are not proof of the `200` headers. A logged-in `Cache-Control` on `api.props.cash` is unknown.

### 2.5 Skeletons and loading

**Confirmed.** Chunk `817` contains the class `animate-pulse` 33 times and one id prefix `skeleton-`. `main.c29c4d2e.css` contains the string `skeleton` zero times, so the pulse styling is utility CSS (Tailwind `animate-pulse`) rather than a class named skeleton. Route chunks mount under `Suspense` (`main.c4f0e042.js`). Player views take an `isLoading` prop (the symbol `U` defaulting to false in the dashboard function that also reads `savedState`).

**Assumed.** The pulse blocks are the skeletons a user sees while `player-feed` and the other GETs resolve. The fallback node passed to each `Suspense` was not extracted line by line.

### 2.6 State persistence (URL, localStorage, sessionStorage)

**Confirmed** from the bundles.

`localStorage` keys:

| Key | Where | Behaviour |
|---|---|---|
| `theme` | inline script in the HTML, before paint | `"dark"===localStorage.theme` toggles `class="dark"` on `<html>` |
| `oddFormat` | `main.c4f0e042.js` | `"decimal"` vs `"american"` |
| `customerData` | `main.c4f0e042.js` | defaults to `"NBA"` when unset |
| `globalTabs` | `main.c4f0e042.js` | JSON list of views, default `[{id:1,label:"View 1",active:true,playerId:null}]` |
| `league` | chunk `817` | last league; switching league also `removeItem(league + "_selected_game")` |
| `propsBoardViewMode` | chunk `817` | `"hitRates"` or `"charts"` |
| `pc.recentPlayers` | chunk `817` | recent players, capped |
| `pc.classicBanner.dismissed` | chunk `817` | `"1"` hides the classic banner |
| `@@auth0spajs@@…` | `main.c4f0e042.js` | Auth0 cache; presence preloads `LeagueRoutes` |
| two flag keys read as `"0"` / `"1"` | chunk `817` | panel toggles; the key names are minified locals (`Ly`, `Dy`) |

`sessionStorage` keys in chunk `817`:

- `leagueHomeState_{LEAGUE}`: filters, written when leaving the board for a player (`savedState` on the history state is preferred when present). Read on the way back, then removed.
- `filtersPanel_{league}`: `"true"` / `"false"`.
- `playerDashboard_{id}`: JSON for that player.
- `playerDashboard_scrubbedInterval`: `{minDate, maxDate}`.

The URL is the route (`/nfl/{playerId}`), not a query-string copy of every filter. Filters travel in `history.push` state plus `sessionStorage`.

**Assumed.** A shared link to `/nfl/{playerId}` opens that player with default filters, while the back button restores the board. That matches the `savedState` push and the `leagueHomeState_` read. It was not exercised while logged in.

### 2.7 Service worker, manifest, PWA

**Confirmed.**

`GET https://props.cash/manifest.json` → `200`, `content-type: application/json`, `cache-control: public, max-age=3600`, `content-length: 1408`, `last-modified: Mon, 26 Oct 2026 19:35:06 GMT`. Body: `short_name` `Props.Cash`, `display` `standalone`, `start_url` `/`, `theme_color` `#000000`, `background_color` `#0f0f0f`, any + maskable icons, `prefer_related_applications: true`, Play id `cash.props.app`, iTunes id `1606752641`.

These URLs all return the HTML shell (`content-type: text/html`, `content-length: 3660`, etag `W/"e4c-FbnUnMRyDbEMHmdCNNZ+5/ES0u0"`), which is the SPA fallback, not a worker:

- `https://props.cash/sw.js`
- `https://props.cash/service-worker.js`
- `https://props.cash/serviceworker.js`
- `https://props.cash/static/js/service-worker.js`

`serviceWorker` and `workbox` occur 0 times in `main.c4f0e042.js` and chunk `817`.

**Assumed.** Install is meant to go to the native apps (`prefer_related_applications: true`). The manifest would still allow a standalone window if a browser offered one. There is no offline shell.

### 2.8 Mobile and responsive layout

**Confirmed.**

- Viewport: `width=device-width,initial-scale=1,viewport-fit=cover`. `theme-color` `#0F0F0F`. `color-scheme` `dark`.
- Safe area is inline in chunk `817`, not in the CSS file: `paddingBottom:"max(env(safe-area-inset-bottom), 12px)"`. A header uses height `44` and `paddingTop` of `env(safe-area-inset-top) + 12px`. A bar is placed at `top: calc(env(safe-area-inset-top) + 12px + 44px + 8px)`.
- `matchMedia("(pointer: coarse)")` is used once, for a screenshot/export path, not as the layout breakpoint.
- Breakpoint strings `max-width: 767px` were not found as a single `Gn = {mobile, cards, wide}` object in the downloaded `817` (an earlier pass reported that object; this pass did not re-find the literal `767px` in that file). What is confirmed is the Tailwind screen list in CSS (section 2.2) plus `overscroll` on scroll panels (`overscroll` 4 times in the CSS).
- Legacy web fallback: `REACT_APP_LEGACY_WEB_URL || "https://classic.props.cash"`.

**Assumed.** Below the `md` breakpoint (768px) the board becomes a single column and the bottom padding clears the home indicator. That follows from the Tailwind classes and the safe-area padding. A phone viewport was not measured on props.cash for this note.

## 3. Cricket Props Hub on `main` (`13e0a85`)

Vanilla ES modules, no bundler, no runtime npm dependency (`site/package.json`: `"test": "node --test …"`, Node `>=20`). Numbers come from `site/public/js/engine`. `POST api/ask` only returns a sanitized plan (`site/api/ask.js` sets `Cache-Control: no-store`). Data files are generated by `python -m cricket_site.build` and are not committed. Deploy is static `public/` plus one function (`site/vercel.json`, `framework: null`). `docs/REACT_MIGRATION_PLAN.md` is a plan; it says nothing has been started.

What already matches an app shell:

- **One document.** `site/public/js/app.js` listens for `hashchange` and replaces `#app`. `vercel.json` rewrites `/(.*)` to `/`, and `pathToHash()` turns `/player/123` into `#/player/123`. The header and the phone tab bar stay in `index.html`.
- **A player screen.** `playerapp.js` builds a sticky bar, an Ionic segment rail, a bottom sheet, and Lines / Game log / Splits. `app.css` hides the site header, freshness bar, and footer under 767px while `body.app-screen` is set (`render()` adds that class only for `player`).
- **Motion, with a fallback.** `motion.js` loads `motion@11.18.2` from jsDelivr and no-ops when the CDN fails or `prefers-reduced-motion: reduce` matches. `ionic.js` loads `@ionic/core@8.8.0` the same way and falls back to buttons and `<dialog>`.
- **Some memory cache.** `Store.shard()` stores the in-flight promise in a `Map`, so a shard is fetched once. `loadLines()` stores one promise for the visit (`linesDoc`).
- **Some URL state.** `go()` writes the hash query. Player line, side, and tab are written with `history.replaceState` inside `playerScreen`. Same-route filter changes keep scroll (`lastRoute` in `render()`). Stars use `localStorage` key `cph-saved`.
- **A phone tab bar with safe-area padding.** `.tabbar` is `position: fixed` and uses `padding-bottom: env(safe-area-inset-bottom)` (`style.css`). At `min-width: 768px` the tab bar is hidden and `#nav` is shown. From 1280px the nav is a 268px left rail (`.ui-sidenav` in `ui.css`).
- **A page skeleton exists.** `PageSkeleton()` in `shadcn.js`.

## 4. Gap by gap

Each Props.cash technique, then the cricket behaviour on `main`, then why that still feels like a website.

### 4.1 Code splitting and a stable shell

Props.cash downloads the league UI only when a league route (or an Auth0 cache) needs it, and it keeps one React tree mounted. **Confirmed** for Props.cash (section 2.1–2.2).

Cricket loads `app.js`, which imports `pages2.js`, `playerapp.js`, `motion.js`, and `ionic.js`, on first paint. There is no webpack chunk and no `React.lazy`. The header survives, but `render()` does this on every route change (`app.js`):

```js
if (!same) app.replaceChildren(PageSkeleton());
const el = await page(args, q);
app.replaceChildren(el);
if (!same) enter([...(el.children || [])].slice(0, 12), { y: 10, gap: 0.03 });
```

`player()` does not return until `loadIonic()`, `loadLines()`, and `runPlan()` have all finished. Those are sequential. `loadLines()` may wait on GitHub for up to 3.5s (`AbortController` timeout). Home does not return until `sidebar()` has fetched `data/props.json`. The user sees either the static “Loading data…” line (boot, before `createStore` resolves `meta.json` + `index.json` + `matches.json`) or a full-page skeleton, then a new tree.

CSS also replays an entrance on every replacement: `main > div { animation: fadeUp .38s … }` in `style.css`. Motion’s `enter()` fades the same nodes again when the CDN loaded. Two animations on one navigation is why a tap feels like a page opening.

**Already better than a multi-page site:** the header and tab bar are not destroyed. **Still missing:** a shell that stays, with only the results region swapping, and a single short transition.

### 4.2 Many small API calls, parallel, then held in memory

Props.cash fans out per-player GETs and keeps the result in React state. **Confirmed** as call shape; the in-memory lifetime is **assumed** (section 2.3).

Cricket’s “API” is static JSON. The shard `Map` is the right idea and is **confirmed** in `store.js`. Three holes:

1. `playerRows()` scans the whole shard on every call. A filter change on a player re-walks the same arrays. There is no row memo.
2. `loadFixtures()` assigns only after `await`:

```js
async loadFixtures() {
  if (!this.fixtures) this.fixtures = await this.get("fixtures.json").catch(() => []);
  return this.fixtures;
}
```

Two callers before the first assignment both fetch. `home()` reaches this through `upcoming()`, and any other page that calls `loadFixtures()` in the same turn (boot does not) can race it. `sidebar()` does not; it only fetches `props.json`.
3. Prop Hunter is not shared. `sidebar()` fetches `data/props.json` on every home render. `props()` fetches `data/props.json` again and then `https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/value_bets_latest.json` with `cache: "no-cache"`. Book lines are the exception: `loadLines()` memoizes one promise. Props do not.

There is no websocket and no stats poll. The only `setInterval` in `app.js` is the next-match countdown (30s), and it clears itself when the node disconnects. That is display, not data.

**Why it feels slow:** opening Prop Hunter, or going home, always waits on the network even when the last response is a few seconds old. Opening a player always waits on the shard scan even when that shard was opened a moment ago.

### 4.3 HTTP caching

Props.cash: HTML revalidated, hashed JS/CSS immutable for a year. **Confirmed** (section 2.4).

Cricket `site/vercel.json`:

```json
{ "source": "/data/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] }
```

The catch-all header sets `nosniff` and `Referrer-Policy` only. `css/style.css`, `css/ui.css`, `css/app.css`, and `js/app.js` are unhashed filenames, so they cannot be `immutable` without serving a stale file after a deploy. `site/scripts/serve.mjs` sets no `Cache-Control` of its own. jsDelivr caches Motion and Ionic; that cache is not the site’s.

`max-age=0, must-revalidate` on `/data` is correct for an hourly rebuild only if every navigation should revalidate ~35 MB of JSON. Combined with section 4.2, a repeat visit still pays a request per file even when the body has not changed (ETag revalidation, not a stale-while-revalidate paint).

**Assumed.** Production Vercel merges these headers the way `vercel.json` writes them. This note did not fetch the live cricket deployment.

### 4.4 Prefetch

Props.cash preloads the league bundle only when Auth0 keys exist, and preconnects two asset hosts. No data prefetch string in the league chunk. **Confirmed.**

Cricket has no `prefetch`, no `<link rel="modulepreload">`, and no hover handler that calls `store.shard()`. The first time a player is opened is the first time that shard downloads. Photos are one `photos.json` fetch at boot (`assets.js`), which is eager, not a hover prefetch.

A `<link rel="preload" as="fetch">` for the big JSON files is a known footgun: Chrome will download the file for the preload and again for `fetch()` unless the credentials mode matches. That was observed while experimenting on the closed branch. It is not in `main`. Do not add preload links for `meta.json` / `index.json` / `matches.json`.

### 4.5 Skeletons that do not block the shell

Props.cash uses `animate-pulse` inside an already-mounted shell, plus `Suspense` around route chunks. **Confirmed** as code; the exact fallback UI is **assumed**.

Cricket’s skeleton replaces all of `#app` as soon as the route name or id changes (`if (!same) app.replaceChildren(PageSkeleton())`). A home day tab (`go("", { d })`) and a player stat change (`go(\`player/${idx}\`, …)`) stay on `lastRoute`, so they keep the old page and the scroll position until the new tree is ready. A cross-route tap (home → player → Prop Hunter) always flashes the full skeleton, and that skeleton stays up until the slowest await in the page function returns. `player()` has no intermediate paint: the sticky bar is built only inside `playerScreen()`, which runs after `runPlan`.

`Skeleton()` exists and is used by `PageSkeleton`. It is not used as a placeholder inside an already-visible player or fixture layout.

### 4.6 Persistence

Props.cash keeps theme, league, odds format, board view, and recent players in `localStorage`, and keeps board filters in `sessionStorage` plus `history.state`. **Confirmed.**

Cricket:

| State | Where it lives | Survives a navigation? |
|---|---|---|
| Starred players and teams | `localStorage` `cph-saved` | Yes |
| Player stat, format, line, side, tab, sheet filters | hash query via `go()` / `replaceState` | Yes, and the URL is shareable |
| Ask box text | `#/ask?q=` on submit | Yes |
| Home day | `?d=` when a day tab calls `go` | Yes |
| Home format chip (`state.f`) | a local object inside `home()`, reset to `"all"` on every `home()` call | No. A day tab calls `go("", { d: k })` and drops the chip |
| Players / teams / competitions search | input `value` is `q.q` if the URL already has it; `input` events only redraw the list | No, unless something else wrote `?q=` |
| Glossary category chips | in-memory `st` | No |
| Competition page tab | `heroCard` calls `hc.set()` with no id (`leaguePage` in `pages2.js` does not take `q`) | No |
| Scroll on a different route | `render()` sets `scrollTo(0, 0)` when `lastRoute` changes | No |
| Focus in a `live()` field | `live()` submits the form, `go()` changes the hash, `render()` rebuilds the form | Focus is lost on every keystroke that submits |

The URL is the right place for a shareable player view. It is a poor place for “what I last typed in the players box”, which is why Props.cash uses `sessionStorage` for board filters and the URL for identity.

### 4.7 Service worker and manifest

Props.cash ships a manifest and points install at the native apps. It does not ship a working service worker. **Confirmed.**

Cricket has no `manifest.json`, no service worker, and no `beforeinstallprompt` handling. `index.html` has `theme-color` `#0b0c0d` and a data-URI favicon. Viewport is `width=device-width, initial-scale=1` without `viewport-fit=cover`, so `env(safe-area-inset-bottom)` on `.tabbar` is often `0` on iOS even though the CSS asks for it.

A service worker that cached `data/*.json` would fight the hourly rebuild: the worker becomes a second cache with its own freshness rules. That is the wrong copy of Props.cash. Their worker is absent on purpose, and their manifest prefers the stores.

### 4.8 Mobile layout

Props.cash sets `viewport-fit=cover`, pads for the safe area, and uses Tailwind screens down to 640px. **Confirmed.**

Cricket already has a tab bar, a left rail from 1280px, a player screen that hides the marketing header under 767px, and a brand size of 22px under 767px (`style.css`). Remaining layout issues, from the CSS rather than from a screenshot of production:

- `.cards2` is `repeat(auto-fill, minmax(320px, 1fr))` and `.two` is `minmax(300px, 1fr)`. On a 320–360px wide phone those tracks overflow the padding.
- The top row still shows brand, search, and the Ask link together under 767px (`.top .cta` is not hidden). `#nav` is `display` none until 768px, which is correct, but the search field and Ask compete with a 22px wordmark.
- `.ui-tabs` is `gap: 2px` (the shadcn pill). `.hero-tabs` later sets `gap: 6px` and the pill-rail rules restyle the selected tab. Hero tabs are not the crushed 2px row from before PR #41. They are still a horizontal scroller of 40px pills, not the underline indicator Props.cash animates.
- Fonts are a render-blocking Google CSS request (`Bebas Neue` and `Manrope` in `index.html`). Props.cash does not do that in the shell that was fetched; its UI font is whatever the compiled CSS sets, and the shell paints `#0f0f0f` immediately.

**Assumed.** The 320px grid overflows on a real phone. It follows from `minmax(320px, 1fr)` plus page padding. It was not re-measured in a browser for this document.

## 5. What would close each gap

Ordered by how much of the “this is a website” feeling they remove. None of this is implemented here. A React rewrite (`docs/REACT_MIGRATION_PLAN.md`) is not required for any of these.

| Priority | Gap | Change | Files |
|---|---|---|---|
| 1 | Shell torn down on every route | Keep `#app` mounted. Start a render generation counter so a slow page cannot overwrite a newer one. Show `PageSkeleton` only if the page is still pending after ~150ms. On `popstate`, restore `scrollY`. | `site/public/js/app.js` (`render`, `boot`) |
| 2 | Player and home wait on the slowest fetch before any paint | `player()` should append the sticky bar and rail first, then fill the chart when `runPlan` resolves. Home should paint fixtures before `sidebar()` resolves. Fixture and trends pages in `pages2.js` should paint the title and form before `collectGrid` / `Promise.all`. | `app.js` `player`, `home`, `sidebar`; `pages2.js` `fixturePage`, `trendsPage`; `playerapp.js` only if the shell must render with `res === null` |
| 3 | Prop Hunter and fixtures refetched constantly | One module-level promise for `props.json` + the GitHub file, reused for a few minutes (the pipeline is hourly). Fix `loadFixtures` by storing the promise before awaiting. Memoize `playerRows` / `pairRows` per player id for the session. | `app.js` `sidebar`, `props`; `store.js` `loadFixtures`, `playerRows`, `pairRows`. `loadLines()` is already the pattern to copy |
| 4 | Repeat navigations revalidate every JSON file | `/data`: `public, max-age=300, stale-while-revalidate=3300` so a click paints cached JSON and revalidates inside the hourly build. HTML: `max-age=0, must-revalidate`. Leave `/js` and `/css` on a short max-age until filenames are hashed. Do not preload the JSON files. Mirror the headers in the local server so dev matches deploy. | `site/vercel.json`, `site/scripts/serve.mjs`. Docs: `docs/SITE.md`, `docs/PROJECT_GUIDE.md` section 9 |
| 5 | Filters and search forgotten | `sessionStorage` for home chip, players/teams/competitions/glossary search, and the competition tab. If the URL already has a query, the URL wins, so a shared link stays exact. Stars stay in `localStorage`. | `app.js` `home`, `playersPage`, `teamsPage`; `pages2.js` `competitionsPage`, `leaguePage`, `glossaryPage`. A tiny helper next to `ui.js` is enough; no new dependency |
| 6 | Double entrance animation | Keep one: either the CSS `fadeUp` on `main > div` or `enter()` from `motion.js`. Prefer the CSS animation (it does not wait on jsDelivr) and stop calling `enter()` on full pages. Keep `growBars` for the chart. Respect the existing `prefers-reduced-motion` rule. | `app.js` `render`; `style.css` `fadeUp`; `motion.js` |
| 7 | No hover prefetch | On `pointerover` / `focus` of an `a[href^="#/player/"]`, call `store.shard(store.shardOf(id))`. The `Map` already dedupes. | `app.js` after `boot` |
| 8 | Phone layout and safe area | Add `viewport-fit=cover` next to the existing viewport meta. Change `.cards2` and `.two` to `minmax(min(100%, 280px), 1fr)`. Hide `.top .cta` under 767px if the search field is present. Optionally set `theme-color` to the same `#0f0f0f` the player screen already uses (`--pc-bg` in `ui.css`). | `site/public/index.html`, `site/public/css/style.css` |
| 9 | PWA | Do not add a service worker. A manifest with `display: standalone` is optional and low value: the data must stay hourly, and Props.cash itself prefers the native apps. | none, unless a later decision asks for install |

Out of scope for “make it feel like an app”, and called out so they are not smuggled in:

- Rewriting the engine or moving to Vite, TanStack Query, or React. The plan in `docs/REACT_MIGRATION_PLAN.md` can stay a plan.
- Copying Props.cash’s per-endpoint API. Cricket has no equivalent of `/player-feed`; the shard files are the API.
- Turning on anything like their SSE client. Lines and value bets are hourly files. Polling them faster than the pipeline publishes would not be fresher.
- A service worker, IndexedDB, or `immutable` on unhashed `/js` and `/css`.

## 6. Evidence index

Props.cash files fetched on 26 October 2026:

- `https://props.cash/nfl/cfc93f5e-105e-4a5e-88d3-f4279893cfa8` and `https://props.cash/` (same HTML etag).
- `https://props.cash/static/js/main.c4f0e042.js`
- `https://props.cash/static/css/main.c29c4d2e.css`
- `https://props.cash/static/js/817.b524f82d.chunk.js`
- `https://props.cash/static/js/588.3829c212.chunk.js`
- `https://props.cash/static/js/860.b8dd90b9.chunk.js`
- `https://props.cash/manifest.json`, `/asset-manifest.json`, `/index.css`
- `https://props.cash/sw.js`, `/service-worker.js`, `/serviceworker.js`, `/static/js/service-worker.js` (all HTML)
- `https://api.props.cash/nfl/matchup-overview` (401)
- `https://live.props.cash/v1/nfl/snapshot` (401, `{"error":"missing"}`)
- `https://s3.us-east-1.amazonaws.com/cash.props.nba/general/players.json` (403 from this environment)
- `https://classic.props.cash/` (`max-age=0`)

Cricket files read at `13e0a85`:

- `site/public/index.html`
- `site/public/js/app.js`, `playerapp.js`, `pages2.js`, `motion.js`, `ionic.js`, `shadcn.js`, `assets.js`, `ui.js`
- `site/public/js/engine/store.js`
- `site/public/css/style.css`, `ui.css`, `app.css`
- `site/vercel.json`, `site/package.json`, `site/api/ask.js`
- `docs/SITE.md`, `docs/PROJECT_GUIDE.md`, `docs/REACT_MIGRATION_PLAN.md`
