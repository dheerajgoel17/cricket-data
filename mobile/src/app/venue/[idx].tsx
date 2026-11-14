import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { storeQuery } from "@/lib/data";
import { useScreenInsets } from "@/ui/insets";
import { GroundPage } from "@/ui/ground-page";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { color } from "@/ui/tokens";

/** A ground by its index in the stats (the site's `/venue/:id`): the same page without the series row. */
export default function VenuePage() {
  const { idx } = useLocalSearchParams<{ idx: string }>();
  const inset = useScreenInsets(false);
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  if (!store) return <View style={{ flex: 1, backgroundColor: color.background, paddingTop: inset.top }}><PageHeader title="Ground" /><Working label="Loading…" shape="ground" /></View>;
  const i = Number(Array.isArray(idx) ? idx[0] : idx);
  return <GroundPage venue={i >= 0 && i < store.venues.length ? store.venues[i] : undefined} />;
}
