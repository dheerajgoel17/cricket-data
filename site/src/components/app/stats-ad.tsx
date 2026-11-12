import { AdSlot } from "./ad-slot";

/** Top strip on stats pages (manual creative or AdSense; hidden when empty). */
export function StatsAd() {
  return <AdSlot slotId="stats_top" />;
}
