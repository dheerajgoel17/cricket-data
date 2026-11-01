import Constants from "expo-constants";
import { Platform } from "react-native";

/** The site the app reads (data files, /api/live). Set `EXPO_PUBLIC_SITE_URL` in mobile/.env.local; it is never written in a tracked file. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

/** Android's default user agent (okhttp) is on the data gate's block list, so every request names the app instead. */
export const USER_AGENT = `FancyCash/${Constants.expoConfig?.version ?? "0"} (${Platform.OS})`;
