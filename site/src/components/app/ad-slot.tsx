import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { type AdSlotId } from "@/lib/ad-slots";
import { clearAdEmpty, isAdEmptyCached, markAdEmpty } from "@/lib/ad-fill";
import { AD_SLOT, CLIENT, adsAllowed } from "@/lib/ads";
import { creativePublicUrl, fetchManualPlacement } from "@/lib/manual-ads";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Fill = "pending" | "filled" | "empty";

/**
 * Banner slot: manual creative (dashboard) overrides AdSense; if neither fills, render nothing
 * (no reserved hole). AdSense stays in the DOM while pending but takes no layout / no chrome until
 * `data-ad-status="filled"`, so an unfilled auction cannot flash a white strip.
 */
export function AdSlot({ slotId, slot = AD_SLOT, className }: { slotId: AdSlotId; slot?: string; className?: string }) {
  const { pathname } = useLocation();
  const manualQ = useQuery({
    queryKey: ["ad-placement", slotId],
    queryFn: () => fetchManualPlacement(slotId),
    staleTime: 60_000,
    retry: 1,
  });
  const manual = manualQ.data;
  const manualUrl = manual ? creativePublicUrl(manual.image_path) : "";
  const skipAdsense = !!slot && isAdEmptyCached(slotId, slot);
  const wantAdsense = !manualQ.isLoading && !manual && !!slot && adsAllowed(pathname) && !skipAdsense;
  const [fill, setFill] = useState<Fill>(() => (skipAdsense ? "empty" : "pending"));
  const insRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (!wantAdsense) {
      if (skipAdsense) setFill("empty");
      else setFill("pending");
      return;
    }
    setFill("pending");
    try { ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({}); } catch {
      setFill("empty");
      markAdEmpty(slotId, slot);
    }
  }, [wantAdsense, pathname, slotId, slot, skipAdsense]);

  useEffect(() => {
    if (!wantAdsense) return;
    const el = insRef.current;
    if (!el) return;
    const read = () => {
      const st = el.getAttribute("data-ad-status");
      if (st === "filled") {
        clearAdEmpty(slotId, slot);
        setFill("filled");
      } else if (st === "unfilled") {
        markAdEmpty(slotId, slot);
        setFill("empty");
      }
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    const t = window.setTimeout(() => {
      if (el.getAttribute("data-ad-status") !== "filled") {
        setFill((f) => {
          if (f === "filled") return f;
          markAdEmpty(slotId, slot);
          return "empty";
        });
      }
    }, 4000);
    return () => { mo.disconnect(); window.clearTimeout(t); };
  }, [wantAdsense, pathname, slotId, slot]);

  if (manualQ.isLoading) return null;

  if (manual && manualUrl) {
    return (
      <aside aria-label="Advertisement" className={cn("-mx-gutter border-b border-hairline", className)}>
        <a
          href={manual.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => track("ad_click", { slot: slotId, source: "manual" })}
        >
          <img src={manualUrl} alt={manual.alt || manual.name} className="mx-auto max-h-[calc(var(--row-min)*2.5)] w-full object-contain" />
        </a>
      </aside>
    );
  }

  if (!wantAdsense || fill === "empty") return null;

  const shown = fill === "filled";

  return (
    <aside
      aria-label="Advertisement"
      aria-hidden={!shown}
      data-ad-fill={fill}
      className={cn(
        shown
          ? cn("-mx-gutter border-b border-hairline", className)
          : "pointer-events-none absolute h-0 w-full overflow-hidden border-0 opacity-0",
      )}
    >
      <span className="sr-only">Advertisement</span>
      <ins
        key={`${pathname}-${slotId}`}
        ref={insRef}
        className={cn("adsbygoogle block w-full", shown ? "min-h-[calc(var(--row-min)*1.75)]" : "h-0 min-h-0 max-h-0 overflow-hidden")}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
