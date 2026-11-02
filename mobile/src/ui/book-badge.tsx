import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { Image } from "expo-image";
import { bookName } from "@cricket/engine/lines.js";
import { bookLogo, bookVariant } from "@site/lib/books";
import { abs } from "@/lib/config";
import { color, space, type } from "@/ui/tokens";

const broken = new Set<string>(); // logo files that failed to load: every other badge for that book goes straight to the name

/** Where a price comes from: the book's own logo when we hold one, else a neutral chip with its name (the site's `BookBadge`). */
export function BookBadge({ source }: { source: string }) {
  const name = bookName(source), src = bookLogo(source);
  const [failed, setFailed] = useState(() => !!src && broken.has(src));
  if (!src || failed) return <View style={styles.chip}><Text style={styles.chipText}>{name}</Text></View>;
  const variant = bookVariant(source);
  return (
    <View style={styles.row}>
      <Image source={{ uri: abs(src) }} style={styles.logo} contentFit="contain" contentPosition="left" accessibilityLabel={name} onError={() => { broken.add(src); setFailed(true); }} />
      {variant ? <Text style={styles.variant}>{variant}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: color.hairline, borderRadius: 999, paddingHorizontal: space.tight, paddingVertical: 1 },
  chipText: { ...type.footnote, color: color.foreground },
  row: { flexDirection: "row", alignItems: "center", gap: space.hair },
  logo: { width: 52, height: 12 },
  variant: { ...type.caption, color: color["muted-foreground"] },
});
