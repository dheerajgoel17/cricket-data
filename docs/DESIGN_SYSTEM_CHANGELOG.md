# Design system changelog

Append-only history of shared UI components, tokens, and catalogue stages. Newest first.
Agents and humans: add an entry in the same PR as the change (see `.cursor/rules/design-system-centralization.mdc`).

## Format

```
### YYYY-MM-DD — Component or token name
- **Path:** `site/src/...`
- **Change:** what landed (API, visual, token, catalogue)
- **Callers:** where it applies / what to re-check
- **PR:** #N (optional)
```

---

### 2026-11-21 — Directory and statistics pages
- **Path:** `site/src/components/app/forms.tsx`, `site/src/components/app/result.tsx`, and the generated design inventory
- **Change:** Reuses one search input and clear action across the site directories. Empty directories use EmptyState. Shared analytics results use the same hairline heading and table rhythm as fixture and player stats.
- **Callers:** Players, Teams, Venues, Competitions, Glossary, Partnerships and Team Markets

### 2026-11-21 — Team batting leaderboard
- **Path:** `site/src/pages/Markets.tsx` and the generated design inventory
- **Change:** Uses the shared DataTable, PlayerName and OddsText for linked batting leaders. The format and sample appear once next to the table. Batting-first scope and tie treatment stay visible.
- **Callers:** Team detail, Top batter tab

### 2026-11-21 — Team detail layout
- **Path:** `site/src/pages/Markets.tsx` and the generated design inventory
- **Change:** Team detail uses the shared EntityHero, StickyFilterBand, format pills, section tabs, GridTable, and FixtureCard. The selected format applies across Player grid, Markets, and Top batter. The next fixture uses the same card as Home.
- **Callers:** `/team/:id` on web

### 2026-11-21 — Match Fancy list: scope stays on table
- **Path:** `site/src/components/app/match-fancy.tsx`
- **Change:** List-mode Match / AUS / ENG scope chips write only `sc` (clear `fm`). Writing `fm` previously tripped Fixtures’ `?tab=fancy&fm=` → `/fancy` redirect.
- **Callers:** Fixture Match Fancy tab

### 2026-11-21 — Ground: match phase tabs + stack rhythm
- **Path:** `site/src/lib/ground.ts`, `site/src/components/app/fixture-ground.tsx`, `mobile/src/ui/ground-page.tsx`
- **Change:** Matches list splits into Resulted / In play / Scheduled (`partitionGroundMatches`); panel major blocks use `gap-stack`; metrics bleed edge-to-edge; secondary fact rows drop forced `min-h` so they match the 2×2 Fact padding. Fixture embeds prefer live/scheduled.
- **Callers:** Fixture Ground chip, `/fixture/:id/ground`, `/venue/:id`, mobile Ground page

### 2026-11-21 — Fixture Match Fancy: edge hairline + stack rhythm
- **Path:** `site/src/components/app/match-fancy.tsx`, `hot-props.tsx`, `pages/Fixtures.tsx`, `mobile/src/ui/match-fancy.tsx`
- **Change:** Scope / L10 filter `border-b` bleeds edge-to-edge (`-mx-gutter` + `px-gutter`, app twin). Fixture page vertical rhythm uses `gap-stack` (between) instead of `gap-section` under the scoreboard hairline.
- **Callers:** Fixture Match Fancy + Props filter rows; fixture loading skeleton

### 2026-11-21 — MarketTape removed from product
- **Path:** `site/src/components/app/hot-home.tsx`, `hot-props.tsx`, `mobile/src/ui/hot-home.tsx`, `mobile/src/lib/use-hot-home.ts` (deleted `market-tape.tsx` twins)
- **Change:** High odds hits / low odds misses UI removed from Home and Props. Engine `tape.js` kept for alerts/settlement helpers.
- **Callers:** none in product chrome

### 2026-11-21 — Nav: drop Saved, Contact, More
- **Path:** `site/src/components/layout/nav.ts`, `Shell.tsx`, `Header.tsx`, `IosTabBar.tsx`, `home-phase-bar.tsx`, `mobile/src/lib/tabs.ts`, `mobile/src/ui/phase-bar.tsx`, `App.tsx`
- **Change:** Bottom tabs and sidebar are Fixtures / Props / Fancy / Leagues only. Removed Saved and Contact pages/tabs, header Saved link, sidebar More group, and Home More sheet (web + app). Old `/saved` and `/contact` redirect home. Watchlist starring + `lib/saved` remain.
- **Callers:** Shell, IosTabBar, Home phase bar, mobile TabBar / PhaseBar, GlobalSearch / app search, auth post-sign-in default

### 2026-11-21 — Ads: clear slot catalogue and product mounts
- **Path:** `site/src/lib/ad-slots.ts`, `AdSlot` / `StatsAd` call sites, `IosTabBar`, `supabase/migrations/20261121_clear_ad_slots.sql`
- **Change:** Removed all product `AdSlot` / `StatsAd` mounts and emptied `AD_SLOTS` (wrong inventory map). Prod `ad_placements` / `ad_slots` cleared; admin + `AdSlot` infra kept for a remapped catalogue.
- **Callers:** none until remount; `/admin/ads` shows empty-catalogue state

### 2026-11-20 — Book mark: VBET (Feed L)
- **Path:** `site/public/books/books.json`, `site/public/books/vbet.png`, `site/packages/engine/books.js`
- **Change:** Feed L's published book mark is VBET (`vbet.png`); removed the temporary Swarm stem/svg. Manifest-driven — apps pick it up from `books.json` without a native update.
- **Callers:** book badges / odds tables wherever `bookLogo` / `BOOK_STEMS` resolve a feed source

### 2026-11-15 — AndroidAppBanner: session dismiss + hide when installed
- **Path:** `site/src/components/app/android-app-banner.tsx`, `site/src/lib/android-app.ts`, `site/public/manifest.webmanifest`, `site/public/.well-known/assetlinks.json`
- **Change:** × collapses for this visit only (`sessionStorage`); next visit shows the promo again. Banner stays hidden when Chrome reports package `cash.fancy.app` already installed (`getInstalledRelatedApps` + related_applications + Digital Asset Links). Download still resolves the latest release `.apk`.
- **Callers:** product shell + design-system catalogue (`force` preview)

### 2026-11-15 — AndroidAppBanner smart-banner layout
- **Path:** `site/src/components/app/android-app-banner.tsx`
- **Change:** restyled like an OS smart app banner: brand mark · title + blurb · Download · dismiss × last on the right; strip uses `bg-primary` / `text-primary-foreground`; Download resolves the latest GitHub release `.apk` (not the releases page)
- **Callers:** product shell + design-system catalogue (`force` preview)

### 2026-11-15 — AndroidAppBanner (mobile web install strip)
- **Path:** `site/src/components/app/android-app-banner.tsx`, `site/src/lib/android-app.ts`, `components/layout/Shell.tsx`, catalogue `DesignSystem.tsx`
- **Change:** dismissible banner above the sticky header on Android phone browsers only (`lg:hidden`); opens `VITE_ANDROID_APP_URL` or the latest GitHub release; dismiss persists in `localStorage`; analytics `android_app_banner` open/dismiss
- **Callers:** product shell (web); no native twin (the app is the destination)

### 2026-11-15 — Web: page wash through the chrome; visible form controls
- **Path:** `site/src/lib/header-slot.tsx` (`usePageWash`, `usePageWashColor`, `useScrolled`), `components/app/hero-wash.tsx` (`page`), `components/layout/Shell.tsx` (`PageWashLayer`, sidebar), `components/layout/Header.tsx`, `components/app/page.tsx` (`StickyFilterBand`), `pages/Player.tsx`, `pages/Markets.tsx`; tokens `input`
- **Change:** an entity page's tint (player, team) is a page-level layer behind the sidebar, the header, the breadcrumbs and the sticky chips, so the colour flows through them like the app's clear header; they turn solid once the page scrolls. Form control borders (`input`) were #1c1c1e on #1c1c1e cards (invisible); now #6c6c70, 3.25:1 on cards (WCAG 1.4.11), with a contrast test.
- **Callers:** Player, Team (Markets) pages; every input, select, checkbox and textarea

### 2026-11-15 — Scrolling rows run edge to edge (no fade)
- **Path:** mobile `ui/h-scroll.tsx`; web `components/app/scroll-row.tsx`, `pill-group.tsx`, `index.css` (`scroll-fade-x` and `hooks/useScrollFade.ts` removed)
- **Change:** the gradient / mask that dissolved chips at a scrolling row's edge is gone on both platforms: chips and tabs run edge to edge and the screen edge cuts them cleanly. `HScroll` stays the one horizontal row component. JavaScript-only: ships over the air.
- **Callers:** every chip, tab and active-filter row

### 2026-11-15 — Foundations: contrast, states, icons, grid, elevation, Figma export, OTA
- **Path:** `site/packages/tokens/` (`tokens.json` +`state` +`icon` +`grid` +`elevation_native`, `grid.js`, `dtcg.js`, `tokens.dtcg.json`), mobile `ui/tokens.ts` (`state`, `icon`), `ui/platform.ts` (`elevation`), `ui/grid.ts`, `site/tests/contrast.test.mjs`, `mobile/app.config.js`, `src/lib/ota.ts`, `scripts/ota-check.mjs`
- **Change:** `muted-foreground` raised from #8e8e93 to #98989d (it was 4.27:1 on the secondary fill; AA needs 4.5:1; a test now holds every text colour to it). Pressed / disabled / dim opacities are tokens (the app used 0.5 to 0.92 for the same job); icon sizes are a 4-step scale (12 / 16 / 20 / 24); a column grid (4 / 8 / 12) with a shared pure helper tested against `CardGrid`; shadows come from elevation tokens; tokens export as W3C Design Tokens for Figma; the app can receive JavaScript updates over the air (`expo-updates`, free) and `scripts/ota-check.mjs` says whether a change needs a new APK
- **Callers:** every app screen (icon sizes, pressed state); muted text on both platforms gets slightly lighter

### 2026-11-15 — Tokens: size roles, surface colours, radii, platform conventions
- **Path:** `site/packages/tokens/tokens.json` (`color` +chrome-solid / control-fill / control-ring / tile / segment-track / segment-thumb / ink-soft / skeleton / text-soft; `type` +fs-figure; new `platform` group), `site/src/index.css` (`text-figure`), mobile `ui/tokens.ts` (`fs`, `radius.sm` / `control`), `ui/platform.ts`, `ui/press.tsx`, `ui/tokens.test.ts`; web `components/app/recent-form.tsx`
- **Change:** The app no longer writes a literal `fontSize`, hex or rgba (≈60 sizes, ≈54 colours, scattered radii moved onto the shared roles; a test fails the build on a new one). Sizes that sat between roles (14 / 16 / 17 / 22 / 34) snapped to the nearest role (callout 13, body 15, title 18, figure 24, stat 30). Platform idioms are explicit: Material ripple on full-width Android rows, platform touch targets, elevation for Android shadows. Form chips W / L / T use the same tokens on web and app.
- **Callers:** every app screen (type sizes shift by ≤ 2 pt); web `RecentForm`; catalogue docs
- **Chips, buttons, text roles, motion:** `FilterButton` replaces the hand-built Filters button (3 on the app, 7 on the web); `Button` (primary / secondary) replaces 8 hand-styled buttons at 3 heights; `SearchField`; `ActiveChip` / `ChoiceChip` replace duplicates; text goes through named roles (`t` / `d` / `dStrong` / `w`, 273 styles, no raw font family in screens); `useChoice` makes every chip, tab and segmented control answer in the tap's own frame; `Reflow` (app) / `ReflowGroup` (web) animate list reorder and removal; Ground and Home layouts follow the web (line tabs and chips; the fixture rail scrolls away)
- **Rhythm / weight / surface:** page bodies use one rhythm (within 10, between 16, section 32, top 16, inline 14: `rhythm`); about 30 secondary numbers moved from Barlow Bold to Medium and section / sheet titles to `type.heading` (bold stays for names, scores, hero lines, prices, tags); one `surface.card` replaces the `tonal` wash and the hand-written card pair; `HScroll` / `ScrollRow` fade scrolling rows at the edges
- **Also:** one `Sheet` (+ `SheetBackdrop`, `Grabber`) replaces five hand-built modals; one `RoundButton` replaces six hand-styled 40 pt circles; text now honours the OS font size up to 1.3x iOS / 1.2x Android (was ignored)

### 2026-11-15 — Universal page-header ↔ canvas merge
- **Path:** mobile `ui/blur-bar.tsx` (`merge` + `useChromeScrim`); `app/player/[idx].tsx`; `app/fixture/[id]/index.tsx`; `app/team/[idx].tsx`; stack roots (`league`, fancy detail, `competitions`, `search`, `ground-page`, venue/ground loaders) via `PageAtmosphere`
- **Change:** Sticky clear→solid scrim is shared (not player-only). Fixture uses `BlurBar merge` so Android no longer keeps a permanent solid slab at rest. Stack/detail pages wrap `PageAtmosphere` so `PageHeader` sits on the same elevated canvas. Team hero wash underlaps the clear header. Tabs keep transparent `AppHeader` + hairline.
- **Callers:** All user-facing stack screens; Player / Fixture sticky bars; Team; docs MOBILE / DESIGN_SYSTEM

### 2026-11-15 — Mobile: no liquid glass (solid BlurBar + JS Segmented)
- **Path:** `mobile/src/ui/blur-bar.tsx`; deleted `segmented.ios.tsx`; `segmented.tsx`; dropped `expo-blur`
- **Change:** Header chrome is solid elevated on every platform (no `BlurView` / system material). iOS uses the shared JS `Segmented` (no SwiftUI glass Picker). Merge/accent clear-at-rest + `useChromeScrim` unchanged. Tab bar already docked solid.
- **Callers:** Fixture / Player sticky headers; every `Segmented` (Ground, Player, Market tape, League, Team, live board)

### 2026-11-15 — Industry hero atmosphere (hero wash, not screen wash)
- **Path:** mobile `ui/page-atmosphere.tsx` (`PageAtmosphere` canvas-only + `EntityHeroWash`); `app/player/[idx].tsx`; `app/team/[idx].tsx`; `ui/blur-bar.tsx` (`accent` clear); web `components/app/hero-wash.tsx`; `pages/Player.tsx`; design-host HeroWash stage
- **Change:** Entity tint lives in the scrolling hero (`EntityHeroWash` / `HeroWash`), not a fixed screen wash. Sticky chrome is clear at rest over the hero band, then solid elevated once scroll past measured hero height — no bar gradient, no wash fade-out / slide hacks. Web player: solid `StickyFilterBand`; wash only around identity hero. Team page uses the same hero-bound wash.
- **Callers:** Player / Team (web + app); `/design-system` HeroWash; docs MOBILE / DESIGN_SYSTEM

### 2026-11-15 — Fixture scoreShell + native filter chrome (not blind web sticky)
- **Path:** mobile `fixture/[id]/index.tsx` (`scoreShell` + accordion); `live-board.tsx` / `accordion.tsx` (`flush`); `match-fancy.tsx` / `ground-page.tsx` Top batter edge bands; Fancy detail keeps `MatchHeader`
- **Change:** Keep web-aligned **scoreboard plane** (full-bleed card + accordion in shell). Do **not** copy web `StickyFilterBand` onto app: sticky under BlurBar hides content; pinning Props chip stack outside FlashList eats viewport; Fancy detail needs MatchHeader on the stack screen; Ground sticky stays the short section control only. Top batter lists use edge `border-y`.
- **Callers:** Fixture hub / Fancy detail / Props / Ground; docs note native vs web sticky

### 2026-11-15 — Fixture scoreboard edge-to-edge shell (app)
- **Path:** mobile `app/fixture/[id]/index.tsx` (`scoreShell`); `ui/live-board.tsx` (`ScorecardCard` / `LiveBoard` `flat`); `ui/match-header.tsx` (`bare` internal gutter)
- **Change:** App fixture scoreboard matches web flush card plane: full-bleed `color.card` + bottom hairline; live strip full-bleed `border-t` + secondary wash + gutter; full-scorecard trigger full-bleed `border-t` (no negative-margin-only hairline rules). Non-live header uses the same shell.
- **Callers:** Fixture live / non-live header

### 2026-11-15 — LineTabs clear wrap; blended atmosphere chrome
- **Path:** mobile `ui/line-tabs.tsx`; `ui/blur-bar.tsx` (`accent`); `ui/page-atmosphere.tsx`; player sticky chrome `barH` + scroll scrim
- **Change:** LineTabs wrap stays transparent. Atmosphere `BlurBar accent` is clear (no second header gradient) so one `PageAtmosphere` wash blends at rest. On scroll, player fades in a solid elevated scrim and fades the hero name with the sticky title so content does not bleed under the chrome.
- **Callers:** Player sticky chrome; Home `PhaseBar`

### 2026-11-15 — Elevated canvas + page atmosphere
- **Path:** `site/packages/tokens/tokens.json` (`background` / `sidebar` → `#0C0C0E`); `engine/entity-accents.js`; mobile `ui/page-atmosphere.tsx`; web `components/app/hero-wash.tsx`; splash / `app.json` / `BlurBar` Android tint
- **Change:** Shared canvas off true black. Optional partial top hero wash (fade to transparent) for player/team from curated side accents; unknown sides use soft brand wash. Tabs/lists stay solid elevated. No full-page gradients; no runtime jersey sampling. Player sticky chrome: `BlurBar accent=` (app) and `HeroWash` around StickyFilterBand + hero (web) so the wash covers the header band too.
- **Callers:** All surfaces via token; Player / Team heroes (web + app); design-host atmosphere stage

### 2026-11-15 — LiveMarketRow: score Edge + L10 from overs tape
- **Path:** `engine/inplay-lines.js` (`parseLiveOu`); `engine/fancy-edge.js` (`scoreLiveOuRow`); `live-markets.tsx` / mobile `live-market-row`; Match Fancy (web + app)
- **Change:** In-play-only stretch-of-overs markets reuse CompactFancyItem / OverviewRow with In Play Market. `scoreLiveOuRow` parses the feed name onto `overs_N` (+ side/innings) and scores Edge + L10 from the same overs tape as scored fancy — no empty Edge/bars when history exists. No book logo in the title.
- **Callers:** Match Fancy Bookmaker lines; `inplay-lines` / `live-spot` tests

### 2026-11-15 — LiveMarketRow → CompactFancyItem (In Play Market)
- **Path:** `site/src/components/app/live-markets.tsx`; mobile `ui/live-market-row.tsx`
- **Change:** In-play-only Fancy (`liveRows`) no longer uses a separate tall O/U + book-logo row. Adapter maps onto CompactFancyItem / OverviewRow with `live: true` (same In Play Market badge as scored in-play fancy). No book logo in the title. Superseded for Edge/L10 by `scoreLiveOuRow` above.
- **Callers:** Match Fancy list (web + app); design-host row density; `live-spot.test.tsx`

### 2026-11-15 — Spacing/type governance: close GOVERNED gaps
- **Path:** `site/src/lib/design-tokens.test.ts`; `docs/DESIGN_SYSTEM.md` foundations row; `docs/DESIGN_SYSTEM_AUDIT.md`
- **Change:** Audit of web + app spacing/type/layout confirmed the shared `tokens.json` contract is already the single foundation. Enrolled four already-compliant product modules (`fancy-lines`, `home-mix-table`, `result-stamp`, `AuthCallback`) into GOVERNED so the token lint covers every product page/app component. No visual redesign; mobile micro-gaps of 2 px documented as intentional.
- **Callers:** CI `design-tokens.test.ts`; all product routes already on named roles

### 2026-11-15 — Tab pages: title in shell bar
- **Path:** `lib/header-slot.tsx` (`TabTitle`); `layout/Header.tsx`; `Lists` / `Leagues` / `Saved` / `Contact`
- **Change:** Shared `TabTitle` (app `AppHeader title=` twin) on every tab except Fixtures — phone swaps brand for the page name; `lg+` keeps brand + title. Top-level owned bars keep search/account. Fancy also gains day + match chips (`?day=` / `?match=`).
- **Callers:** `/props`, `/fancy`, `/leagues`, `/saved`, `/contact`

### 2026-11-15 — Fancy phone: card shell (web + app)
- **Path:** `pages/Lists.tsx` (`FancyCard`); mobile `(tabs)/fancy` (`MatchCard`); `fancy-row` (`OverviewRow` `inset`)
- **Change:** `/fancy` phone drops flat `-mx-gutter` hairline sections — same FixtureCard panel as desktop (`rounded-2xl bg-card ring`) at every width. App Fancy tab matches (`color.card`, `radius.card`). Zoned header `surface-raised` · rows · footer `surface`.
- **Callers:** `/fancy` CardGrid; app Fancy tab

### 2026-11-15 — Fancy cards: scores + play states
- **Path:** `pages/Lists.tsx` (`FancyCard`); mobile `(tabs)/fancy` (`MatchCard`); export `LiveScore` from mobile `fixture-card`
- **Change:** Fancy match chrome matches FixtureCard: Upcoming/Live/session/Started/Final `StatusLabel`, live totals (or kickoff), status line (in progress / Stumps day countdown / delayed / starts in / no score), series · last N, Fancy CTA. Same evidence rules via `playState` / `cardModel`.
- **Callers:** `/fancy` CardGrid; app Fancy tab

### 2026-11-15 — Fancy cards: scores + play states
- **Path:** `pages/Lists.tsx` (`FancyCard`); mobile `(tabs)/fancy` (`MatchCard`); export `LiveScore` from mobile `fixture-card`
- **Change:** Fancy match chrome matches FixtureCard: Upcoming/Live/session/Started/Final `StatusLabel`, live totals (or kickoff), status line (in progress / Stumps day countdown / delayed / starts in / no score), series · last N, Fancy CTA. Same evidence rules via `playState` / `cardModel`.
- **Callers:** `/fancy` CardGrid; app Fancy tab

### 2026-11-15 — Fancy edge-to-edge dividers (phone + desktop)
- **Path:** `pages/Lists.tsx` (`FancyCard`); `fancy-lines.tsx` (`inset`); mobile `(tabs)/fancy`
- **Change:** Hairlines meet the section/panel edge on every breakpoint. Phone: `-mx-gutter` section. Desktop: no shell `p-inset` (that inset the dividers); pad header / row copy / footer with `px-inset` only. Rows `bleed={false} inset={false}`. App: OverviewRow hairline only (no double sep).
- **Callers:** `/fancy` CardGrid; Match Fancy list unchanged

### 2026-11-15 — Fancy list CardGrid chrome
- **Path:** `pages/Lists.tsx` (`FancyCard`); `fancy-lines.tsx` (`bleed`); mobile `(tabs)/fancy`
- **Change:** `/fancy` cards stay **compact** (dense tables need a full page, not a CardGrid column). From `md`, panels match FixtureCard (`rounded-2xl` / `bg-card` / ring). Phone stays flat hairline sections. Live/session `StatusLabel` on the meta row; title uses `lg:text-display` like Props. `bleed={false}` drops `-mx-gutter` inside padded cards.
- **Callers:** Fancy directory; Match Fancy / Home keep `density=auto` + bleed

### 2026-11-15 — Fancy scope on meta line (with odds)
- **Path:** `fancy-edge.js` (`withLabel` → `innScope`); `FancyLineMeta`; mobile `fancy-row`
- **Change:** CMM / 1st INN / 2nd INN leave the fancy row title and sit on the scan meta beside O/U · line · odds — same place as props. Title stays team · market (and bat-first when needed). Market chips / detail titles still include the tag to tell innings apart.
- **Callers:** FancyLines, OverviewRow, Home mix, Match Fancy list

### 2026-11-15 — Short Test scope tags (CMM / 1st INN)
- **Path:** `engine/lines.js` (`SCOPE_TAG`, `scopeTag`); `engine/fancy-edge.js` (`innTag`)
- **Change:** List badges use **CMM** (complete match), **1st INN**, **2nd INN** — same short forms on props and fancy. Player-page switch keeps full `SCOPE_LABEL` words.
- **Callers:** PropLineMeta, fancy `innScope` / FancyLineMeta, Match Fancy chips/titles

### 2026-11-15 — Align Hit/Miss stamp with the line
- **Path:** `result-stamp.tsx`; `PropLineMeta` / `FancyLineMeta`
- **Change:** Tick/cross sized in `em` and meta row uses `items-center` so Hit/Miss sits on the same axis as the line number (was baseline-misaligned).
- **Callers:** PropLines, FancyLines, Home mix, catalogue demos

### 2026-11-15 — Drop Opened at on in-play-only rows
- **Path:** `hot-props.tsx` / `fancy-lines.tsx`; mobile `prop-row` / `fancy-row`
- **Change:** No “Opened at N” on prop/fancy rows. In-play rows exist only when there was no pre-match line; **In Play Market** is enough. The live number is the row’s O/U line.
- **Callers:** PropLineMeta, FancyLineMeta, BookQuotes, FancyBooks

### 2026-11-15 — Dense tables drop split-line / multi-book strip
- **Path:** `hot-props.tsx` / `fancy-lines.tsx` / `home-mix-table.tsx`
- **Change:** Dense Lines column no longer shows `BookQuotes` / `FancyBooks` detail (different lines, extra odds) — that stays on the dedicated player / fancy page. Lean meta + Over/Under column remain.
- **Callers:** PropLines dense, FancyLines dense, HomeMixDenseTable

### 2026-11-15 — Home dense mix table (interleaved)
- **Path:** `home-mix-table.tsx` (new); `hot-home.tsx`
- **Change:** Desktop Home keeps dense research chrome in **one** table with props + fancy interleaved (`HomeMixDenseTable`). Compact mixed list below `lg`. No longer drops dense when merging, and no longer splits into two PropLines/FancyLines tables.
- **Callers:** HotHome only; fixture pages unchanged

### 2026-11-15 — Drop prop Live; rename In play → In Play Market
- **Path:** `status-label.tsx` / mobile twin; `hot-props.tsx` / `hot-home.tsx`; mobile `prop-row` / `use-hot`
- **Change:** Prop rows no longer show per-player **Live** (Not in XI / void already covers non-playing; match Live stays on fixtures). **In play** badge copy → **In Play Market** (line/odds are in-play).
- **Callers:** PropLines, FancyLines, LiveMarketRow, StatusLabel catalogue

### 2026-11-15 — MatchChip Live via StatusLabel
- **Path:** `fixture-card.tsx` (`MatchChip`)
- **Change:** MatchChip uses `playState` + `StatusLabel` (not a destructive Live Badge on the pill).
- **Callers:** HotHome fixture pills

### 2026-11-15 — Home one mixed list; dense table edge pads; title truncate
- **Path:** `hot-home.tsx`; `hot-props.tsx` / `fancy-lines.tsx` (dense pads + `PropLineMeta` / label truncate)
- **Change:** Dense PropLines/FancyLines bleed with `-mx-gutter` and first/last `pl-gutter`/`pr-gutter`. Market titles truncate to one line. (Home dense split restored in the entry above.)
- **Callers:** HotHome; fixture `/props` / Match Fancy dense tables

### 2026-11-15 — Status replaces MiniBars; dense books only when O/U differs
- **Path:** `hot-props.tsx` (`PropBarsSlot`), `fancy-lines.tsx`; mobile `prop-row.tsx`, `fancy-row.tsx`
- **Change:** Not in XI / VOID / Score unavailable replace the MiniBars graph slot (not title badges). Dense Lines book strip (`detailOnly`) only when split lines or +N books.
- **Callers:** PropLines, FancyLines, app twins

### 2026-11-15 — Home Top-10 (web + app); fixture keeps all
- **Path:** `site/src/lib/hot-lines.ts` (`HOME_TOP`); `hot-home.tsx`; mobile `use-hot-home.ts`
- **Change:** Home shows mixed Top-10 on phone and desktop (dense uses the same Top-10 split into prop/fancy tables). Fixture / `/props` / Match Fancy still carry every line.
- **Callers:** HotHome, app Home

### 2026-11-15 — Prop/fancy rows: no “N so far” standing copy
- **Path:** `site/src/components/app/live-spot.tsx` (`LineProgress`); `fancy-lines.tsx`; mobile `live-bits.tsx`
- **Change:** Drop live/push/final StandingMark text on prop and fancy lines (“3 so far”, “On the line”, Cleared). Hit/Miss stamp remains; VOID and “Score unavailable” stay. `StandingMark` still used on next-match / Match Fancy drill-in.
- **Callers:** PropLines, FancyLines, app LineProgress

### 2026-11-15 — FancyLines dense Lines cell matches PropLines
- **Path:** `site/src/components/app/fancy-lines.tsx` (`FancyLineMeta`, `FancyBooks marks=false`); catalogue `row-density-demos.tsx`
- **Change:** Dense fancy Lines uses the same scan meta as compact (O/U · line · lean price · Hit/Miss), quieter books (no logos), `items-start` — twin of PropLines dense. Settled stamp-only (no Cleared copy) already shared.
- **Callers:** Home dense fancy table, Match Fancy / `/fancy` dense, design host

### 2026-11-15 — Settled lines: Hit/Miss stamp only (no so-far / bar)
- **Path:** `site/src/components/app/live-spot.tsx` (`LineProgress`); `fancy-lines.tsx` (dense standing); mobile `live-bits.tsx`
- **Change:** Cleared/missed no longer render `StandingMark` or `LiveTrack` — the tick/cross `ResultStamp` beside odds is enough. Superseded for live/push copy by the entry above.
- **Callers:** PropLines compact + dense, FancyLines dense, app LineProgress

### 2026-11-15 — Breakpoint density (PropLines + FancyLines)
- **Path:** `site/src/components/app/fancy-lines.tsx` (new); `match-fancy.tsx`, `hot-home.tsx`, `Lists.tsx`; catalogue `row-density-demos.tsx`
- **Change:** Fancy gets `FancyLines` with `auto|compact|dense` mirroring PropLines. Density is viewport-only: Home / fixture / `/props` / `/fancy` all use `auto`. Home = mixed Top-10 (see `HOME_TOP` entry); fixture keeps all. `OverviewRow` → compact wrapper.
- **Callers:** HotHome, MatchFancy list, Fancy cards, HotProps

### 2026-11-15 — Scan Edge + MiniBars slot count (Home alignment)
- **Path:** `site/src/components/app/mini-bars.tsx` (`ScanEdge`, `SCAN_ROW_GRID`, `MINI_BARS_SLOTS`); `hot-props.tsx` / `match-fancy.tsx`; mobile `mini-bars.tsx`
- **Change:** Edge column is fixed `w-11` via `ScanEdge` so per-row `auto` grids no longer shift the bars. MiniBars always pads to 10 slots so short L-histories are not chunkier than a full L10 (Runs vs Player performance on Home).
- **Callers:** Home mixed props/fancy list, Props compact, Match Fancy, dense L10 chart

### 2026-11-15 — Prop / fancy scan twins share MiniBars slot
- **Path:** `site/src/components/app/mini-bars.tsx` (`MINI_BARS_SLOT`, `MiniBarsSlot`); `match-fancy.tsx` (`OverviewRow`); `hot-props.tsx` (Not in XI); mobile `fancy-row.tsx`, `live-bits.tsx`, `prop-row.tsx`
- **Change:** Fancy no longer forces `sm:w-[72px]` on MiniBars (was narrower than props). Shared slot class 72→104. Title weight/`items-center` and `Opened at` copy match PropLines compact.
- **Callers:** Home mixed list, Match Fancy tab, Props compact rows

### 2026-11-15 — PropLines (unify PropRow + PropTable)
- **Path:** `site/src/components/app/hot-props.tsx` (`PropLines`, `PropLineIdentity`, `PropLineMeta`); `hot-home.tsx`; catalogue `row-density-demos.tsx`; mobile `prop-row.tsx` (compact twin)
- **Change:** One priced-line surface with `density` `auto` | `compact` | `dense`. Compact = scan list (phones / Home / app); dense = research table from `lg`. Shared identity/meta helpers. `PropRow` / `PropTable` thin deprecated wrappers. MarketTape and fancy OverviewRow unchanged.
- **Callers:** HotProps (`auto`), HotHome (compact `<li>` via PropRow for mixed fancy list), `/props`, fixture props, design host Rows topic
- **PR:** (this change)

### 2026-11-15 — App twins: scoreboard, strip, StatusLabel, scorecard
- **Path:** `mobile/src/ui/match-header.tsx`, `live-board.tsx`, `status-label.tsx` (new), `live-bits.tsx`, `fixture-card.tsx`, `next-match.tsx`, `tick.tsx`, `motion.tsx` (LiveDot → miss)
- **Change:** Android/iOS match web: Hotstar scoreboard + LIVE pill (white on miss), live strip (bowler + `formatBall` ongoing over | batters), StatusLabel tones, full scorecard segmented `Team · score` + `Bleed` tables, no partnership/CRR on full card. Tick `arrow={false}` on scoreboard.
- **Callers:** Fixture page ScorecardCard, rail FixtureCard, prop Live/In play marks

### 2026-11-15 — Full scorecard edge-bleed + team categories
- **Path:** `site/src/components/app/live-board.tsx` (`ScorecardBody`, `ScorecardAccordion`)
- **Change:** Batting/bowling use `TABLE_BLEED` + `TABLE_HEAD`. Multi-innings switch is a MarketTape-style segmented category bar (`Team · score`), not chips. Partnership / last wkt / CRR / RRR stay off the full card (live strip only).
- **Callers:** Fixture accordion + `/fixture/:id/scorecard`

### 2026-11-15 — StatusLabel (central match / row status)
- **Path:** `site/src/components/app/status-label.tsx` (new); `live-spot.tsx` (`LiveBadge` / `InPlayBadge`); `match-scoreboard.tsx`; `fixture-card.tsx`; `match-status.tsx`; catalogue Buttons topic
- **Change:** One cva recipe: tone `live` | `inPlay` | `session` | `muted` × surface `pill` | `plain` | `dot`. LIVE pill = white on miss. Call sites stop inventing status colours.
- **Callers:** Fixture scoreboard, FixtureCard, MatchStatus, prop/fancy Live / In play marks

### 2026-11-15 — Fixture MatchScoreboard (Hotstar-style card)
- **Path:** `site/src/components/app/match-scoreboard.tsx` (new); `live-board.tsx` (`LiveBoard` strip); `Fixtures.tsx` (`MatchHeader`); catalogue Data topic
- **Change:** Web fixture header is series · mirrored crest/score · centre `StatusLabel` · live strip (bowler O-R-W + ongoing over balls with `formatBall` extras | batters with strike dot). Dropped player Face avatars from the strip. App twin deferred until this layout is confirmed.
- **Callers:** `/fixture/:id` header; design host MatchScoreboard stage
- **PR:** (web-only)

### 2026-11-15 — Live vs In play badges; in-play lines only without pre-match
- **Path:** `site/packages/engine/inplay-lines.js` (`liveMerge`); `site/src/components/app/live-spot.tsx` (`LiveBadge`, `InPlayBadge`); `hot-props.tsx` / `match-fancy.tsx` / `live-markets.tsx`; mobile `live-bits.tsx` / `prop-row.tsx` / `fancy-row.tsx`; `engine/live.js` (`onNow`)
- **Change:** **Live** = player on now (crease / bowling). **In play** = live-priced row. `liveMerge` only adds a live-priced row when that market was not offered pre-match; pre-match markets keep their rows and so-far; in-play prices for those stay in the snapshot/log only.
- **Callers:** Props scan + table, Match Fancy overview / live markets, app twins; design host scan demos

### 2026-11-15 — FixtureCard stacked sides + app score Tick
- **Path:** `site/src/components/app/fixture-card.tsx`; `mobile/src/ui/fixture-card.tsx`
- **Change:** Web FixtureCard sides match the app (stacked crest · name · score rows; pending skeleton while live scores load). App `LiveScore` wraps live totals in `Tick` (`runs + wkts/100`) so score updates flash like the site.
- **Callers:** Home fixture rail (web + app); any other FixtureCard / LiveScore use

### 2026-11-15 — ResultStamp (Hit tick / Miss cross) on props + fancy
- **Path:** `site/src/components/app/result-stamp.tsx` (+ `sideStamp`); `hot-props.tsx` (`PropRow`), `match-fancy.tsx` (`OverviewRow`); `mobile/src/ui/result-stamp.tsx`, `prop-row.tsx`, `fancy-row.tsx`; catalogue `row-density-demos.tsx`
- **Change:** Scan rows share one recipe: colour O/U text, muted odds, compact Edge (always), tick/cross beside odds when settled, MiniBars; no list save star / so-far text / +N books under the row. Fancy list drops inline BookTable (detail keeps books).
- **Callers:** Home mix, `/props`, Match Fancy / Fancy cards, app Props + Fancy tabs

### 2026-11-15 — Prop & fancy scan rows (web product)
- **Path:** `site/src/components/app/hot-props.tsx` (`PropRow`), `match-fancy.tsx` (`OverviewRow`); catalogue demos in `row-density-demos.tsx`
- **Change:** Phone list rows are scan-first (Props.Cash-style): avatar · name · one model-side price (O/U pill + line + stat + odds) · compact **Edge** · MiniBars. Dropped dual book lanes / +N / ground / L10 foot / "Model … Over" stack from the list (detail still has books). Live keeps so-far / progress.
- **Callers:** Home props mix, `/props`, Match Fancy list, Fancy cards; app twins still pending confirm

### 2026-11-15 — App copy aligned to web
- **Path:** `mobile/src/ui/tick.tsx`, `fixture-card.tsx`, `grid-table.tsx`, `ground-page.tsx`, `next-match.tsx`, `app/(tabs)/props.tsx`, `saved.tsx`, `player/[idx].tsx`, `lib/info.ts`
- **Change:** Standing push → **On the line**; finished no-props CTA → **Match**; Custom line empty / Props filter empty / ground tour **Live** / Saved sign-in / player empty bodies match site wording.
- **Callers:** Prop rows, fixture rail, ground, Props tab, Saved, Player

### 2026-11-15 — Market tape: thresholds in info only
- **Path:** `site/src/components/app/market-tape.tsx`, `mobile/src/ui/market-tape.tsx`
- **Change:** Dropped the on-card “Over at 2.50…” / “Over at 1.40…” footnotes. Web adds an info popover (same wording as the app `tape` topic); app keeps `InfoButton` on every tape header (including hits-only). Tab labels use web wording (`High odds hits · N` / `Low odds misses · N`) on both; web segmented track is full-width equal segments (same job as the app `Segmented`).
- **Callers:** Home tape, Player props tape

### 2026-11-14 — Mobile player: Match Fancy / web Player shape
- **Path:** `mobile/src/app/player/[idx].tsx`, `ui/window-pills.tsx`, `ui/book-table.tsx`, `ui/side-book.tsx`, `ui/page-header.tsx` (`titleStyle` / `subtitleStyle`), `ui/icons.tsx` (`ChevronDown`)
- **Change:** Chart-led first viewport; metrics only (no phone gauge); centred O/U + stepper under chart; quiet hairline `WindowPills`; O/U hit-rate meters + book lanes (`SideBook` / `BookTable` twins); drop Alt lines accordion and At a glance; When it hits is its own tab; sticky header title fades in as the hero name scrolls away.
- **Callers:** Player detail; WindowPills anywhere else using the look-back band

### 2026-11-14 — Mobile: Tick flash + Press timing (Reanimated 4.7)
- **Path:** `mobile/src/ui/tick.tsx`, `press.tsx`, `collapsible.tsx`
- **Change:** Precompute Tick flash colours (`FLASH_RISE` / `FLASH_FALL`) outside `useAnimatedStyle` — calling `tint.*` inside a worklet threw Worklets “Tried to synchronously call a Remote Function” (`miss`). Press / TurnChevron CSS transitions use `"ease-out"` only; `cubicBezier(...)` still serialises to `cubic-bezier(...)` and Reanimated 4.7 rejects it as an invalid predefined timing function.
- **Callers:** Live price / so-far flashes; every `Press`; Fancy book chevrons

### 2026-11-14 — Mobile: docked tab bar; no liquid glass / floating chrome
- **Path:** `mobile/src/components/tab-bar.tsx`, `app-tabs.tsx` (deleted `floating-tab-bar`, `app-tabs.android/web`, `ui/glass`), `ui/phase-bar.tsx`, `ui/insets.ts`, `TAB_BAR_HEIGHT` 54
- **Change:** One solid, full-width docked tab bar on iOS/Android/web. Home phase strip (In play / Pre-match / Completed) sits in page flow flush above it. No floating capsule, `NativeTabs`, or `GlassView`.
- **Callers:** All six tabs; Home rail + phase strip; web preview

### 2026-11-14 — Mobile: Press CSS transition; skeleton pulse; Tick/Collapsible mount-on-use
- **Path:** `mobile/src/ui/press.tsx`, `skeletons.tsx` / `SkeletonGroup`, `tick.tsx`, `collapsible.tsx`, `motion.tsx`
- **Change:** Press is a 120 ms UI-thread CSS transform transition (plain Pressable when `scale={1}` or reduce-motion). Skeletons: one opacity pulse per group (was per-block SVG sweep). `Tick` flash and `Collapsible` book tables mount only after first use.
- **Callers:** Every tappable row/chip; `Working` / page skeletons; prop rows; Fancy books

### 2026-11-14 — Flags: parent-nation codes; kit/face keep honest empties
- **Path:** `engine/flags.js` (`flagCode`, `FLAG_CODES`), `lib/assets.ts` (`flagUrl`), `share-text.js`
- **Change:** Flagcdn lookup moved to the engine; U19 / A / Champions / Women strip to the senior flag; added missing nations (USA spellings, Costa Rica, Cameroon, Iran, Ivory Coast, …). Still no source AD jersey or stock helmet face as UI fallbacks.
- **Callers:** TeamBadge / TeamFlag / mobile team-badge; match share emoji flags

### 2026-11-14 — Player kit: no AD placeholder; format-row py-snug
- **Path:** `engine/photos.js` (`teamId`, `TEAM_FILL`, `teamJerseys`), `Player.tsx` / `match-fancy.tsx` / `hot-props.tsx` sticky parent row, `build.py` photos `t` backfill, `crex_assets.TEAM_ALIASES`
- **Change:** Dropped the generic Source A `AD` shirt fallback (looked like a real kit when `photos.t` omitted a side, e.g. Afghanistan). `TEAM_FILL` + build-time re-match of assembled teams cover holes; `teamId` tries full fold before stripping women (U19 Women); USA Base spelling aliased to source `united states`; format/scope + Filters hairline rows use `py-snug`.
- **Callers:** PlayerPortrait / crests / share cards; Player + Match Fancy + Hot props sticky bands

### 2026-11-14 — Sticky filter rhythm: snug pads, ad under band
- **Path:** `pill-group.tsx` (`sub` → `py-snug`), `Player.tsx`, `match-fancy.tsx`, docs
- **Change:** Sub-row `py-stack` left a hole under the flush header that looked like top gap until the band stuck. Filled chip stack uses `gap-snug py-snug` (tight read as missing). `player_detail_top` / `fancy_detail_top` sit below the sticky band so ads cannot open a scroll-top gap above the chips.
- **Callers:** All `PillGroup sub`; Player + Match Fancy detail sticky bands

### 2026-11-14 — Sticky filter parent row: items-center; equal filled-chip stack
- **Path:** `Player.tsx`, `match-fancy.tsx`, `hot-props.tsx`, `DesignSystem.tsx`
- **Change:** Format/scope/prop + Filters used `items-stretch`, so the control-tall row left a dead band under the underline before the next chips. `items-center` on that hairline row everywhere; Player Test innings + prop pills share one filled-chip stack (even vertical rhythm).
- **Callers:** Player sticky band; Match Fancy; Props screener; catalogue StickyFilterBand stage

### 2026-11-14 — PillGroup: snap mount; Player Test innings spacing
- **Path:** `site/src/components/app/pill-group.tsx`, `site/src/pages/Player.tsx`
- **Change:** Newly mounted pill rows no longer spring-fly the selection thumb or smooth-scroll on first paint (Test innings under format felt random). Innings chips sit inside the format hairline block with one `pb-tight` (not a third padded band); prop pills keep a single `py-tight` below.
- **Callers:** All `PillGroup` surfaces; Player Test batting filter band

### 2026-11-14 — Player Test: keep format chips when innings scope shows
- **Path:** `site/src/pages/Player.tsx`
- **Change:** Test batting innings chips (Both / 1st / 2nd) shared the format row and squeezed T20/ODI/Test/Hundred away. Format + Filters stay the parent row; innings are filled pills on their own row under it (Fancy market-under-scope shape), then prop pills.
- **Callers:** Player sticky filter band on Test batting stats

### 2026-11-14 — ChartBars width: match Fancy ValueBars flex-1 row
- **Path:** `site/src/components/app/chart.tsx`, `mini-bars.tsx` (`ValueBars`)
- **Change:** Player chart left shift / “missing” first bar — y-axis `0`/`9` ticks (grid column, then overlay) sat on the oldest bar. Removed axis ticks entirely (Fancy `ValueBars` has none). Full-width in-flow `flex-1` / `gap-tight` bars; dashed line + value on the right only. No Motion `scaleY`.
- **Callers:** Player, Match Fancy detail, ResultView, design-system ChartBars stage

### 2026-11-14 — StickyFilterBand + flush header; Game log stays in tabs
- **Path:** `site/src/components/app/page.tsx` (`StickyFilterBand`), `lib/header-slot.tsx` (`useHeaderFlush`), `DesignSystem.tsx`, docs
- **Change:** Central sticky chip/filter band (`bg-background/85` blur under header). Pair with `useHeaderFlush(true)` when the band leads the page so the shell header uses `bg-card` and drops its hairline (Player, Match Fancy detail, Fixture tabs). `/props` and Ground full page use the band without flush (title/hero above). Catalogue stage under Data & metrics. Player desktop Game log reverted out of `StickyPanel` — stays in bottom tabs at every breakpoint; rail is Lines only.
- **Callers:** Player, Match Fancy detail, Props screener, Ground `/fixture/:id/ground` + `/venue/:id`, Fixture chips

### 2026-11-14 — Player polish: crumbs pad, zero bars, O/U blocks, splits bleed
- **Path:** `Player.tsx`, `chart.tsx`, `viz.tsx`, `result.tsx`, `match-fancy.tsx`
- **Change:** Desktop crumbs `pt-stack` under flush; ChartBars zeros as visible miss bars; void/XI status centered; O/U meters in ground-style hairline blocks (Player + Match Fancy); RateHeatStrip `label-cap` above cells; SplitTables accordion pulls to edges so TABLE_BLEED dividers reach the gutter; Loaded uses `gap-section` / `gap-stack`.
- **Callers:** Player, Match Fancy detail, Splits / ResultView heat strip

### 2026-11-14 — Narrow DetailSplit callers (revert Home / Competitions / Ground matches grids)
- **Path:** `hot-home.tsx`, `Markets.tsx`, `fixture-ground.tsx`, docs
- **Change:** Reverted Home tape\|props 2-col (left Props half-width when tape empty), Competitions `CardGrid` of link rows, and Ground matches `CardGrid` of FixtureCards — those broke density rather than helping. `DetailSplit` / `StickyPanel` stay on Player, Match Fancy, Ground markets; `CardGrid` stays on Fancy list + catalogue.
- **Callers:** Home, `/competitions`, Ground matches list

### 2026-11-14 — DetailSplit, StickyPanel, CardGrid
- **Path:** `site/src/components/app/page.tsx`, `site/src/pages/DesignSystem.tsx`
- **Change:** Shared desktop layout jobs — asymmetric `DetailSplit` (chart | rail), `StickyPanel` (sticky max-height bleed rail), `CardGrid` (1/2/3 directory). `DataTable` gains optional `onRowClick`. Catalogue stages under Data & metrics.
- **Callers:** Player, Match Fancy detail, Ground markets, Fancy list, Fixture Form

### 2026-11-14 — Drop lucide-react dependency
- **Path:** `site/package.json`, `site/package-lock.json`, `site/components.json`, `docs/DESIGN_SYSTEM.md`
- **Change:** Removed unused `lucide-react`; dropped `iconLibrary: lucide` from shadcn config. New CLI components must be converted to Heroicons (import ban in design-tokens.test.ts).
- **Callers:** anyone running `npx shadcn add`

### 2026-11-14 — shadcn ui: Lucide → Heroicons
- **Path:** `site/src/components/ui/{sheet,dialog,accordion,checkbox,select,command,sidebar,dropdown-menu}.tsx`, `site/src/lib/design-tokens.test.ts`
- **Change:** Replaced Lucide icons with Heroicons (`XMarkIcon`, chevrons, `CheckIcon`, `MagnifyingGlassIcon`, `Bars3Icon`); radio indicator is a filled span (no CircleIcon). Lucide import ban now covers `components/ui` too.
- **Callers:** every Sheet/Dialog/Select/Command/Sidebar/Dropdown/Accordion/Checkbox surface

### 2026-11-14 — Catalogue: badges, BookTable, LadderRow
- **Path:** `site/src/pages/DesignSystem.tsx` (Data & metrics)
- **Change:** PreviewFrame stages for TeamBadge sizes / LeagueBadge / TeamFlag, BookTable (+N books), and LadderRow priced ladder with synthetic books.
- **Callers:** design host `/docs/data`

### 2026-11-14 — Badge type roles + GOVERNED expansion
- **Path:** `site/src/components/app/badges.tsx`, `player-picker.tsx`, `sign-in-sheet.tsx`, `site/src/lib/design-tokens.test.ts`
- **Change:** Tiny badge initials use `text-caption` (no hard px); silhouette uses translate not margin; picker meta uses `text-footnote`; sign-in form stacks with `gap-stack` (no `mt-tight`). Enrolled remaining product app modules + `AdminAds` in GOVERNED.
- **Callers:** Home rail chips, AvatarGroup, TeamFlag, PlayerBadge, Tools player picker, Sign-in sheet; all design-token CI checks

### 2026-11-14 — Endpoint matrix Partial → Aligned
- **Path:** `docs/DESIGN_SYSTEM.md`, `docs/SITE.md`
- **Change:** `/competitions`, `/pair`, and `/teams`/`/team/:id` marked Aligned (EmptyState, bleed tables, ResultView, GOVERNED). SITE.md GOVERNED note updated — product surfaces enrolled.
- **Callers:** design handbook only

### 2026-11-14 — Design-host auth + chrome handoff harden
- **Path:** `site/src/lib/auth.tsx`, `site/src/pages/AuthCallback.tsx`, `site/src/main.tsx`, `site/src/lib/design-host.ts`, `Header.tsx`, `IosTabBar.tsx`, `GlobalSearch.tsx`, `chrome.tsx`
- **Change:** Design-host Google/email OAuth finishes on `PRODUCT_ORIGIN/auth/callback?next=`; stray design `/auth/callback` redirects to product; tab bar never selected on catalogue; footer uses `PRODUCT_ORIGIN`.
- **Callers:** design host Sign-in / Saved / tabs / search entity hits

### 2026-11-14 — Centralization rule + typography font stack code block
- **Path:** `.cursor/rules/design-system-centralization.mdc`, `docs/DESIGN_SYSTEM_CHANGELOG.md`, `site/src/components/design-system/reference.tsx`
- **Change:** Always-on Cursor rule for DS ↔ product sync before merge; append-only changelog; `font-sans-stack` shown in a `<pre><code>` block with copy on Typography.
- **Callers:** all UI PRs; design host `/docs/type`

### 2026-11-14 — Docs content column (PreviewFrame + DocsArticle)
- **Path:** `site/src/components/design-system/docs-article.tsx`, `example-stage.tsx`, `site/src/pages/DesignSystem.tsx`
- **Change:** Catalogue right pane uses docs article header, When to use, On this page TOC, DocsPager; live demos use `PreviewFrame` (H2 + Preview toolbar). Product shell Header/Sidebar recipe reused; Saved/search/tabs hand off via `design-host.ts`.
- **Callers:** design host only (`design.fancy.cash` / `VITE_DESIGN_SYSTEM_HOST`)

### 2026-11-14 — ChartBars line on light docs
- **Path:** `site/src/components/app/chart.tsx`
- **Change:** Threshold line uses `border-foreground/35` so it reads on `design-light` as well as product dark.
- **Callers:** Player, ResultView, design-system Data & metrics stage

### 2026-11-15 — App matched to the phone site (header, chips, rows, phase tabs, motion)
- **Path:** `mobile/src/ui/brand.tsx`, `chips.tsx`, `capsule.tsx`, `match-chip.tsx`, `phase-bar.tsx`, `prop-row.tsx`, `fancy-row.tsx`, `star.tsx`, `motion.tsx`, `tick.tsx`, `tokens.ts`, `mobile/src/lib/tabs.ts`, `mobile/src/app/(tabs)/index.tsx`, `props.tsx`, `fancy.tsx`
- **Change:** `AppHeader` is the brand bar on every tab with Search and Account (sign in / Saved), the tab's title in a row under it. Chosen chips (`Chips`, `ChoiceChip`, `CapsuleTabs`, `MatchChips`) are the accent fill with dark text, 150 ms fade; `MatchChips` shows a Live / session tag and an optional leading "All". Home's phase tabs sit under the header on a hairline, count quieter. `PropRow` follows the site's row: `O/U` line in Barlow Condensed Bold (`metric`), best Over and Under each with its book (`BookTable` behind "+N books"), watchlist star top right, model edge (`figure`), L10 count coloured by rate. `OverviewRow` uses the same figures. Fancy tab matches are flat sections closed by a hairline, not cards. Player props has the site's match-chip and stat-chip rows. Tab label "Player props". Motion: `Rise` (the site's card entrance: 8 px, 300 ms, 40 ms stagger, first paint only), tick flash 450 ms, live dot 1 ↔ 0.5 in 2 s. New tokens: `metric`, `figure`, `tint.destructive`.
- **Callers:** every tab (header), Home rail and props block, Player props, Fancy, fixture Props / Match Fancy lists, player stat switch, filter sheets

### 2026-11-15 — Header reverted; native motion; fixture and player pages flat like the phone site
- **Path:** `mobile/src/ui/brand.tsx`, `motion.tsx`, `tick.tsx`, `line-tabs.tsx` (new), `phase-bar.tsx`, `match-header.tsx`, `live-board.tsx`, `tournament-stats.tsx`, `mobile/src/app/fixture/[id]/index.tsx`, `player/[idx].tsx`, `(tabs)/index.tsx`, `(tabs)/leagues.tsx`
- **Change:** `AppHeader` is back to the earlier one (brand on Fixtures, each other tab's own title in the bar, Search). Motion is native rather than copied from the site: entrances are springs (`enter`, `Rise`), the LIVE dot has a ring that spreads and fades (`LiveDot`), a number that moved rolls in on a spring over a fading wash (`Tick`), content fades in over its skeleton (`Appear`). New `LineTabs`: underline tabs with one underline that glides on a spring; `PhaseBar` and the player's format switch use it. The match block on a fixture page is flat (no card), and the page's sections are chips under it with the open one's stat chips below. League chips use the accent fill; season facts, the leader figure and the table's key column are Barlow Condensed Bold.
- **Callers:** every tab (header), Home, fixture page, player page, Leagues, league page

### 2026-11-17 — Team crests without a container (site, app, share images)
- **Path:** `site/src/components/app/badges.tsx` (`TeamBadge`, `TeamAvatar`), `site/src/pages/Player.tsx`, `mobile/src/ui/team-badge.tsx`, `site/packages/engine/card.js`, `poster.js`, `brand-draw.js`
- **Change:** a team crest is the logo alone: no round tile, border, background or padding, so the whole crest shows at the full size of its box (`object-contain`; initials when there is no image). The `bare` prop is gone (it is the only look); `TeamAvatar` (AvatarGroup) loses its circle and background too. The player header's team link loses its grey disc. The link card and the share poster draw crests the same way, cropped to the logo's visible pixels. Both images also draw the site's own brand (dark tile, green gradient F, "Fancy.cash" in Satoshi bold, as `Brand` in `Header.tsx`) and each listed book as its logo with no pill behind it, not its name. League badges keep their round tile. A women's side shows only its own team's logo (never the men's crest of the same name): with no women's team listed it falls back to the flag or initials (`teamId` in `engine/photos.js`).
- **Callers:** every `TeamBadge` / `TeamAvatar` (fixture cards, rows, chips, headers, player and team pages, app fixture cards, next match, match header), card and poster


### 2026-11-17 — Player page match card: one line, history in its own section (site + app)
- **Path:** `site/src/components/app/next-match.tsx` (`NextMatch`, new `MatchupRates`, `whenLabel`), `mobile/src/ui/next-match.tsx` (`NextMatchCard`, `MatchupRates`, `whenLabel`), `site/src/pages/Player.tsx`, `mobile/src/app/player/[idx].tsx`
- **Change:** the card is a bordered strip on the card background: the opponent's crest and "vs Opponent" (his own side is in the page header); on one line, "vs Opponent on 29 Oct · 3:00 pm" (Live / Completed in place of the date while it is on; the ground is in the history tile below). The line's standing (or "No listed odds") stays under that. No heading row, no repeated competition / format text, and the app's book table is gone (the lanes above already list the books, as on the site). How he has gone over / under the chart's line at this ground and against this side is now `MatchupRates`, a separate section under the card (history only, never prices).
- **Callers:** player page on both the site and the app (data and empty states)

### 2026-11-17 — `cn` keeps Barlow numbers (font weight names)
- **Path:** `site/src/lib/utils.ts` (+ `utils.test.ts`), `site/src/pages/Player.tsx` (`Metric`)
- **Change:** `cn` now knows `font-editorial / copy / label / emphasis / display-heavy` are weights. Before, `font-condensed font-label` was read as two font families and the first was dropped, so numbers written with the condensed face (player metrics, window pills, hit rates, odds) rendered in Satoshi. They now use Barlow Condensed as written. `Metric` values use `font-label` (medium) with it.
- **Callers:** every `cn("font-condensed … font-label|font-emphasis")` on the site (player page metrics and window pills, hit rates, next-match rates, alt lines, hot props, mini bars); check number columns at phone width

### 2026-11-17 — Ad slot: strip chrome only around a real creative
- **Path:** `site/src/components/app/ad-slot.tsx` (+ test)
- **Change:** an AdSense slot counts as filled (border strip, minimum height) only when `data-ad-status="filled"` **and** the `ins` holds an `iframe`. A blank or placeholder fill, the likely cause of an edge-to-edge line under the player hero on a real phone while no ad ran, now stays hidden. Manual creatives are unchanged.
- **Callers:** every `AdSlot` / `StatsAd`

### 2026-11-17 — Player page: match strip under the hero, metric values, manual ad strip
- **Path:** `site/src/pages/Player.tsx`, `mobile/src/app/player/[idx].tsx`, `site/src/components/app/ad-slot.tsx`
- **Change:** the match strip moves to the top of the stats block, right under the player image; the Opponent metric is gone (the strip names the opponent); metric values are Barlow Condensed at 22 px, medium weight, including Prop; header and metrics dividers removed (site and app). A manual ad creative draws its strip only after its image has loaded, and a broken image leaves nothing (a zero-height image used to leave a lone edge-to-edge line).
- **Callers:** player page (site and app), every `AdSlot`

### 2026-11-17 — Tables are boxed in the page margin (site + app)
- **Path:** `site/src/components/app/page.tsx` (`TABLE_BLEED`, `DataTable`), `site/src/pages/Player.tsx` (game log), `mobile/src/ui/data-table.tsx` (`TABLE_BLEED`, via `Bleed`)
- **Change:** `TABLE_BLEED` is now a hairline on all four sides inside the page margin (it was edge to edge with top and bottom lines only), so every table reads like the hit-rate box. Cells and the game log rows use the normal snug inset instead of the gutter. The name stays (`bleed` prop) so call sites are unchanged. Not touched: the bespoke full-width lists (Match Fancy, Hot props, home mix, top batter, ladder panel), which are not `TABLE_BLEED` tables.
- **Callers:** every `DataTable bleed`, `Bleed`, `live-board` batting / bowling, splits, Ask results, player game log; check each at phone width

### 2026-11-17 — Player page: whole strip links, ads draw no divider, crest 64 px, app fonts synced
- **Path:** `site/src/components/app/next-match.tsx`, `mobile/src/ui/next-match.tsx`, `site/src/components/app/ad-slot.tsx`, `site/src/pages/Player.tsx`, `mobile/src/app/player/[idx].tsx`, `mobile/src/ui/data-table.tsx`
- **Change:** the whole match strip is the link / press target (site: the bordered box is the `Link`; app: the whole card is a `Press`), not only its first row. Ad slots draw no hairline at all, and AdSense counts as filled only when its iframe has a real size: on a phone it reported "filled" with a zero-size `aswift_*` iframe, which left a lone edge-to-edge line between the hero and the strip. Team crest in the hero is 64 px on the site (58 px frame in the app), down from 80. App metric values use Barlow Condensed medium at 22 pt like the site's.
- **Callers:** player page (site and app), every `AdSlot`, app `Metric` (compact)

### 2026-11-17 — Book logos are published data: a new book needs no app update
- **Path:** `site/public/books/books.json`, `site/packages/engine/books.js`, `site/src/lib/books.ts`, `site/src/components/app/book-badge.tsx`, `mobile/src/ui/book-badge.tsx`, `site/src/main.tsx`, `mobile/src/app/_layout.tsx`, `site/api/og.js`
- **Change:** the list of books (stem, display name, logo file) is `public/books/books.json`, fetched once at start (`loadBookManifest`) and merged into the engine's table; `BookBadge` (site and app) subscribes and re-draws when it arrives. The table in `books.js` is only the offline / first-launch fallback. Adding a book = its logo file + one entry in `books.json` (a node test checks the file list and the manifest agree). Added bc.game.
- **Callers:** every `BookBadge` (site and app), the share card (`api/og.js`)
