import { useEffect } from "react";
import { Platform } from "react-native";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { BarlowSemiCondensed_500Medium } from "@expo-google-fonts/barlow-semi-condensed";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { watchAppState } from "@/lib/queries";
import { color, font } from "@/ui/tokens";

void SplashScreen.preventAutoHideAsync();

const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

// Dark only, in the site's colours. Setting the theme here also avoids a white flash behind the iOS 26 tab bar.
const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.background, card: color.card, border: color.border, primary: color.primary, text: color.foreground },
};

export default function RootLayout() {
  const [fonts, fontError] = useFonts({
    [font.regular]: Inter_400Regular, [font.medium]: Inter_500Medium, [font.semibold]: Inter_600SemiBold, [font.bold]: Inter_700Bold, [font.cond]: BarlowSemiCondensed_500Medium,
  });
  useEffect(watchAppState, []);
  useEffect(() => { if (fonts || fontError) void SplashScreen.hideAsync(); }, [fonts, fontError]); // a failed font load shows the system font rather than a blank screen
  if (!fonts && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.background }}>
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background }, animation: Platform.OS === "android" ? "ios_from_right" : "default" }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="fixture/[id]" />
            <Stack.Screen name="player/[idx]" />
            <Stack.Screen name="search" options={{ animation: "fade" }} />
            <Stack.Screen name="team/[idx]" />
            <Stack.Screen name="competitions" />
            <Stack.Screen name="league/[id]" />
            <Stack.Screen name="info/[topic]" options={{ presentation: "formSheet", sheetAllowedDetents: [0.5, 0.85], sheetInitialDetentIndex: 0, sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
