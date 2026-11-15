/** Android app install link for the mobile-web promo banner. */

export const ANDROID_APP_DISMISS_KEY = "cph-android-app-banner";

/** Install URL: `VITE_ANDROID_APP_URL` when set (Play Store later), else the public latest-release page. */
export function androidAppUrl(): string {
  const fromEnv = String(import.meta.env.VITE_ANDROID_APP_URL || "").trim();
  if (fromEnv.startsWith("http")) return fromEnv;
  return "https://github.com/dheerajgoel17/cricket-data/releases/latest";
}

/** True on Android browser webviews that are not an installed PWA / home-screen app. */
export function androidAppBannerEligible(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
  {
    standalone = typeof window !== "undefined"
      && (window.matchMedia("(display-mode: standalone)").matches
        || ("standalone" in navigator && !!(navigator as Navigator & { standalone?: boolean }).standalone)),
    dismissed = typeof localStorage !== "undefined" && localStorage.getItem(ANDROID_APP_DISMISS_KEY) === "1",
  }: { standalone?: boolean; dismissed?: boolean } = {},
): boolean {
  if (dismissed || standalone) return false;
  if (!/Android/i.test(ua)) return false;
  // Expo / Capacitor / in-app browsers already have the app.
  if (/Expo|okhttp|FancyCash|cash\.fancy\.app/i.test(ua)) return false;
  return true;
}

export function dismissAndroidAppBanner() {
  try { localStorage.setItem(ANDROID_APP_DISMISS_KEY, "1"); } catch { /* private mode */ }
}
