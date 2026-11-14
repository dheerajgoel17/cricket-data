import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useFixtureBooks } from "@/lib/archive";
import { useScreenInsets } from "@/ui/insets";
import { GroundPage } from "@/ui/ground-page";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { color } from "@/ui/tokens";

/** The ground of a fixture, with the series here as a row back to the match (the site's `/fixture/:id/ground`). */
export default function FixtureGroundPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inset = useScreenInsets(false);
  const { fx, isLoading } = useFixtureBooks(Array.isArray(id) ? id[0] : id || "");
  if (isLoading) return <View style={{ flex: 1, backgroundColor: color.background, paddingTop: inset.top }}><PageHeader title="Ground" /><Working label="Loading…" shape="ground" /></View>;
  return <GroundPage venue={fx?.venue} fixtureId={fx?.id} from={fx} />;
}
