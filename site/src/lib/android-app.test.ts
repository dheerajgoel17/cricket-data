import { afterEach, describe, expect, it } from "vitest";
import { ANDROID_APP_DISMISS_KEY, androidAppBannerEligible, dismissAndroidAppBanner } from "./android-app";

describe("androidAppBannerEligible", () => {
  afterEach(() => localStorage.removeItem(ANDROID_APP_DISMISS_KEY));

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

  it("persists dismiss in localStorage", () => {
    dismissAndroidAppBanner();
    expect(localStorage.getItem(ANDROID_APP_DISMISS_KEY)).toBe("1");
    expect(androidAppBannerEligible("Android")).toBe(false);
  });
});
