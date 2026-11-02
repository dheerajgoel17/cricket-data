import type { ComponentRef, ReactNode, RefObject } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useAnimatedScrollHandler, useSharedValue, withTiming } from "react-native-reanimated";

/** Kept so the screens that wrap their scrolling content in it need no change: a plain view. A live blur of scrolling content costs the GPU a full extra pass every frame on Android, which is what made it stutter. */
export const BlurTargetView = View;
export type BlurTarget = RefObject<ComponentRef<typeof View> | null>;

/**
 * A translucent bar the content scrolls under (the site's `bg-background/80 backdrop-blur-xl` bars). iOS: the system blur. Android (and the browser preview): the same dark tint, nearly
 * opaque and with no blur, since blurring the scrolling content behind it every frame is too heavy there.
 */
export function BlurBar({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle>; blurTarget?: BlurTarget | null }) {
  if (Platform.OS === "ios") return <BlurView tint="systemChromeMaterialDark" intensity={80} style={style}>{children}</BlurView>;
  return <View style={[style, { backgroundColor: "rgba(8,8,10,0.97)" }]}>{children}</View>;
}

/**
 * Scroll-driven collapse for a bar's lower rows: `collapsed` goes to 1 when the list is scrolled down past `after` points and back to 0 on any scroll up or near the top, so
 * the filters tuck away while reading and come straight back when you pull toward them. Runs on the UI thread (worklets), so it stays smooth while JavaScript is busy.
 */
export function useCollapseOnScroll(after = 80) {
  const collapsed = useSharedValue(0);
  const last = useSharedValue(0);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const offset = e.contentOffset.y, dy = offset - last.value;
    last.value = offset;
    y.value = offset;
    if (offset < 24 || dy < -4) collapsed.value = withTiming(0, { duration: 220 });
    else if (dy > 4 && offset > after) collapsed.value = withTiming(1, { duration: 220 });
  });
  return { collapsed, onScroll, y };
}
