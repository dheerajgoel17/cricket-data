import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import "./index.css";
import { App } from "./App";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { DataProvider } from "@/lib/data";
import { prefetchFeeds } from "@/lib/queries";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { reloadOnce } from "@/components/app/error-boundary";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { reportError } from "@/lib/analytics";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 } } });
prefetchFeeds(client, location.pathname);
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reportError("chunk"); reloadOnce(); });
window.addEventListener("error", (e) => reportError("script", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => reportError("promise", e.reason)); // a script of an older deploy is gone: the new deploy has the page, so reload once

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <ThemeProvider>
            <BrowserRouter>
              <DataProvider><App /></DataProvider>
            </BrowserRouter>
            <Toaster />
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
