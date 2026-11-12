import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AD_SLOT, CLIENT, adsAllowed } from "@/lib/ads";

/** One responsive display ad at the foot of a stats page (`adsAllowed`: never where prices, props or fancy lines are). Draws nothing without a slot id, and never reserves room for an ad that has not filled. */
export function AdSlot({ slot = AD_SLOT }: { slot?: string }) {
  const { pathname } = useLocation();
  const on = !!slot && adsAllowed(pathname);
  useEffect(() => {
    if (!on) return;
    try { ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({}); } catch { /* the script is blocked or not yet in: the unit stays empty */ }
  }, [on, pathname]);
  if (!on) return null;
  return (
    <aside aria-label="Advertisement" className="mt-section flex flex-col gap-hair">
      <span className="label-cap text-caption text-muted-foreground">Advertisement</span>
      <ins key={pathname} className="adsbygoogle block min-h-0" data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
