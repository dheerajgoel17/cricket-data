import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { initials } from "@/lib/format";
import { leagueUrls, teamUrls } from "@/lib/photo-urls";
import { photosQuery } from "@/lib/queries";
import { color, duration, w } from "@/ui/tokens";

/** A crest that arrives after its box fades in instead of popping (the box is already there, so nothing shifts). */
const CREST_FADE = { duration: duration.fast, effect: "cross-dissolve" as const };

/** Team crest, the logo alone with no circle or padding (the site's `TeamBadge`): the source's logo when we know the team, else the national flag, else initials. */
export function TeamBadge({ name, size = 40, letters = 2 }: { name: string; size?: number; /** Letters shown when there is no logo or flag (an overlapped pair of crests shows one, so neither hides the other's). */ letters?: number }) {
  const { data: photos } = useQuery(photosQuery);
  const urls = teamUrls(photos, name, size);
  const [failed, setFailed] = useState(0);
  const uri = urls[failed];
  if (!uri) return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>{photos === undefined ? null : <Text style={[styles.initials, { fontSize: size * 0.5 }]}>{initials(name).slice(0, letters)}</Text>}</View>;
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      contentFit="contain"
      recyclingKey={uri}
      cachePolicy="memory-disk"
      transition={CREST_FADE}
      onError={() => setFailed((n) => n + 1)}
      accessibilityLabel={name}
    />
  );
}

const styles = StyleSheet.create({
  circle: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: color.pill },
  initials: { ...w.strong, color: color["muted-foreground"] },
});

/** Round league badge: the source's logo for the league's newest season, else the league's initials ("IPL"). */
export function LeagueBadge({ name, size = 40 }: { name: string; size?: number }) {
  const { data: photos } = useQuery(photosQuery);
  const urls = leagueUrls(photos, name);
  const [failed, setFailed] = useState(0);
  const uri = urls[failed];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? <Image source={{ uri }} style={{ width: size - 4, height: size - 4 }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setFailed((n) => n + 1)} accessibilityLabel={name} />
        : photos === undefined ? null : <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials(name)}</Text>}
    </View>
  );
}
