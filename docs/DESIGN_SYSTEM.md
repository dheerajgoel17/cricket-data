# Design system (Web + App)

Fancy.cash has **two design systems** that share one contract: tokens, type roles, spacing roles, and component **jobs**. The web DS lives in `site/` (responsive). The app DS lives in `mobile/src/ui` (React Native). Reuse a web pattern on native only when it works; otherwise ship a **native-designed twin** with the same job and tokens.

No rebrand. No paid UI kit. Dark only. Free MIT only. **Icons in product code (`components/app`, `pages`, `mobile/src`): Heroicons / Ionicons — never Lucide.** (shadcn `components/ui/*` may still ship CLI Lucide until those files are edited.)

## Foundations (shared)

| Layer | Source | Web | App |
| --- | --- | --- | --- |
| Colours, space, type sizes, motion, breakpoints | `site/packages/tokens/tokens.json` | `npm run tokens` → `site/src/tokens.generated.css` + Tailwind roles | `mobile/src/ui/tokens.ts` derives px from the same JSON (`remPx`); `tint.*` for rgba washes |
| Type pairing | Satoshi UI + Barlow Condensed figures / `label-cap` | `index.css` `@utility label-cap` / `num-cond` | `font`, `cap`, `num`, `numLg` |
| Layout roles | gutter, control, row-min, header-h | CSS vars + utility classes | `space.gutter`, `control`, `HEADER_HEIGHT` |
| Rules | Named roles only on migrated surfaces | `design-tokens.test.ts` GOVERNED list | Same role names; values from tokens |

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
| `lg` (1024+) | Sidebar nav; Player Lines ladder sticky column; `lg:mx-0` ends table bleed; desktop back by title |

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
| `/teams`, `/team/:id` | Aligned / Partial | Directory bleed; team markets ResultView |
| `/venue/:id` | Aligned | Ground |
| `/competitions` | Partial | Markets list; EmptyState |
| `/pair` | Partial | ResultView host (not Ask); EmptyState idle |
| `/saved` | Aligned | EmptyState |
| `/contact` | Aligned | Mailto Card; GOVERNED |
| `/tools`, `/odds`, `/glossary`, `/about`, `/players` | Secondary | Simple hub; tokens + EmptyState + PillGroup |
| `/trends` | Secondary | Tools-adjacent GridFilterBar |
| `/privacy-policy`, `/terms-of-use`, `/docs` | Secondary | Legal; GOVERNED |
| `/admin/ads` | Secondary | Admin light pass |
| `/auth/callback` | Infra | Auth only |
| `/design-system` | Catalogue | Living DS page; noindex; More nav |
| `*` | Aligned | EmptyState 404 |
| `/ask` | Redirect | → `/` — do not catalogue as Ask |

| Surface | Phone | `md` | `lg+` | Stats tables |
| --- | --- | --- | --- | --- |
| Home rail | Snap cards, tab bar | Same | Sidebar + rail | — |
| Player stats | Bleed tables / game log; section pills | Same | Lines ladder sticky; bleed inset | `TABLE_HEAD` + bleed |
| ResultView (`/pair`, team markets) | Bleed ladders / corr / log / splits | Same | Same | `TABLE_HEAD` + bleed |
| Markets (competition) | Bleed overview / teams / results | Same | Same | `TABLE_HEAD` + bleed |
| Simple (teams & venues) | Bleed directory table | Same | Same | `TABLE_HEAD` + bleed |
| Team / venue | Grid + ResultView markets | Same | Same | ResultView bleed |
| Competitions / Leagues | Tournament boards in cards | Same | Multi-col boards | `BOARD_HEAD` inset |
| Screener / filters | Sheet | Sheet | Drawer-friendly width | — |
| Fancy / props lists | Scroll + rows | Same | Wider content | — |
| Fixture | Scorecard card + chips | Same | Desktop back + crumbs | — |
| Match Fancy detail | Edge ladder + `TABLE_HEAD` | Same | Sticky ladder column | `TABLE_HEAD` + bleed layout |
| Ground | Ladder / rates | Same | Same | bleed |
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

**`/design-system`** (`site/src/pages/DesignSystem.tsx`) is the in-product reference: colour / type / space / motion swatches and live variants of buttons, chips, PillGroup / PillTabs, EmptyState, Note, StatTile, DataTable bleed, forms, and icons. Linked from More → Design system. `noindex` (UNLISTED); no ads; loads without waiting on `matches.json`.

When you add a product component job, show a Spec on that page and update the catalogue tables above.

## Links

* Tokens edit: `site/packages/tokens/tokens.json` → `cd site && npm run tokens`
* Living page: `/design-system`
* Site UI rules: docs/SITE.md (structure, type/spacing, ads)
* App rules: docs/MOBILE.md, `mobile/AGENTS.md`
* Agents index: AGENTS.md “Where to look”
* Enforcement: `site/src/lib/design-tokens.test.ts` (GOVERNED + EmptyNote/lucide bans); mobile empty-contract tests under `mobile/src/ui/`
