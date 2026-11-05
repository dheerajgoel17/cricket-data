import { Profiler, useEffect, useState } from "react";
import { Platform } from "react-native";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { BarlowCondensed_500Medium, BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { mark, onRender, PROFILE } from "@/lib/perf";
import { storeQuery } from "@/lib/data";
import { hasKept } from "@/lib/net";
import { KEPT_MS, watchAppState } from "@/lib/queries";
import { AnimatedSplash } from "@/ui/animated-splash";
import { SignInSheet } from "@/ui/sign-in-sheet";
import { WebFrame } from "@/ui/web-frame";
import { color, font } from "@/ui/tokens";

void SplashScreen.preventAutoHideAsync();

const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
// A first launch has nothing kept to paint from, so the stats data (the longest wait) starts loading now, beside the schedule and the lines, not after they are in. When the last launch left
// them on the device Home paints from those and the stats data loads after the first screen.
if (!hasKept("/data/fixtures.json", KEPT_MS)) void client.prefetchQuery(storeQuery);

// Dark only, in the site's colours. Setting the theme here also avoids a white flash behind the iOS 26 tab bar.
const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.background, card: color.card, border: color.border, primary: color.primary, text: color.foreground },
};

export default function RootLayout() {
  // Satoshi for UI; Barlow Condensed for scoreboard figures / caps labels.
  const [fonts, fontError] = useFonts({
    [font.regular]: require("../../assets/fonts/Satoshi-Regular.ttf"),
    [font.medium]: require("../../assets/fonts/Satoshi-Medium.ttf"),
    [font.bold]: require("../../assets/fonts/Satoshi-Bold.ttf"),
    [font.data]: BarlowCondensed_700Bold,
    [font.dataLight]: BarlowCondensed_500Medium,
  });
  useEffect(watchAppState, []);
  const [splashDone, setSplashDone] = useState(false);
  const ready = !!(fonts || fontError);
  if (ready) mark("fonts-ready"); // a failed font load shows the system font rather than a blank screen
  // the system splash is plain black and is taken down by `AnimatedSplash` as it draws; the app is mounted behind it as soon as its fonts are in, so its data loads while the mark is on screen
  // (one parent for both, so the splash is never remounted, which would restart its drawing)
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: ready ? color.background : "#000000" }}>
    {ready ? (<WebFrame>
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ThemeProvider value={theme}>
            <StatusBar style="light" />
            <Profiler id="stack" onRender={onRender}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background }, animation: Platform.OS === "android" ? "ios_from_right" : "default" }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="fixture/[id]" />
              <Stack.Screen name="player/[idx]" />
              <Stack.Screen name="search" options={{ animation: "fade" }} />
              <Stack.Screen name="team/[idx]" />
              <Stack.Screen name="competitions" />
              <Stack.Screen name="league/[id]" />
              <Stack.Screen name="venue/[idx]" />
              <Stack.Screen name="info/[topic]" options={{ presentation: "formSheet", sheetAllowedDetents: [0.5, 0.85], sheetInitialDetentIndex: 0, sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
            </Stack>
            </Profiler>
            <SignInSheet />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
    </WebFrame>) : null}
    {splashDone ? null : <AnimatedSplash ready={ready} onDone={() => { mark("splash-done"); setSplashDone(true); }} />}
    </GestureHandlerRootView>
  );
}
