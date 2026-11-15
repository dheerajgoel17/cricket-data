import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { BrandMark } from "@/components/layout/Header";
import {
  androidAppBannerEligible,
  dismissAndroidAppBanner,
  isAndroidAppInstalled,
  resolveAndroidDownloadUrl,
} from "@/lib/android-app";
import { track } from "@/lib/analytics";
import { isDesignHost } from "@/lib/design-host";
import { cn } from "@/lib/utils";

/**
 * Smart-app-banner style install strip (icon · title · blurb · Download · dismiss).
 * Android mobile web only (`lg` and up hide it). Hidden when the native app is already
 * installed. × collapses for this visit only; next visit promotes again. Download pulls
 * the latest release APK (not the GitHub page).
 */
export function AndroidAppBanner({ force }: { force?: boolean } = {}) {
  const [open, setOpen] = useState(() => !!force);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (force) {
      setOpen(true);
      return;
    }
    if (isDesignHost()) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!androidAppBannerEligible()) {
        if (!cancelled) setOpen(false);
        return;
      }
      if (await isAndroidAppInstalled()) {
        if (!cancelled) setOpen(false);
        return;
      }
      if (!cancelled) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [force]);

  if (!open) return null;

  const dismiss = () => {
    dismissAndroidAppBanner();
    setOpen(false);
    track("android_app_banner", { action: "dismiss" });
  };

  const download = async () => {
    if (busy) return;
    setBusy(true);
    track("android_app_banner", { action: "open" });
    try {
      const url = await resolveAndroidDownloadUrl();
      // Same-tab navigation: Android Chrome starts the APK download from the asset URL.
      window.location.assign(url);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Download the Android app"
      className={cn(
        "flex items-center gap-snug bg-primary px-gutter py-snug text-primary-foreground",
        !force && "lg:hidden",
      )}
    >
      <BrandMark className="size-10 shrink-0 rounded-[22%] shadow-sm ring-1 ring-primary-foreground/20" />

      <div className="min-w-0 flex-1 leading-snug">
        <p className="truncate text-callout font-emphasis tracking-tight">Fancy.cash</p>
        <p className="truncate text-footnote text-primary-foreground/80">Free Android app · props &amp; fancy</p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => { void download(); }}
        className="shrink-0 rounded-full bg-primary-foreground px-inset py-tight text-footnote font-label uppercase tracking-wide text-primary transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:opacity-70"
      >
        {busy ? "…" : "Download"}
      </button>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="grid size-8 shrink-0 place-items-center rounded-full text-primary-foreground/80 transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-primary-foreground/15 hover:text-primary-foreground active:scale-[0.97]"
      >
        <XMarkIcon className="size-4" />
      </button>
    </div>
  );
}
