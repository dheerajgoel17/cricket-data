import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/use-store";
import { useScreenInsets } from "@/ui/insets";
import { GroundPage } from "@/ui/ground-page";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { PageAtmosphere } from "@/ui/page-atmosphere";

/** A ground by its index in the stats (the site's `/venue/:id`): the same page without the series row. */
export default function VenuePage() {
  const { idx } = useLocalSearchParams<{ idx: string }>();
  const inset = useScreenInsets(false);
  const stats = useStore();
  const store: any = stats.data?.store;
  if (!store) return <PageAtmosphere style={{ paddingTop: inset.top }}><PageHeader title="Ground" /><Working label="Loading…" shape="ground" /></PageAtmosphere>;
  const i = Number(Array.isArray(idx) ? idx[0] : idx);
  return <GroundPage venue={i >= 0 && i < store.venues.length ? store.venues[i] : undefined} />;
}
