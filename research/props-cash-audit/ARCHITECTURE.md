# Recommended architecture

**Recommendation: Option A, keep React/Vite on the web, add Expo apps later, and extract the shared parts into packages first.** Do not adopt Tamagui now.

## Why (evidence from this repo)
- The logic worth sharing is already UI-free: `site/src/engine/*` is plain ESM with no DOM (AGENTS.md; node:test suites in `site/tests/`: `engine`, `windows`, `lines`, `live`, `tape`, `identity` …). It runs unchanged in React Native.
- The data layer is static JSON plus two serverless functions (`site/api/live.js`, `site/api/ask.js`) and TanStack Query (`site/src/lib/queries.ts`, `staleTime` 10 min, live `refetchInterval`). TanStack Query works in React Native as-is.
- The UI is the part that would not carry over: 31 shadcn/Radix files in `site/src/components/ui/` (Radix, `cmdk`, `sonner`, `embla-carousel-react` are DOM-only), Tailwind v4 classes everywhere, `@ionic/core` web components for the tab bar (`IosTabBar.tsx`), and `motion` for chart animation. Tamagui would replace all of these, not just restyle them.
- The chart is hand-built DOM, not a library: `ChartBars` in `site/src/components/app/chart.tsx` (53 lines, absolutely-positioned `div`s + Motion) and small inline SVG in `viz.tsx`. No charting dependency exists in `site/package.json` (verified: no recharts, d3, victory, chart.js, react-native). So there is no chart library to port; native will need its own bar renderer (`react-native-svg` or Skia) either way. The geometry (`barState`, ticks, top scaling) is the shareable part and lives in `engine/windows.js`.
- Props.Cash's own mobile design differs structurally from desktop (columns dropped, full-screen filter page, floating pill nav, FAB). That argues for platform-specific shells over one shared component tree; sharing components would force the lowest common denominator on a dense table.

## Option comparison
| | A. Vite web + Expo (recommended) | B. Tamagui + RN-Web | C. Next.js / Solito + Expo |
|---|---|---|---|
| Initial effort | Small now (extract packages), medium for Expo later | Large: replace ~31 ui files, ~25 app components, 8 pages and all Tailwind classes before any native work | Large: router/SSR change plus Expo |
| Migration cost | Low, web keeps shipping | High, regressions across 466-line `Player.tsx` etc. | Medium-high |
| Shared UI code | Low (tokens, formatting, hooks) | High (but web density suffers) | Medium |
| Shared business logic | High (engine, types, queries) | High | High |
| Web perf / SEO | Keep current Vite + `scripts/seo.mjs`; add prerender if needed | RN-Web adds runtime weight | Best SSR story, not needed today |
| Dense tables, touch | Best on each platform (DOM table / FlashList) | RN-Web tables are awkward | Same as A on web |
| Native navigation | Native (Expo Router / React Navigation) | Same | Same |
| Testing | Keep node:test + Vitest; add Jest/RNTL for app | Rewrite component tests | Mixed |
| Lock-in risk | Low | High (framework-specific styling) | Medium |

Option B is only justified if you want one component tree on both; the audit gives no evidence that the product benefits. Option C buys SSR the product does not currently need.

## Target repo structure (staged, nothing moves until a stage is approved)
```
cricket-data/
  packages/
    engine/        # move site/src/engine (plain ESM + JSDoc types), keep its node tests
    data-client/   # loaders + TanStack Query options + types from site/src/lib/{data,queries,live-cache}.ts
    tokens/        # tokens.json -> CSS vars (web) + TS object (native), generated from site/src/index.css
    format/        # site/src/lib/format.ts, books.ts, heat.ts, hot-lines.ts, priority.ts (pure helpers)
  site/            # Vite web app, imports the packages
  apps/mobile/     # Expo (later)
```
Use npm workspaces; no build step for packages at first (ESM source, Vite/Metro both transpile it).

## Sharing boundaries
Share: engine, types, query options, API clients (`/data/*`, `/api/live`), formatters, hit-rate / window logic, design tokens, copy and glossary, analytics event names.
Do **not** share: shadcn/Radix components, Tailwind classes, `ChartBars`, router, Ionic tab bar, page layouts, SEO/prerender.

## Migration strategy
1. Extract `engine` and the pure `lib/` helpers into packages; fix imports with path aliases (`@/engine/*` → package). Gate: `npm test`, `npm run build` unchanged.
2. Generate tokens from one source (see DESIGN_SYSTEM.md); web consumes them as CSS variables, so no visual change.
3. Redesign web mobile-first against the new tokens (separate PRs, one workflow each).
4. Spike Expo with one screen (player chart) reading the same JSON/live API; validate chart rendering and the live 15 s poll before committing to a native roadmap.
5. Only if the spike shows heavy duplication in presentational atoms, extract a small `ui-primitives` layer (tokens-driven, not Tamagui).

## Risks
- Two UI codebases will drift. Mitigation: tokens + engine are the contract; a screen inventory in docs; shared test fixtures (`site/tests/fixtures/`).
- Generated data is not committed (`site/public/data/`), so Expo needs a configured data base URL (env var, per AGENTS.md rule 4: no hosted hostnames in tracked files).
- No service worker exists today (verified), so offline/PWA claims should not be assumed.

## Decisions applied (2026-10-31): both stores, no login
- **iOS and Android at launch:** one Expo app covers both; the step 4 spike must run on both platforms (chart rendering, 15 s live poll, long dense lists).
- **No accounts:** there is no auth, session or per-user backend, so the apps are read-only clients of the same static JSON and `/api/live`. Storage for stars, saved filters and recent players sits behind a small `storage` interface in a shared package (`packages/data-client`), with localStorage (web) and AsyncStorage/MMKV (native) adapters. The existing `site/src/lib/saved.ts` is the starting point.
- **Cross-device without login:** encode a saved filter combo as a URL/deep link (`/props?...`) that opens in the web or the app; optionally export/import as copyable text. Do not add a server store.
- **Free forever means no entitlement layer:** drop Props.Cash-style trial meters and Pro gates from every pattern in this audit; every screen documented there is fully available.
- **Store policy:** the apps show betting-related stats; check App Store and Google Play rules for gambling-adjacent content (no wagering in-app, no affiliate links, age rating) before building the listing.
