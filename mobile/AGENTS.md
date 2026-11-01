# mobile/: the Fancy.cash iOS and Android app (Expo, React Native)

Read [../AGENTS.md](../AGENTS.md) and [../docs/MOBILE.md](../docs/MOBILE.md) first. The hard rules there apply here (free only, no accounts, no secrets or hosts in tracked files).

## Expo changes every release: read the matching docs
Before writing code against an Expo or React Native API, read the `expo` major version in `package.json` and fetch `https://docs.expo.dev/versions/v<major>.0.0/` (index of everything: `https://docs.expo.dev/llms.txt`). Do not code from memory.
Install packages with `npx expo install <package>`, never plain `npm install`, so the SDK-compatible version is picked.

## Commands
```bash
npm run typecheck      # tsc
npm test               # jest-expo: unit tests of the logic (rail order, polyfills, storage)
npx expo export --platform ios --platform android --output-dir /tmp/app-export   # proves Metro can bundle both platforms (CI does this)
npx expo run:android   # build and run on an emulator or phone (needs a JDK; ANDROID_HOME set)
npx expo run:ios       # needs full Xcode
```

## Rules
* Shared, not copied: `@cricket/engine`, `@cricket/storage`, `@cricket/tokens` and `@site/lib/priority`, `@site/lib/home-phase` come from `../site` (see `metro.config.js`, `tsconfig.json`). Import only pure files from `site/src`; never a hook, component or anything with `@/` aliases or the DOM.
* Colours come from `site/packages/tokens/tokens.json`; sizes are native (HIG / Material) under the same role names (`src/ui/tokens.ts`).
* Dark only. iOS uses the system tab bar and `GlassView` (liquid glass on iOS 26+); Android has no system glass, so surfaces are a `BlurView` of the `BlurTargetView` (never inside it) or a solid tint (`src/ui/glass.tsx`).
* The native folders `android/` and `ios/` are generated (`expo prebuild`) and not committed.
