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

/**
 * Where each match's permanent archive file lives (every line the books priced for it, kept for good): `EXPO_PUBLIC_ARCHIVE_URL` in mobile/.env.local, never written in a tracked file.
 * Without it a finished match whose lines the live feed has let go simply has no props to show.
 */
export const ARCHIVE_URL = (process.env.EXPO_PUBLIC_ARCHIVE_URL ?? "").replace(/\/$/, "");
