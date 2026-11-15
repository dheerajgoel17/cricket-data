import { useState } from "react";
import { DevicePhoneMobileIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { androidAppBannerEligible, androidAppUrl, dismissAndroidAppBanner } from "@/lib/android-app";
import { track } from "@/lib/analytics";
import { isDesignHost } from "@/lib/design-host";
import { cn } from "@/lib/utils";

/** Compact, dismissible install strip above the header — Android mobile web only (`lg` and up hide it). */
export function AndroidAppBanner({ force }: { force?: boolean } = {}) {
  const [open, setOpen] = useState(() => force || (!isDesignHost() && androidAppBannerEligible()));
  if (!open) return null;

  const href = androidAppUrl();
  const dismiss = () => {
    dismissAndroidAppBanner();
    setOpen(false);
    track("android_app_banner", { action: "dismiss" });
  };

  return (
    <div
      role="region"
      aria-label="Download the Android app"
      className={cn(
        "flex items-center gap-snug border-b border-hairline bg-card px-gutter py-tight text-foreground",
        !force && "lg:hidden",
      )}
    >
      <DevicePhoneMobileIcon className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-callout leading-snug">
        <span className="font-label">Fancy.cash for Android</span>
        <span className="text-muted-foreground"> — free app, same props and fancy.</span>
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-primary px-inset py-hair text-footnote font-label text-primary-foreground transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
        onClick={() => track("android_app_banner", { action: "open" })}
      >
        Download
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted hover:text-foreground active:scale-[0.97]"
      >
        <XMarkIcon className="size-4" />
      </button>
    </div>
  );
}
