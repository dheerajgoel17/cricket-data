# Plan: migrate the site to React + Vite (shadcn/ui, Framer Motion, Watermelon UI)

Status: **implemented** (see the PR that adds `site/src`). Written 2026-10-27. Decisions taken: TypeScript for new code; Tailwind v4 + shadcn CLI as the base; path routes with a redirect for old hash links; cutover in one go (no /classic); Watermelon UI not used (docs unreachable, licence unverified). Goal: the props.cash look built from real libraries instead of hand-written CSS, without touching the data pipeline or the stats engine.

## 1. What exists today (measured)

| Part | Size | Fate |
|---|---|---|
| `site/public/js/engine/*` (plan, props, markets, stats, store, resolve, nl, filters, windows, lines...) | ~1,300 lines, pure ESM, no DOM | **Keep unchanged**; moves to `src/engine/`. Its node tests keep running as they are. |
| `site/api/ask.js` (question -> validated query plan) | 1 serverless function | **Keep unchanged** (`sanitizePlan` stays whitelist-only, hard rule 2). |
| UI: `app.js` 526, `pages2.js` 251, `render.js` 166, `playerapp.js` 189, `ui.js`, `shadcn.js`, `components.js`, `motion.js`, `ionic.js`, `assets.js`, `photos.js` | ~1,700 lines | **Rewritten as React components.** `shadcn.js`, `ionic.js`, `components.js` and the `--pc-*` CSS disappear (replaced by the real libraries). |
| `css/style.css`, `ui.css`, `app.css` | ~800 lines | Replaced by Tailwind + shadcn tokens. |
| Python site builder (`src/cricket_site`) and `public/data/*` | generated, not committed | **Unchanged.** Vite just serves/copies `public/`. |
| Deploy: `vercel.json` has `framework: null`, no build, `outputDirectory: public`; `site.yml` builds data, runs `npm test`, then `vercel deploy` | | Changes (section 5). |

Hash routes (`#/player/123`) and path URLs (`/player/123`) both work today. Both must keep working.

## 2. Target stack

- **Vite + React + TypeScript** (TS for new code; engine stays JS with JSDoc, no rewrite).
- **Tailwind CSS** + **shadcn/ui** (copied into `src/components/ui/` by the shadcn CLI; Radix primitives underneath). The props.cash palette (`#0F0F0F`, `#2A2A2A`, `#27DA8E`, `#9F9F9F`, `#2F2F2F`...) becomes the shadcn CSS variables once, in `src/index.css`.
- **Framer Motion** (`motion/react`): page transitions (`AnimatePresence`), pill indicator slide (`layoutId`), staggered stat tiles, bars growing from the baseline, press/hover springs. Respect `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`).
- **Watermelon UI**: a Tailwind + Radix component registry (MIT-licensed snippets seen on 21st.dev; I could not reach its official docs). Before using it: open ui.watermelon.sh, confirm the licence and install method, and pick components one by one (buttons, breadcrumbs, badges are what I saw). Treat it as an optional source of blocks on top of shadcn, not a base.
- **React Router**: `HashRouter` first (URLs keep working), switch to `BrowserRouter` once `vercel.json` rewrites are verified.
- **TanStack Query** for loading `data/*.json` (caching, loading and error states) in place of the hand-rolled loaders.
- **Vitest + React Testing Library** for components; keep `node --test` for engine and API; **Playwright** smoke tests at 375 / 768 / 1440.

All of this is free and MIT-licensed (hard rule 1 holds).

## 3. Phases (each ends with a green CI and a Vercel preview)

0. **Decisions** (section 7). Nothing else starts before these are answered.
1. **Scaffold** (small). Vite + React + TS + Tailwind + shadcn init; `src/engine` moved with `git mv`; engine and API tests still pass untouched. Old site keeps deploying from `public/` until cutover.
2. **Data layer** (small). `useStore()` over the existing `engine/store.js`, TanStack Query for fetches, error and skeleton states.
3. **Shell** (medium). Header (60px, centred 620px search, green CTA), left rail (268px) with shadcn `Sidebar`, bottom tab bar on phones, `Sheet` for filters (replaces the Ionic modal), `Tabs`/`ToggleGroup` for the pill rail and format switch (replaces `ion-segment`). Ionic is removed.
4. **Player page** (largest). Hero, stat grid, gauge, chart (own DOM/SVG bars with Motion, not a chart lib, so DNP/VOID/push rules stay exact), look-back bar, bookmaker lines, correlated props, game-log sheet. Port `windows.js`/`barState` usage as is.
5. **Other pages** (medium-large), in this order: home + fixtures, team, venue, Prop Hunter, Ask, trends, competitions, tools, glossary, saved, about.
6. **Motion pass** (small). Page transitions, shared-layout pill indicator, reduced-motion check.
7. **Build, CI, deploy** (section 5) and **cutover**.
8. **Cleanup.** Delete `css/*`, `shadcn.js`, `ionic.js`, `components.js`, `motion.js`; update `AGENTS.md` (rule 6 and "Vanilla JS, no build step"), `docs/PROJECT_GUIDE.md`, `docs/SITE.md`, `scripts/check_public_safe.py` (scan `src/`).

Rough effort by size: scaffold and data layer small; shell medium; player page largest; remaining pages medium-large together. I would not promise calendar time until phase 1 shows how clean the engine port is.

## 4. What must not change (acceptance checks)

- Every number still comes from the engine/data, never an LLM (hard rule 2); `api/ask.js` and `sanitizePlan` untouched.
- Formats stay separate; exchange void rules (DNP / VOID / N/A, pushes) intact; existing hand-computed tests pass unchanged.
- URLs: `#/player/123`, `/player/123`, deep links with `?stat=&line=&fmt=` keep working; `sitemap.xml` / `robots.txt` from the Python builder are still served.
- No hosted-service hostnames or home paths in tracked files (`check_public_safe.py`).
- Fixtures: `site/tests/fixtures` regeneration flow unchanged.

## 5. Build, CI and deploy changes

- `package.json` gains dependencies, so `npm test` is no longer install-free: CI runs `npm ci` first (cached). Engine tests can still run with plain `node --test`.
- `vercel.json`: `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`; keep the rewrite-to-index and the `api/ask.js` function config.
- `site.yml` order: Python builds `public/data` -> `npm ci` -> `npm test` + `vitest` -> `vite build` (copies `public/` into `dist/`) -> `vercel build` + `vercel deploy --prebuilt` (so the generated, uncommitted data is in the deployed output). Preview comment step stays.
- CI check names in AGENTS.md rule 6 (`build`, `site-js`, `test (3.10)`, `test (3.12)`) keep their names so branch protection does not break.
- Bundle budget: React + Motion + Radix is roughly 150-200 KB gzipped before pages; use route-level code splitting and keep the engine out of the first paint. Add a size check to CI.

## 6. Risks and how they are handled

| Risk | Mitigation |
|---|---|
| Big JSON loads delay first render | Skeletons (already designed), TanStack Query cache, lazy routes; measure before/after. |
| Rewrite regresses stats behaviour | Engine is not rewritten; pages are ported one at a time behind the old site; compare outputs on the same fixture players. |
| SEO (site is client-rendered today too) | Same as today; optional prerender of top routes later. |
| Visual drift from props.cash | Playwright screenshots at 3 widths + token check; fonts stay a system stack (Diatype is licensed). |
| Library churn | Pin exact versions; shadcn components are copied in, so they do not break on upgrade. |
| Watermelon UI licence / availability unverified | Verify before use; shadcn alone is sufficient if it fails. |

## 7. Decisions needed before starting

1. **TypeScript for new code?** (recommended: yes)
2. **Tailwind v4 + shadcn CLI** as the base, Watermelon UI only for extra blocks. OK?
3. **Cutover:** keep the old site deployed as `/classic` for a few weeks, or switch in one go?
4. **Router:** hash routes first (safe), path routes after. OK?
5. **Branching:** one long-lived `react-migration` branch with a PR per phase, or phases merged straight to `main` behind the old site?
6. **PR 41:** merge the current vanilla redesign first (so the React port has a visual reference and tokens), or close it and start clean?
