# Design system (Web + App)

Fancy.cash has **two design systems** that share one contract: tokens, type roles, spacing roles, and component **jobs**. The web DS lives in `site/` (responsive). The app DS lives in `mobile/src/ui` (React Native). Reuse a web pattern on native only when it works; otherwise ship a **native-designed twin** with the same job and tokens.

No rebrand. No paid UI kit. Dark only. Free MIT only. **Icons in product code (`components/app`, `pages`, `components/ui`, `mobile/src`): Heroicons / Ionicons — never Lucide.** `lucide-react` is not a dependency; after `npx shadcn add`, replace any Lucide imports with Heroicons before merge (CI bans Lucide under those trees).

## Foundations (shared)

| Layer | Source | Web | App |
| --- | --- | --- | --- |
| Colours, space, type sizes, motion, breakpoints | `site/packages/tokens/tokens.json` | `npm run tokens` → `site/src/tokens.generated.css` + Tailwind roles | `mobile/src/ui/tokens.ts` derives px from the same JSON (`remPx`); `tint.*` for rgba washes |
| Type pairing | Satoshi UI + Barlow Condensed figures / `label-cap` | `index.css` `@utility label-cap` / `num-cond` | `font`, `cap`, `num`, `numLg` |
| Layout roles | gutter, control, row-min, header-h | CSS vars + utility classes | `space.gutter`, `control`, `HEADER_HEIGHT` |
| Rules | Named roles only on migrated surfaces | `design-tokens.test.ts` GOVERNED list | Same role names; values from tokens |

Use the shared weight roles from `tokens.json`: editorial (300), copy (400), label (500), emphasis (700), and brand (900). On web use `font-editorial`, `font-copy`, `font-label`, `font-emphasis`, and `font-display-heavy`. Native text styles resolve to the corresponding bundled Satoshi faces. Barlow Condensed uses the editorial weight for standard tabular figures and the label weight for caps.

**Decision rule**

1. Name the **job** once (e.g. “dense numeric stats table”).
2. Implement on **web** with phone / `md` / `lg+` behaviour where it matters.
3. **App:** if RN-compatible (or a thin reimplementation of the same API), add the mirror.
4. If not → design a **native twin**; mark the pair in the compatibility map below.

Reuse → extend → create (and create a native twin when web cannot run on RN).

---

## Web design system

**Home:** `site/packages/tokens` + `site/src/index.css` + shadcn `components/ui/*` + product chrome in `components/app/*` and `components/layout/*`.

### Catalogue (use-when)

| Job | Component | Use when |
| --- | --- | --- |
| Page title / crumbs | `PageTitle`, `Crumbs` | Drill-in and desktop hierarchy |
| Entity hero | `EntityHero` | Player / team / league / venue identity strip |
| Page header (shell) | layout `Header` + page title | Top chrome; app twin is `PageHeader` |
| Empty section | `EmptyState` | Any list / unknown / error that can be empty — **not** `EmptyNote` (deprecated alias only) |
| 404 | `EmptyState` in `App.tsx` | Catch-all `*` route |
| Forms | `LiveForm`, `Field`, `Segmented` (`forms.tsx`) | Pair tool, contact-ish inputs, live filters |
| Metric / stat tile | `Metric`, `StatTile`, `StatGridCards` | Glance figures on Player / Odds / ResultView |
| Detail board | `DetailSplit`, `StickyPanel` | Player / Match Fancy / Ground chart + sticky Lines (and Player game log) rail at `lg+` |
| Card directory | `CardGrid` | Fancy list, Ground matches, Competitions index — 1 → 2 (`md`) → 3 (`xl`) |
| Chips / filters | `Chip`, `PillGroup`, `PillTabs`, `ScreenerFilters` | Format, scope, section tabs, screener; `PillTabs` = documented twin of `PillGroup` (taller control) |
| Active filter chip | screener / ground filter dismissibles | Clearable “on” filters |
| Dense stats table | `DataTable` (`bleed`, `TABLE_HEAD`) | Player Splits / When it hits / Research; ResultView |
| Book quotes table | `BookTable` / odds rows | Next-match / priced books |
| Line ladder (priced) | Player sticky table + `LadderRow` | Book-priced player lines |
| Research ladder | `LadderTable` | Unpriced research tab |
| Game log list | bleed `ul` + `min-h-row` | Player game history |
| Heat grid | `GridTable` in `Card` | Fixture / team grid widget (not full-bleed) |
| List / competition row | list rows on Competitions / Saved | Directory navigation |
| Scorecard | live board scorecard | Fixture live / final card |
| Charts | `chart.tsx` bars | Player + ResultView histograms |
| Contact mailto | `Contact` Card + mailto CTA | Support surface |
| Legal doc | `Legal` pages | Privacy / terms / disclaimer |
| Cards / panels | `Card`, `Panel`, `FixtureCard` | Match surfaces, reference blocks — **not** around bleed stats tables |
| Skeletons | `skeletons.tsx` | Route-shaped loading |
| Sheets / drawers | shadcn `Sheet` | Filters, game detail — not primary navigation |
| Tab bar / sidebar | `IosTabBar`, desktop source list | Shell chrome |
| Star / save | `star.tsx` (Heroicons) | Saved props / players / teams |
| Ads | `AdSlot` | Slot catalogue only; empty = no layout |

### Responsive variants

| Breakpoint | Role |
| --- | --- |
| default (phone) | Single column, bottom tab bar, edge bleed on stats tables, sheets for filters |
| `md` (768+) | Wider gutters; some two-column glances |
| `lg` (1024+) | Sidebar nav; `DetailSplit` + `StickyPanel` (asymmetric chart \| rail); Fancy `CardGrid`; Fixture Form two teams; `lg:mx-0` ends table bleed |

Details per surface: [Endpoint matrix (web)](#endpoint-matrix-web).

### Stats-table headers and bleed

| Recipe | Classes | Use when |
| --- | --- | --- |
| `TABLE_HEAD` | `label-cap text-footnote` | Props, ResultView, Markets/Simple, Match Fancy ladder, team ladders, ground ladders |
| `BOARD_HEAD` | `label-cap text-caption` | League leaderboards inside cards ([tournament-stats.tsx](../site/src/components/app/tournament-stats.tsx)) — denser, **not** full-bleed |

Phone bleed: `-mx-gutter border-y border-hairline`. From `lg`: `lg:mx-0`. Constants in `components/app/page.tsx` (`TABLE_HEAD` / `TABLE_BLEED`). See docs/SITE.md “Stats tables”.

---

## App design system

**Home:** `mobile/src/ui/*` + Expo Router screens in `mobile/src/app`. Tokens from the same `tokens.json` (colours as-is; space / type / radius / control derived; `tint` for heat / chip washes).

### Catalogue

| Job | Component | Kind |
| --- | --- | --- |
| Empty state | `ui/empty-state` | Mirror — required on unknown / error / empty drill-ins |
| Chips / filters | `Chips`, `ActiveChip`, `ChoiceChip`, `CapsuleTabs` | Compatible contract |
| Dense DataTable | `ui/data-table` (`bleed`, head = `type.footnote` + `cap`) | **Native twin** (flex rows, not HTML table) |
| Game log list | `Bleed` + press rows | Twin of web list |
| Skeletons | `ui/skeletons` + Reanimated | Twin |
| Segmented control | `Segmented` | **Native-exclusive** (SwiftUI / Compose) |
| Tab bar | NativeTabs / `FloatingTabBar` | **Native-exclusive** |
| Long lists | FlashList | **Native-exclusive** |
| Glass / blur | `GlassView` / `BlurBar` | **Native-exclusive** |
| Page header | `PageHeader` | Native chrome |
| Accordion | `ui/accordion` | Twin of filters/splits |

Screens declare which app-DS pieces they use; never import DOM/shadcn into Expo.

**Discarded:** `coming-soon.tsx` removed (unused). Do not reintroduce.

---

## Compatibility map

| Job | Web | App |
| --- | --- | --- |
| Empty state | `EmptyState` | `mobile/src/ui/empty-state` (compatible) |
| Chips / filters | `Chip` / `PillGroup` / `PillTabs` | `Chips` / `ActiveChip` / `ChoiceChip` / Capsule |
| Dense DataTable | `DataTable` (DOM) | Native `DataTable` flex rows — **twin** |
| Game log | bleed list | bleed list — **twin** |
| Skeletons | CSS shapes | Reanimated shapes — twin |
| Segmented control | PillGroup / Tabs | **Native-exclusive** Segmented |
| Tab bar | IosTabBar / sidebar | **Native-exclusive** NativeTabs / floating bar |
| Lists (long) | DOM scroll | **Native-exclusive** FlashList |
| Glass / blur chrome | CSS / limited | **Native-exclusive** GlassView / BlurBar |
| Sheets | Radix Sheet | Native form sheet / RN modal |
| Entity hero / header | `EntityHero` / `PageTitle` | `PageHeader` |
| Forms | `LiveForm` / Field | Accordion + ChoiceChip / sheets |
| Metric / StatTile | `Metric` / `StatTile` | `Metric` in `data-table` |
| Contact | mailto Card | Contact tab |
| Legal / Tools / Odds / Glossary | web-only | **Web-only on purpose** (no twins yet) |
| Ask LLM UI | removed (`/ask` → `/`) | — |
| ResultView | `/pair`, team markets | — (web-only) |
| Ads | `AdSlot` | — (web-only) |

When adding a web-only widget the app also needs, design the twin here first; do not force the web component into Metro.

**Filled:** dense `DataTable` + `Bleed` / `TABLE_BLEED` across Player, ResultView, Markets, Simple, team/league/ground/fancy; space/type/radius/control via `remPx`. Segmented, FlashList, GlassView / BlurBar, and NativeTabs stay native-exclusive by design.

---

## Endpoint matrix (web)

Full `App.tsx` route checklist:

| Route | Status | Notes |
| --- | --- | --- |
| `/` | Aligned | Home rail |
| `/fixture/*` (+ fancy / ground / scorecard) | Aligned | Props / Fancy / Grid / Trends |
| `/leagues`, `/league/:id` | Aligned | Boards + markets |
| `/props`, `/fancy` | Aligned | Screener lists |
| `/player/:id` | Aligned | Bleed tables + EmptyState |
| `/teams`, `/team/:id` | Aligned | Directory bleed; team markets ResultView |
| `/venue/:id` | Aligned | Ground |
| `/competitions` | Aligned | Markets list; EmptyState; GOVERNED |
| `/pair` | Aligned | ResultView host (not Ask); EmptyState idle; GOVERNED |
| `/saved` | Aligned | EmptyState |
| `/contact` | Aligned | Mailto Card; GOVERNED |
| `/tools`, `/odds`, `/glossary`, `/about`, `/players` | Secondary | Simple hub; tokens + EmptyState + PillGroup |
| `/trends` | Secondary | Tools-adjacent GridFilterBar |
| `/privacy-policy`, `/terms-of-use`, `/docs` | Secondary | Legal; GOVERNED |
| `/admin/ads` | Secondary | Admin; GOVERNED |
| `/auth/callback` | Infra | Auth only |
| `/design-system` | Catalogue | Living DS page; noindex; More nav |
| `*` | Aligned | EmptyState 404 |
| `/ask` | Redirect | → `/` — do not catalogue as Ask |

| Surface | Phone | `md` | `lg+` | Stats tables |
| --- | --- | --- | --- | --- |
| Home rail | Snap cards, tab bar | Same | Sidebar + rail; tape above full-width props | — |
| Player stats | Bleed game-log list; section pills | Same | `DetailSplit` + sticky Lines + dense game-log `DataTable`; Splits tabs | `TABLE_HEAD` + bleed |
| ResultView (`/pair`, team markets) | Bleed ladders / corr / log / splits | Same | Same | `TABLE_HEAD` + bleed |
| Markets (competition) | Bleed overview / teams / results | Same | Same | `TABLE_HEAD` + bleed |
| Simple (teams & venues) | Bleed directory table | Same | Same | `TABLE_HEAD` + bleed |
| Team / venue | Grid + ResultView markets | Same | Same | ResultView bleed |
| Competitions / Leagues | Tournament boards in cards | Same | Multi-col boards | `BOARD_HEAD` inset |
| Screener / filters | Sheet | Sheet | Drawer-friendly width | — |
| Fancy / props lists | Scroll + rows | Fancy `CardGrid` | Wider content; Props `PropTable` | — |
| Fixture | Scorecard card + chips | Same | Form two teams side-by-side; desktop back + crumbs | — |
| Match Fancy detail | Edge ladder + `TABLE_HEAD` | Same | `DetailSplit` + `StickyPanel` | `TABLE_HEAD` + bleed layout |
| Ground | Ladder / rates | Same | `DetailSplit` markets; matches stay stacked FixtureCards | bleed |
| Tools / Odds / Glossary / About / Players | Tokens + EmptyState | Same | Same | Odds StatTile; Teams PillGroup |
| Legal | PageTitle + prose | Same | Same | — |
| 404 | EmptyState | Same | Same | — |

---

## Screen matrix (app)

| Screen | App DS pieces |
| --- | --- |
| Home | FlashList / snap cards, EmptyState, skeletons, native tabs |
| Props / Fancy tabs | FlashList, EmptyState, prop / fancy row chrome |
| Leagues / Saved / Contact | EmptyState, lists / mailto |
| Search | EmptyState |
| Competitions | EmptyState on search miss |
| Player | EmptyState unknown/error/filter miss; Segmented; DataTable `bleed`; `Bleed` game log; ChoiceChip filters; PageHeader |
| Fixture | EmptyState gone / FC / no props / grid miss; Match header; Segmented |
| Fancy market drill-in | PageHeader only (no extra crumb); MatchFancy; EmptyState if gone |
| Team | EmptyState unknown / market errors; DataTable `bleed`; GridFilters |
| League | EmptyState unknown; TournamentStats; DataTable `bleed` |
| Ground / Venue | EmptyState; DataTable `bleed` |
| Info sheet | EmptyState when topic missing |
| Next match (on player) | DataTable `bleed` books; ChoiceChip NextFilters |

---

## Living catalogue (web)

**`/design-system`** (`site/src/pages/DesignSystem.tsx`) is the in-product reference: colour / type / space / motion swatches and live variants of buttons, chips, PillGroup / PillTabs, EmptyState, Note, StatTile, DataTable bleed, TeamBadge sizes, BookTable, LadderRow, forms, and icons. Linked from More → Design system. `noindex` (UNLISTED); no ads; loads without waiting on `matches.json`.

When you add a product component job, show a Spec on that page and update the catalogue tables above.

## Links

* Tokens edit: `site/packages/tokens/tokens.json` → `cd site && npm run tokens`
* Living page: `/design-system`
* Component / token history: [DESIGN_SYSTEM_CHANGELOG.md](DESIGN_SYSTEM_CHANGELOG.md) (append on every shared UI change)
* Centralization (DS ↔ product, variants, merge checklist): `.cursor/rules/design-system-centralization.mdc`
* Site UI rules: docs/SITE.md (structure, type/spacing, ads)
* App rules: docs/MOBILE.md, `mobile/AGENTS.md`
* Agents index: AGENTS.md “Where to look”
* Enforcement: `site/src/lib/design-tokens.test.ts` (GOVERNED + EmptyNote/lucide bans); mobile empty-contract tests under `mobile/src/ui/`

### Standalone catalogue hosting

The catalogue boots independently on `design.fancy.cash` and uses a light documentation palette. Attach that hostname to the web deployment and configure its DNS using the deployment provider's records. Set `VITE_DESIGN_SYSTEM_HOST` at build time to use a different hostname. The legacy `/design-system` URL redirects to the public hostname and preserves section anchors. The token reference still describes the product's shared tokens.

**Layout:** catalogue chrome reuses the **product** shell — `Header` (GlobalSearch, Auth/Sign-in, Saved), shadcn `Sidebar*` (same recipe as `layout/Shell.tsx`), and `IosTabBar`. Docs content uses a wider inset (`px-6` → `lg:px-12`) than product phone gutters so stages are not flush to the rail. The design host boots `AuthProvider` + `DataProvider` + feed prefetch so search has matches/players. Catalogue paths (`/`, `/docs/*`, `/search`) stay local; Saved, tab destinations, and search entity hits hand off to the product origin (`VITE_SITE_URL` or `https://fancy.cash`) via `lib/design-host.ts`. Home hides the docs sidebar but keeps Header + tab bar. `design-light` sets `--sidebar*` for the light rail. Data & metrics includes a live `ChartBars` stage.

**Content column (docs article):** right pane is a shadcn / Atlaskit-style article, not a product drill-in. `DocsArticle` (`docs-article.tsx`) provides `DocsPageHeader` (H1 + lead + source chip), optional **When to use**, body stages, sticky **On this page** TOC (`xl+`), and `DocsPager` prev/next cards. Live demos use `PreviewFrame` (H2 anchor, Preview toolbar, tall centered canvas); `ExampleStage` remains an alias. Reference blocks use `DocPanel`. Search and 404 use `EmptyState`.

**Navigation:** topic tree in `SidebarGroup`s; Foundations / Components / Patterns / Resources via `NAV_LINKS`. Components lands on `/docs/components`.

**Motion page:** `/docs/motion` — live curve demos + PillGroup spring (500 / 38); reduced motion zeroes duration.
