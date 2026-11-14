import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import "./index.css";
import { App } from "./App";
import { DataProvider } from "@/lib/data";
import { AuthProvider } from "@/lib/auth";
import { prefetchFeeds } from "@/lib/queries";
import { DESIGN_SYSTEM_HOST } from "@/lib/design-host";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SignInSheet } from "@/components/app/sign-in-sheet";
import { reloadOnce } from "@/components/app/error-boundary";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { reportError } from "@/lib/analytics";

const DesignSystem = lazy(() => import("@/pages/DesignSystem").then(({ DesignSystemPage }) => ({ default: DesignSystemPage })));
const designHost = DESIGN_SYSTEM_HOST;
const isDesignPage = location.hostname === designHost;
if (isDesignPage) {
  document.documentElement.classList.replace("dark", "design-light");
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff");
} else if (/^\/design-system\/?$/.test(location.pathname)) {
  location.replace(`https://${designHost}/${location.search}${location.hash}`);
}

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 } } });
// Design host needs feeds for GlobalSearch; product host prefetches by route as before.
if (isDesignPage || !/^\/design-system\/?$/.test(location.pathname)) prefetchFeeds(client, isDesignPage ? "/" : location.pathname);
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reportError("chunk"); reloadOnce(); });
window.addEventListener("error", (e) => reportError("script", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => reportError("promise", e.reason)); // a script of an older deploy is gone: the new deploy has the page, so reload once

const designFallback = (
  <div role="status" className="flex min-h-svh flex-col gap-stack p-gutter">
    <div className="h-header animate-pulse rounded-lg bg-muted" />
    <div className="h-40 animate-pulse rounded-2xl bg-muted" />
    <div className="h-24 animate-pulse rounded-xl bg-muted" />
    <span className="sr-only">Loading design system…</span>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isDesignPage ? (
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <BrowserRouter>
              <AuthProvider>
                <DataProvider>
                  <Suspense fallback={designFallback}>
                    <DesignSystem />
                  </Suspense>
                </DataProvider>
                <SignInSheet />
              </AuthProvider>
            </BrowserRouter>
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    ) : <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <DataProvider><App /></DataProvider>
              <SignInSheet />
            </AuthProvider>
          </BrowserRouter>
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>}
  </StrictMode>,
);
