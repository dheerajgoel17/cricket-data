import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * The site the app reads (data files, /api/live). Set `EXPO_PUBLIC_SITE_URL` in mobile/.env.local; it is never written in a tracked file.
 * In the browser preview (`npm run web`) Metro stands in for the site (`dev-proxy.js`).
 */
export const SITE_URL = Platform.OS === "web" ? "/__site" : (process.env.EXPO_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

/** Android's default user agent (okhttp) is on the data gate's block list, so every request names the app instead. */
export const USER_AGENT = `FancyCash/${Constants.expoConfig?.version ?? "0"} (${Platform.OS})`;

/** An image address from the data: a host-relative one (`/books/bet365.svg`) is on the site, a full one is used as it is. */
export const abs = (u: string) => (u.startsWith("/") ? SITE_URL + u : u);

/** Source image CDN (`EXPO_PUBLIC_IMG_CDN` in `.env.local`, same value as the site's `VITE_IMG_CDN`). Wired into `@cricket/engine/photos` at boot. */
export const IMG_CDN = (process.env.EXPO_PUBLIC_IMG_CDN ?? "").replace(/\/$/, "");

/**
 * Where each match's permanent archive file lives (every line the books priced for it, kept for good). The site reads the same folder (`ARCHIVE` in site/src/lib/feeds.ts); `EXPO_PUBLIC_ARCHIVE_URL`
 * overrides it. Without an archive a started match, whose pre-match props the live book file has let go, has no Props tab.
 */
export const ARCHIVE_URL = (process.env.EXPO_PUBLIC_ARCHIVE_URL || "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/archive").replace(/\/$/, "");
