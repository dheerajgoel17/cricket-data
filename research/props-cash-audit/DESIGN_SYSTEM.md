# Proposed mobile-first design system

Legend: **[Observed]** = seen on Props.Cash (measured from screenshots, approximate); **[Ours]** = existing value in `site/src/index.css`; **[Proposal]** = my recommendation. Do not copy Props.Cash's name, logo, photography, wording or exact colours.

## Starting point: you already match most of it
`site/src/index.css:16-100` already defines a dark, near-black, iOS-flavoured token set: `--background #000`, `--card #1c1c1e`, `--primary/--hit #27da8e`, `--miss #ff0000`, `--dnp #999`, `--amber #f5a524`, `--radius .75rem`, control height 36 px, tab bar 49 px, Geist Variable font, fixed type scale (`--fs-display … --fs-caption`), gutters 14 px → 20 px at 768 px, extra step at 1024 and 1440 px. The redesign is mostly layout and density, not a new palette.

## Observed on Props.Cash
- Page background ≈ `#0f0f0f` (computed), cards slightly lighter, hairline borders, one green accent used for hit rate, primary buttons and active nav; red for misses/bad grades; amber for the trial meter. Body font "Diatype" (proprietary; do not use).
- Desktop: ~267 px sidebar, ~60 px header under a 35 px announcement strip, content fluid, filters in a ~420 px right drawer, prop rows 72 px, pill chips ~40 px high, fully rounded.
- Chart: green/red bars with the value inside each bar, a single white line-level rule, date + opponent labels under bars, 340 px-ish tall on desktop and ~150 px on mobile, 5–10 bars by default.
- Mobile: top bar 56 px, sticky pill rows, rows ~72 px (avatar, name, line, edge, sparkline), floating translucent pill nav and circular filter FAB, filters as a full-screen page.

## Proposal for the cricket product
**Colour (tokens, dark first, light optional):** keep current tokens. Add semantic aliases `--surface-1/2/3` (card, popover, accent), `--hit`, `--miss`, `--push` (amber), `--dnp`, and a 5-step heat scale (`site/src/lib/heat.ts`) for hit rate. Ensure `--muted-foreground #8e8e93` on `#000` stays ≥ 4.5:1 for body, check on `--card`.
**Type:** keep Geist; roles `display 24–28`, `title 18`, `body 15`, `callout 13`, `footnote 12`, `caption 10`, `metric 20`, `stat 30` (already in CSS). Use tabular numerals for all stats.
**Spacing:** 4 px base (4, 6, 10, 14, 20 as in `--space-*`).
**Radii:** chips 999 px, controls 12 px, cards 12–16 px, sheets 20 px top corners.
**Heights:** control 36–44 px (use 44 px for primary mobile tap targets), row 56–72 px, header 56 px, tab bar 49 px + safe area.
**Breakpoints:** 0–767 mobile (single column), 768 tablet (2 columns, drawer filters), 1024 desktop (sidebar + content), 1440 wide (add right rail).

## Components
- **Buttons:** primary (accent fill), secondary (surface), ghost/icon (circular 36–44 px). One primary per view.
- **Player prop row (mobile):** avatar 40 px · name + team/role · line + best price (decimal) · hit-rate chip with colour · 10-bar sparkline. Tap = open detail. Keep star at the trailing edge. Desktop adds columns for season, H2H, matchup grade, price edge (observed: 2026, H2H, DVP, MATCHUP, EDGE).
- **Metric cards:** label (caption) over value (metric), arrow for trend. Detail header stat strip = 2 × 3 grid on mobile.
- **Filter chips:** horizontally scrolling pill rows for window (Season/H2H/Venue/L5/L10) and market (Runs/Wickets/…); active chip filled. Chips show their value (accordion headers with value chips, observed).
- **Search:** global; results grouped (Players, Teams, Fixtures, Competitions) each with a quick action ("Props").
- **Tabs:** pill tab bar for windows and for chart/table views.
- **Sheets/drawers:** web ≥ 1024: right drawer 420 px. Mobile: use a real bottom sheet for line stepper/alt lines and a full-screen page only for the long filter form (observed pattern), with sticky "Clear / Save" footer.
- **Tables:** sticky first column, horizontal scroll with fade edge, row heights 56 px, hide low-priority columns below 768 px rather than shrinking text.
- **Charts:** reuse `ChartBars` behaviour (`site/src/components/app/chart.tsx`): value in bar, line rule, DNP stub, newest on the right; add window tabs and a line stepper below; tap bar = tooltip/bottom sheet with fixture details.
- **Empty states:** icon + one line + one next action ("Star a prop to track it").
- **Skeletons:** match final row/chart geometry (existing `skeletons.tsx`).
- **Navigation:** mobile bottom bar with 3–4 destinations (Fixtures, Props, Fancy, Saved) + filter FAB on list screens; desktop sidebar. Keep the iOS tab bar look the team already chose (see memory: classic iOS, no liquid glass).

## Cricket adaptations
Replace NFL-style "DvP" with opposition-vs-format rank and venue; prop families are runs, wickets, fours/sixes, partnership and fancy lines; windows are last N innings, by format (T20/ODI/Test/Hundred/T10/O60 never mixed), by venue and vs opponent; "DNP" vs void states already exist in `barState`.
