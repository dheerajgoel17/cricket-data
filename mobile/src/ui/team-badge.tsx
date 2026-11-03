import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { leagueLogos, teamLogos } from "@cricket/engine/photos.js";
import { flagUrl } from "@site/lib/assets";
import { abs } from "@/lib/config";
import { initials } from "@/lib/format";
import { photosQuery } from "@/lib/queries";
import { color, font } from "@/ui/tokens";

/** Round team badge (or, with `bare`, the logo alone with no circle): the source's logo when we know the team, else the national flag, else initials (the site's `TeamBadge`). */
export function TeamBadge({ name, size = 40, bare }: { name: string; size?: number; bare?: boolean }) {
  const { data: photos } = useQuery(photosQuery);
  const urls = useMemo(
    () => ([...teamLogos(photos, name), flagUrl(name, size > 40 ? 160 : 80)].filter(Boolean) as string[]).map(abs),
    [photos, name, size],
  );
  const [failed, setFailed] = useState(0);
  const uri = urls[failed];
  const img = (w: number) => uri ? (
    <Image
      source={{ uri }}
      style={{ width: w, height: w }}
      contentFit="contain"
      recyclingKey={uri}
      cachePolicy="memory-disk"
      onError={() => setFailed((n) => n + 1)}
      accessibilityLabel={name}
    />
  ) : null;
  if (bare && uri) return img(size);
  if (bare) return <Text style={[styles.initials, { fontSize: size * 0.5 }]}>{initials(name)}</Text>;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? img(size - 4) : <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials(name)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: color.pill },
  initials: { fontFamily: font.bold, color: color["muted-foreground"] },
});

/** Round league badge: the source's logo for the league's newest season, else the league's initials ("IPL"). */
export function LeagueBadge({ name, size = 40 }: { name: string; size?: number }) {
  const { data: photos } = useQuery(photosQuery);
  const urls = useMemo(() => (leagueLogos(photos, name) as string[]).map(abs), [photos, name]);
  const [failed, setFailed] = useState(0);
  const uri = urls[failed];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? <Image source={{ uri }} style={{ width: size - 4, height: size - 4 }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setFailed((n) => n + 1)} accessibilityLabel={name} />
        : <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials(name)}</Text>}
    </View>
  );
}
