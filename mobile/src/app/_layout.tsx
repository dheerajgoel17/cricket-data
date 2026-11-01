import { useEffect } from "react";
import { DarkTheme, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppTabs from "@/components/app-tabs";
import { watchAppState } from "@/lib/queries";
import { color } from "@/ui/tokens";

const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

// Dark only, in the site's colours. Setting the theme here also avoids a white flash behind the iOS 26 tab bar.
const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.background, card: color.card, border: color.border, primary: color.primary, text: color.foreground },
};

export default function RootLayout() {
  useEffect(watchAppState, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <AppTabs />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
