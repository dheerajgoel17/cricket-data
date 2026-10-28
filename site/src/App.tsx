import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { AppSkeleton } from "@/components/app/skeletons";
import { HomePage } from "@/pages/Home";

const Player = lazy(() => import("@/pages/Player").then((m) => ({ default: m.PlayerPage })));

const page = <T extends Record<string, unknown>>(mod: () => Promise<T>, name: keyof T) => lazy(() => mod().then((m) => ({ default: m[name] as React.ComponentType })));
const FixturePage = page(() => import("@/pages/Fixtures"), "FixturePage"), TrendsPage = page(() => import("@/pages/Fixtures"), "TrendsPage");
const CompetitionsPage = page(() => import("@/pages/Markets"), "CompetitionsPage"), LeaguePage = page(() => import("@/pages/Markets"), "LeaguePage");
const PairPage = page(() => import("@/pages/Tools"), "PairPage");
const ToolsPage = page(() => import("@/pages/Simple"), "ToolsPage"), OddsPage = page(() => import("@/pages/Simple"), "OddsPage"), GlossaryPage = page(() => import("@/pages/Simple"), "GlossaryPage");
const AboutPage = page(() => import("@/pages/Simple"), "AboutPage"), SavedPage = page(() => import("@/pages/Simple"), "SavedPage"), PlayersPage = page(() => import("@/pages/Simple"), "PlayersPage"), TeamsPage = page(() => import("@/pages/Simple"), "TeamsPage");
const TeamPage = lazy(() => import("@/pages/Markets").then((m) => ({ default: () => <m.MarketPage kind="team" /> })));
const VenuePage = lazy(() => import("@/pages/Markets").then((m) => ({ default: () => <m.MarketPage kind="venue" /> })));

/** Old links used hash routes (#/player/12?stat=runs): send them to the same path. */
function LegacyHash() {
  const nav = useNavigate();
  const { hash } = useLocation();
  useEffect(() => { if (hash.startsWith("#/")) nav(hash.slice(1), { replace: true }); }, [hash, nav]);
  return null;
}

export function App() {
  return (
    <>
      <LegacyHash />
      <Suspense fallback={<AppSkeleton />}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="fixtures" element={<Navigate to="/" replace />} />
            <Route path="fixture/*" element={<FixturePage />} />
            <Route path="trends" element={<TrendsPage />} />
            <Route path="competitions" element={<CompetitionsPage />} />
            <Route path="league/:id" element={<LeaguePage />} />
            <Route path="tools" element={<ToolsPage />} /><Route path="features" element={<Navigate to="/tools" replace />} />
            <Route path="odds" element={<OddsPage />} />
            <Route path="glossary" element={<GlossaryPage />} />
            <Route path="saved" element={<SavedPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="player/:id" element={<Player />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="team/:id" element={<TeamPage />} />
            <Route path="venue/:id" element={<VenuePage />} />
            <Route path="pair" element={<PairPage />} />
            <Route path="props" element={<Navigate to="/" replace />} />
            <Route path="ask" element={<Navigate to="/" replace />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
