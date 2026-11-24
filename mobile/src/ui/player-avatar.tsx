import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { faceUrls, shirtUrls } from "@/lib/photo-urls";
import { photosQuery } from "@/lib/queries";
import { initials } from "@/lib/format";
import { Text } from "@/ui/text";
import { color, duration, w } from "@/ui/tokens";

/** A picture that arrives after its circle fades in instead of popping (the circle is already there, so nothing shifts). */
const AVATAR_FADE = { duration: duration.fast, effect: "cross-dissolve" as const };

/** Face pictures are head and shoulders, nearly square (310 x 300); the shirt is the same width and rides up over the bottom third of the face (the site's `PlayerPortrait`). */
const FACE = 300 / 310, SHIRT_TOP = 0.627, WITH_SHIRT = 1.03;

function useUrls(pid: string, team?: string, test?: boolean) {
  const { data: photos } = useQuery(photosQuery);
  return { faces: faceUrls(photos, pid), shirts: shirtUrls(photos, team || "", !!test) };
}

/**
 * Round row avatar: face + kit fill the circle as one image (no nested flag/crest).
 * Matches the site's `PlayerAvatar` fill.
 */
export function PlayerAvatar({ pid, team, test, size = 36, name }: { pid: string; team?: string; test?: boolean; size?: number; /** Shown as initials when there is no picture at all, so an empty circle never reads as broken. */ name?: string }) {
  const { faces, shirts } = useUrls(pid, team, test);
  const [face, setFace] = useState(0), [shirt, setShirt] = useState(0);
  const h = size * WITH_SHIRT;
  const bare = !faces[face] && !shirts[shirt];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {bare && name ? <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials(name)}</Text> : null}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: size, height: h }}>
        {faces[face] ? (
          <Image
            source={{ uri: faces[face] }}
            style={{ position: "absolute", left: 0, top: 0, width: size, height: size * FACE }}
            contentFit="contain"
            contentPosition="bottom"
            recyclingKey={faces[face]}
            cachePolicy="memory-disk"
            transition={AVATAR_FADE}
            onError={() => setFace((n) => n + 1)}
          />
        ) : null}
        {shirts[shirt] ? (
          <Image
            source={{ uri: shirts[shirt] }}
            style={{ position: "absolute", left: 0, top: h * SHIRT_TOP, width: size, height: h * (1 - SHIRT_TOP) }}
            contentFit="cover"
            contentPosition="top"
            recyclingKey={shirts[shirt]}
            cachePolicy="memory-disk"
            transition={AVATAR_FADE}
            onError={() => setShirt((n) => n + 1)}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Just the face, as on the market tape. */
export function PlayerFace({ pid, size = 36 }: { pid: string; size?: number }) {
  const { faces } = useUrls(pid);
  const [face, setFace] = useState(0);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {faces[face] ? (
        <Image
          source={{ uri: faces[face] }}
          style={{ width: size, height: size }}
          contentFit="cover"
          contentPosition="top"
          recyclingKey={faces[face]}
          cachePolicy="memory-disk"
            transition={AVATAR_FADE}
          onError={() => setFace((n) => n + 1)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { ...w.strong, color: color["muted-foreground"], textAlign: "center" },
  circle: { overflow: "hidden", backgroundColor: color.secondary },
});

/** The player standing in his team's shirt, laid out as the source lays out its own pictures (the site's `PlayerPortrait`): not cropped to a circle; the height follows the width. */
export function PlayerPortrait({ pid, team, test, width = 144 }: { pid: string; team?: string; test?: boolean; width?: number }) {
  const { faces, shirts } = useUrls(pid, team, test);
  const [face, setFace] = useState(0), [shirt, setShirt] = useState(0);
  const h = width * (shirts[shirt] ? WITH_SHIRT : FACE);
  return (
    <View style={{ width, height: h }}>
      {faces[face] ? (
        <Image
          source={{ uri: faces[face] }}
          style={{ position: "absolute", left: 0, top: 0, width, height: width * FACE }}
          contentFit="contain"
          contentPosition="bottom"
          recyclingKey={faces[face]}
          cachePolicy="memory-disk"
            transition={AVATAR_FADE}
          onError={() => setFace((n) => n + 1)}
        />
      ) : null}
      {shirts[shirt] ? (
        <Image
          source={{ uri: shirts[shirt] }}
          style={{ position: "absolute", left: 0, top: h * SHIRT_TOP, width, height: h * (1 - SHIRT_TOP) }}
          contentFit="cover"
          contentPosition="top"
          recyclingKey={shirts[shirt]}
          cachePolicy="memory-disk"
            transition={AVATAR_FADE}
          onError={() => setShirt((n) => n + 1)}
        />
      ) : null}
    </View>
  );
}
