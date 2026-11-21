# Web ↔ app parity checklist

Working list for bringing the app (`mobile/`) and the web (`site/`) onto one design system. Status: **ok** = matches and was seen working on a phone (Android, release build, 2026-11-15); **code** = matches in code, not yet seen on a device; **gap** = missing or different; **web-only** = on purpose. Update the status as items are verified; add a line to `DESIGN_SYSTEM_CHANGELOG.md` for any new shared piece.

## A. Foundations

| # | Foundation | Web | App | Status |
| --- | --- | --- | --- | --- |
| A1 | Colour tokens | `tokens.json` → CSS | `ui/tokens.ts` `color` / `tint` | ok (no literals; test) |
| A2 | Type scale (size, line-height, tracking) | `text-*` roles | `type.*`, `fs.*` | ok |
| A3 | Weights (editorial 300 / copy 400 / label 500 / emphasis 700) | `font-*` | `font.*`, `type.heading` | ok; bold only for names, scores, hero lines, prices, tags |
| A4 | Spacing roles | `gap-*` / `p-*` | `space.*` | ok |
| A5 | Page rhythm (within 10, between 16, section 32, top 16, inline 14) | `gap-snug/stack/section` | `rhythm` | code (applied to Search, Saved, Leagues, League, Team, Info, Home props, Fancy detail, Fixture) |
| A6 | Radii | `--radius-*` | `radius.*` | ok |
| A7 | Surfaces | `Card`, flat bleed | `surface.card`, `Bleed` | ok (League seen) |
| A8 | Motion durations and springs | `--duration-*`, motion/react | `duration`, `spring` | code (tokens added; literals migrated) |
| A9 | Easing | `--ease-*` | `ease` | code |
| A10 | Elevation | `--shadow-*` | `elevation` on Android, shadow on iOS | gap: no token-driven app elevation yet |
| A11 | **Layout grid** (columns, margins, gutters per breakpoint) | Tailwind breakpoints only | one phone column | **gap**: define `grid` tokens (4 / 8 / 12 columns), `useGrid`, document |
| A12 | Font scaling (OS setting) | `rem` zoom | capped 1.3 iOS / 1.2 Android | code |
| A13 | Touch targets | 44 px | 44 pt / 48 dp, `hitSlopFor` | code (not applied to every small control) |

## B. Components

| # | Job | Web | App | Status |
| --- | --- | --- | --- | --- |
| B1 | Bottom sheet | `Sheet` (shadcn) | `ui/sheet` | code |
| B2 | Round icon button | header icon buttons | `RoundButton` | code |
| B3 | Chips / filters | `PillGroup`, `Chip` | `Chips`, `ChoiceChip`, `ActiveChip` | ok (Props seen) |
| B4 | Scrolling row, edge to edge (no fade) | `ScrollRow`, `PillGroup` | `HScroll` | code |
| B5 | Section tabs | `PillTabs` / `Tabs` | `LineTabs` (Home, player, league, team), `Chips` (team formats), `CapsuleTabs` (fixture), `Segmented` (venue, ground) | code (league, team done); gap: venue / ground still use `Segmented` |
| B6 | Page header | `Header` + `PageTitle` | `PageHeader`, brand bar | code (League no longer repeats its title) |
| B7 | Fixture card | `fixture-card` | `ui/fixture-card` | ok (Home seen) |
| B8 | Props row | `hot-props` | `ui/prop-row` | ok (Props seen) |
| B9 | Fancy row | `fancy-lines` | `ui/fancy-row` | code |
| B10 | Live board | `live-board` | `ui/live-board` | code |
| B11 | Market tape (high odds hits) | `market-tape` | `ui/market-tape` | ok (Home seen) |
| B12 | Skeletons | `skeletons` | `ui/skeletons` | code |
| B13 | Data table / bleed | `DataTable` | `ui/data-table` | ok (League seen) |
| B14 | Tournament stats | `tournament-stats` | `ui/tournament-stats` | ok (League seen) |
| B15 | Empty state | `EmptyState` | `ui/empty-state` | code |
| B16 | Error boundary | `error-boundary` | none | **gap** |
| B17 | Player picker, odds table, forms, result view, alt lines, viz, home mix table, live feed, note | web | none | web-only on purpose (Tools / Odds); confirm per item |
| B18 | Ads | `ad-slot`, `stats-ad` (catalogue cleared; remount later) | none | web-only (app is free, no ads) |

## C. Motion

| # | Interaction | Web | App | Status |
| --- | --- | --- | --- | --- |
| C1 | Press | `:active` scale | `Press` 0.97, 150 ms token | code |
| C2 | Chip select | `layoutId` glide | colour fade (`Chips`) | ok (twin) |
| C3 | Underline tabs | `layoutId` | `LineTabs` spring | ok (Home seen) |
| C4 | Segmented thumb | glide | `Segmented` timing | code |
| C5 | Number change | `AnimatedNumber`, `Tick` | `CountUp`, `Tick` | code |
| C6 | Entrance | motion fade-up | `Rise` / `enter` | code |
| C7 | Live dot | `animate-ping` | `LiveDot` halo | ok (Home seen) |
| C8 | Skeleton | `animate-pulse` | `Skeleton` pulse | code |
| C9 | Accordion / collapse | `animated-height` | `Collapsible`, `Accordion` | code |
| C10 | Sheet open / close | shadcn animate-in/out | Modal slide | code |
| C11 | Page transition | route fade | native stack | code |
| C12 | Star / save | `star.tsx` | `ui/star` | code |
| C13 | Reduce motion | `useReducedMotion` | `useReducedMotion` | code |
| C14 | Edge fade on scroll | removed (rows run edge to edge) | removed | decision 2026-11-15 |
| C15 | Haptics on select | n/a | `Haptics.selectionAsync` | code |

## C2. Added in the second pass

| # | Item | Web | App | Status |
| --- | --- | --- | --- | --- |
| B19 | Filters button | `FilterButton` | `FilterButton` | ok (Props filters seen) |
| B20 | Primary / secondary button | `Button` (shadcn) | `Button` | ok (Contact, sheets, sign-in seen) |
| B21 | Search box | header `SearchField` | `SearchField` | ok (Competitions seen) |
| B23 | Entity wash through the chrome (header, tabs, sidebar) | `usePageWash` + `PageWashLayer` | `PageAtmosphere` + `EntityHeroWash` | ok (web seen at phone and desktop width; app seen on the phone) |
| B22 | Icon on a circle | n/a | `IconBadge` | ok (Contact seen) |
| C16 | List reflow (reorder, removal) | `ReflowGroup` / `ReflowItem` | `Reflow` | code (needs a hand on the phone) |
| C17 | Instant choice highlight | n/a (DOM already instant) | `useChoice` | ok (chips, sheets measured) |

## D. Work order

1. **Device pass** (cannot be done from here without taps; deep links and screenshots only): open each screen above marked "code", confirm it renders and the motion plays; flip the status.
2. **B5 / B6**: use `LineTabs` or chips for League / Team / Venue sections; drop the duplicate title on League.
3. **A11 grid** tokens and `useGrid`; apply to the fixture rail and card widths.
4. **A10 elevation** tokens.
5. **B16** error boundary in the app.
6. Re-measure jank (`dumpsys gfxinfo`) and update `PR` numbers.
