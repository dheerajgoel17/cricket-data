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
* Colours come from `site/packages/tokens/tokens.json`; sizes are native (HIG / Material) under the same role names (`src/ui/tokens.ts`).
* Match the site's Home (`site/src/pages/Home.tsx`, `components/app/fixture-card.tsx`): when the web logic changes, change its mirror in `src/lib/rail.ts` / `card.ts` too (docs/MOBILE.md).
* Type is the site's pairing: `font.*` (Satoshi) for text and titles, `cap` / `num` / `numLg` (Barlow Condensed for the 11 pt uppercase labels and all numbers); never a system-font weight. Text ignores the phone's font-size setting on purpose (`ui/text.tsx`): the sizes are the design's. Use the shared pieces before writing a new one: `PageHeader` / `RoundButton`, `CapsuleTabs`, `Segmented` (native), `Accordion`, `BlurBar`, `Working` (centred loader), `InfoButton` (topics in `lib/info.ts`).
* Keep the main thread free: heavy loops give it back after 8 ms (`FRAME_MS` in `lib/hot.ts` and `lib/polyfills.ts`); animate on the UI thread (Reanimated), and rise-in animations only for the first rows of a list.
* Smooth means 60 fps on a mid-range Android: no live blur (iOS only; Android bars are a solid tint), no spinners (skeletons: `Working`, `Skeleton`), long lists in `FlashList`, a clock that ticks inside the smallest component that shows it (never a page), taps through `push` in `lib/nav.ts` (drops a ghost second tap), heavy loops resting between slices (`lib/hot.ts`), animations on transform and opacity. The Android emulator renders in software and cannot show 60 fps: compare with its Settings app as a control and judge on a phone.
* Motion: `ui/press.tsx` is the one pressable (spring scale on the UI thread); numbers that change count with `ui/count-up.tsx`; selection highlights glide, bars and rings draw in; all on transform and opacity, never layout, and static when the phone's reduce-motion is on. `ui/tokens.ts` `tonal` is the card surface.
* Dark only. iOS uses the system tab bar and `GlassView` (liquid glass on iOS 26+); Android has no system glass, so surfaces are a `BlurView` of the `BlurTargetView` (never inside it) or a solid tint (`src/ui/glass.tsx`).
* The native folders `android/` and `ios/` are generated (`expo prebuild`) and not committed.
