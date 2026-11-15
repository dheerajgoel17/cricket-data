import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANDROID_APP_DISMISS_KEY,
  ANDROID_APP_PACKAGE,
  androidAppBannerEligible,
  dismissAndroidAppBanner,
  isAndroidAppInstalled,
  isDirectOrStoreUrl,
  resolveAndroidDownloadUrl,
} from "./android-app";

describe("androidAppBannerEligible", () => {
  afterEach(() => {
    sessionStorage.removeItem(ANDROID_APP_DISMISS_KEY);
    localStorage.removeItem(ANDROID_APP_DISMISS_KEY);
  });

  it("shows on Android Chrome, not on iPhone or desktop", () => {
    expect(androidAppBannerEligible("Mozilla/5.0 (Linux; Android 14) Chrome/120", { dismissed: false, standalone: false })).toBe(true);
    expect(androidAppBannerEligible("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", { dismissed: false, standalone: false })).toBe(false);
    expect(androidAppBannerEligible("Mozilla/5.0 (Macintosh; Intel Mac OS X)", { dismissed: false, standalone: false })).toBe(false);
  });

  it("hides when dismissed, standalone, or already in the app", () => {
    expect(androidAppBannerEligible("Android", { dismissed: true, standalone: false })).toBe(false);
    expect(androidAppBannerEligible("Android", { dismissed: false, standalone: true })).toBe(false);
    expect(androidAppBannerEligible("Android Expo/1.0", { dismissed: false, standalone: false })).toBe(false);
  });

  it("collapses for this visit only (sessionStorage)", () => {
    dismissAndroidAppBanner();
    expect(sessionStorage.getItem(ANDROID_APP_DISMISS_KEY)).toBe("1");
    expect(localStorage.getItem(ANDROID_APP_DISMISS_KEY)).toBeNull();
    expect(androidAppBannerEligible("Android")).toBe(false);
  });
});

describe("isAndroidAppInstalled", () => {
  it("is true when getInstalledRelatedApps lists the package", async () => {
    await expect(isAndroidAppInstalled(async () => [{ id: ANDROID_APP_PACKAGE, platform: "play" }])).resolves.toBe(true);
    await expect(isAndroidAppInstalled(async () => [{ id: "other.app" }])).resolves.toBe(false);
    await expect(isAndroidAppInstalled(async () => [])).resolves.toBe(false);
  });
});

describe("resolveAndroidDownloadUrl", () => {
  it("treats Play Store and .apk URLs as direct", () => {
    expect(isDirectOrStoreUrl("https://play.google.com/store/apps/details?id=cash.fancy.app")).toBe(true);
    expect(isDirectOrStoreUrl("https://example.com/Fancy.cash.apk")).toBe(true);
    expect(isDirectOrStoreUrl("https://github.com/dheerajgoel17/cricket-data/releases/latest")).toBe(false);
  });

  it("picks the .apk asset from the latest GitHub release", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        assets: [
          { name: "notes.txt", browser_download_url: "https://example.com/notes.txt" },
          { name: "Fancy.cash-0.1.0-arm64.apk", browser_download_url: "https://example.com/Fancy.cash.apk" },
        ],
      }),
    })) as unknown as typeof fetch;
    await expect(resolveAndroidDownloadUrl(fetchImpl)).resolves.toBe("https://example.com/Fancy.cash.apk");
    expect(fetchImpl).toHaveBeenCalled();
  });
});
