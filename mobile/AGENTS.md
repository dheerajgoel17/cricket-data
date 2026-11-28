# mobile/: the Fancy.cash iOS and Android app (Expo, React Native)

Read [../AGENTS.md](../AGENTS.md) and [../docs/MOBILE.md](../docs/MOBILE.md) first. The hard rules there apply here (free only, optional Supabase Auth for Saved, no secrets or hosts in tracked files).

## Expo changes every release: read the matching docs
Before writing code against an Expo or React Native API, read the `expo` major version in `package.json` and fetch `https://docs.expo.dev/versions/v<major>.0.0/` (index of everything: `https://docs.expo.dev/llms.txt`). Do not code from memory.
Install packages with `npx expo install <package>`, never plain `npm install`, so the SDK-compatible version is picked.

## Commands
```bash
npm run typecheck      # tsc
npm test               # jest-expo: unit tests of the logic (rail order, polyfills, storage, card, format, nav, player chart numbers)
npx expo export --platform ios --platform android --output-dir /tmp/app-export   # proves Metro can bundle both platforms (CI does this)
npm run web            # browser preview on :8082: compare with the live site at 375 px (Metro proxies the site, dev-proxy.js)
npx expo run:ios       # needs full Xcode
npx expo run:android   # build and run on an emulator or phone (needs a JDK; ANDROID_HOME set); not rendered for now
```

## Rules
* Shared, not copied: `@cricket/engine`, `@cricket/storage`, `@cricket/tokens` and `@site/lib/priority`, `@site/lib/home-phase` come from `../site` (see `metro.config.js`, `tsconfig.json`). Import only pure files from `site/src`; never a hook, component or anything with `@/` aliases or the DOM.
* Colours and size roles come from `site/packages/tokens/tokens.json`; `src/ui/tokens.ts` derives space / type / radius / control (same names as the site). Catalogue and native twins: `docs/DESIGN_SYSTEM.md`.
* Match the site's Home (`site/src/pages/Home.tsx`, `components/app/fixture-card.tsx`): when the web logic changes, change its mirror in `src/lib/rail.ts` / `card.ts` too (docs/MOBILE.md).
* Type is the site's pairing: `font.*` (Satoshi) for text and titles, `cap` / `num` / `numLg` (Barlow Condensed for the 11 pt uppercase labels and all numbers); never a system-font weight. Text honours the phone's font-size setting up to a per-platform cap (`ui/text.tsx`, `ui/platform.ts`) and never takes a literal `fontSize` / colour (`ui/tokens.test.ts`). Use the shared pieces before writing a new one: `PageHeader` / `RoundButton` (`ui/round-button`), `Sheet` (`ui/sheet`), `CapsuleTabs`, `Segmented` (native), `Accordion`, `BlurBar`, `Working` (centred loader), `InfoButton` (topics in `lib/info.ts`).
* Keep the main thread free: heavy loops give it back after 8 ms on iOS / 6 ms on Android (`FRAME_MS` in `lib/hot.ts` and `lib/polyfills.ts`; Android rests 12 ms between slices so cold-start scoring stays ~⅓ busy); animate on the UI thread (Reanimated), and rise-in animations only for the first rows of a list. Android Home must not pull `matches.json` or unwrap `/api/live` during the first paint — use `useLive({ defer })`, `seedOnly`, and keep Fancy off (`use-hot-home`). Tab/page opens use `useStore` (never raw `storeQuery` / never `useLinesLive` as a store trigger) so chrome paints before `matches.json`. First open of a lazy tab / Home props / player & fixture bodies use `lazyTab` / `keptTab` / `useLater` (`startTransition`) so the mount is interruptible. Hidden tabs are frozen (Suspense; Expo Router 58 ignores `freezeOnBlur`).
* Smooth means 60 fps on a mid-range Android: no live blur (headers are a solid elevated tint on every platform), no spinners (skeletons: `Working`, `Skeleton` / `SkeletonGroup` opacity pulse), long lists in `FlashList`, a clock that ticks inside the smallest component that shows it (never a page), taps through `push` in `lib/nav.ts` (drops a ghost second tap), heavy loops resting between slices (`lib/hot.ts`), animations on transform and opacity. The Android emulator renders in software and cannot show 60 fps: compare with its Settings app as a control and judge on a phone.
* Motion: `ui/press.tsx` is the one pressable — Reanimated 4 **CSS transition** on `transform` (120 ms, `transitionTimingFunction: "ease-out"` only — do not pass a `cubic-bezier(...)` string; Reanimated 4.7 rejects it). Default scale `0.97` on compact controls; `scale={1}` (full-width rows) or reduce-motion is a plain `Pressable`. Never call `tint.*` / other JS helpers inside `useAnimatedStyle` (precompute colours). Numbers that change count with `ui/count-up.tsx`; no `entering` on FlashList rows; static when reduce-motion is on.
* Dark only — elevated canvas `#0C0C0E` (never true black). Stack/detail pages wrap `ui/page-atmosphere`; player / team add `EntityHeroWash` from `entity-accents`. Sticky chrome: `BlurBar merge` + `useChromeScrim` (clear → solid elevated on player + fixture). The floating tab bar on iOS, Android and the Expo web preview collapses to the active tab on downward scroll. Keep the surface tinted and the list clearance fixed. See the [floating navigation dock](../docs/DESIGN_SYSTEM.md#floating-navigation-dock). `Segmented` is the shared JS control on iOS too (no SwiftUI glass Picker).
* The native folders `android/` and `ios/` are generated (`expo prebuild`) and not committed.
