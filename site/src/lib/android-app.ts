/** Android app install for the mobile-web promo banner. */

/** Session-only dismiss: collapse for this tab, show again on the next visit. */
export const ANDROID_APP_DISMISS_KEY = "cph-android-app-banner";

/** Native package id (Expo `android.package` / Play applicationId). */
export const ANDROID_APP_PACKAGE = "cash.fancy.app";

const LATEST_RELEASE_API = "https://api.github.com/repos/dheerajgoel17/cricket-data/releases/latest";

/** Env override: Play Store listing or a direct `.apk` URL. GitHub release *pages* are ignored — we always resolve the latest APK. */
export function androidAppUrlConfigured(): string {
  return String(import.meta.env.VITE_ANDROID_APP_URL || "").trim();
}

/** True when the configured URL should be used as-is (store or direct APK), not resolved via the releases API. */
export function isDirectOrStoreUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (/\.apk(\?|#|$)/i.test(url)) return true;
  if (/play\.google\.com\//i.test(url)) return true;
  return false;
}

/**
 * URL that starts an install: Play Store / direct APK from env when set that way,
 * otherwise the `.apk` asset on the latest GitHub release (always newest build).
 */
export async function resolveAndroidDownloadUrl(fetchImpl: typeof fetch = fetch): Promise<string> {
  const configured = androidAppUrlConfigured();
  if (isDirectOrStoreUrl(configured)) return configured;

  const r = await fetchImpl(LATEST_RELEASE_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`latest release HTTP ${r.status}`);
  const body = await r.json() as { assets?: { name?: string; browser_download_url?: string }[] };
  const apk = (body.assets || []).find((a) => /\.apk$/i.test(String(a.name || "")));
  const url = apk?.browser_download_url?.trim();
  if (!url) throw new Error("No APK asset on the latest release");
  return url;
}

function sessionDismissed(): boolean {
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(ANDROID_APP_DISMISS_KEY) === "1") return true;
  } catch { /* private mode */ }
  return false;
}

/** True on Android browser webviews that are not an installed PWA / home-screen app. */
export function androidAppBannerEligible(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
  {
    standalone = typeof window !== "undefined"
      && (window.matchMedia("(display-mode: standalone)").matches
        || ("standalone" in navigator && !!(navigator as Navigator & { standalone?: boolean }).standalone)),
    dismissed = sessionDismissed(),
  }: { standalone?: boolean; dismissed?: boolean } = {},
): boolean {
  if (dismissed || standalone) return false;
  if (!/Android/i.test(ua)) return false;
  // Expo / Capacitor / in-app browsers already have the app.
  if (/Expo|okhttp|FancyCash|cash\.fancy\.app/i.test(ua)) return false;
  return true;
}

/** Collapse for this visit only (sessionStorage); next visit promotes again. */
export function dismissAndroidAppBanner() {
  try { sessionStorage.setItem(ANDROID_APP_DISMISS_KEY, "1"); } catch { /* private mode */ }
  try { localStorage.removeItem(ANDROID_APP_DISMISS_KEY); } catch { /* migrate off permanent dismiss */ }
}

type RelatedApp = { id?: string; platform?: string };

/**
 * True when Chrome reports the native package already installed
 * (`navigator.getInstalledRelatedApps` + `related_applications` in the web manifest
 * + `/.well-known/assetlinks.json`). Missing API → treat as not installed (show promo).
 */
export async function isAndroidAppInstalled(
  getRelated: () => Promise<RelatedApp[]> = () => {
    const nav = typeof navigator !== "undefined"
      ? (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> })
      : null;
    if (!nav?.getInstalledRelatedApps) return Promise.resolve([]);
    return nav.getInstalledRelatedApps().catch(() => []);
  },
): Promise<boolean> {
  const apps = await getRelated();
  return apps.some((a) => String(a.id || "").toLowerCase() === ANDROID_APP_PACKAGE);
}
