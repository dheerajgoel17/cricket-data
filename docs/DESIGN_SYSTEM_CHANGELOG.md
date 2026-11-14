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
