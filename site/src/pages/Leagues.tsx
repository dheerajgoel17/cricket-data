import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, TrophyIcon } from "@heroicons/react/24/outline";
import { featuredEvents } from "@cricket/engine/tournament.js";
import { useData } from "@/lib/data";
import { useFixtures } from "@/hooks/useEngine";
import { useRail } from "@/hooks/useRail";
import { track } from "@/lib/analytics";
import { setTitle } from "@/lib/title";
import { cn } from "@/lib/utils";
import { LeagueBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { useQ } from "@/components/app/forms";
import { PillGroup } from "@/components/app/pill-group";
import { StatsAd } from "@/components/app/stats-ad";
import { TournamentStats } from "@/components/app/tournament-stats";

/** Leagues listed first, in this order, when they are live or due to start: Big Bash on top (the women's season live, the men's due). */
const PIN_FIRST = ["big bash"];

type Pick = { e: number; name: string; tag: "live" | "soon" | "" };

/** The status on a league chip: solid, so it reads on the filled (selected) and the plain chip alike. */
const Tag = ({ tag }: { tag: "live" | "soon" }) => <span className={cn("rounded-full px-1.5 text-caption font-bold uppercase leading-4", tag === "live" ? "bg-primary text-primary-foreground" : "bg-amber text-background")}>{tag === "live" ? "Live" : "Soon"}</span>;

const more = "inline-flex shrink-0 items-center gap-hair text-callout font-medium text-muted-foreground transition-colors hover:text-foreground";

/** Leagues: pick one (live ones and those about to start first, Big Bash on top), then its season's leaders, lists and trends. Any other league is on /competitions. */
export function LeaguesPage() {
  setTitle("Cricket leagues: stats, top run-scorers and wicket-takers");
  const { store } = useData();
  const { rail } = useRail();
  const fixtures = useFixtures();
  const [q, setQ] = useQ();
  const featured = useMemo(() => featuredEvents(store, { big: rail.bigEvent, pin: PIN_FIRST, fixtures: fixtures.data || [] }) as Pick[], [store, rail.bigEvent, fixtures.data]);
  const asked = Number(q.c);
  const e = q.c && Number.isInteger(asked) && asked > 0 && asked < store.events.length ? asked : featured[0]?.e;
  if (e == null) return <EmptyState icon={<TrophyIcon />} title="No leagues to show yet" body="Live and upcoming competitions appear here once the schedule and data are in." />;
  const picks = featured.some((x) => x.e === e) ? featured : [{ e, name: store.events[e], tag: "" as const }, ...featured];
  return (
    <div className="flex flex-col gap-section">
      <StatsAd />
      <section aria-label="Leagues" className="flex flex-col gap-snug">
        <header className="flex items-center justify-between gap-snug">
          <h1 className="text-title font-bold tracking-tight">Leagues</h1>
          <Link to="/competitions" className={more}>All competitions<ArrowRightIcon className="size-3.5" aria-hidden /></Link>
        </header>
        <PillGroup layoutId="leagues-pick" label="League" value={String(e)} onChange={(v) => { track("leagues_pick", { league: store.events[Number(v)] ?? "" }); setQ({ c: v, season: "" }); }}
          items={picks.map((x) => [String(x.e), <span key={x.e} className="flex items-center gap-tight"><LeagueBadge name={x.name} size="xs" />{x.name}{x.tag && <Tag tag={x.tag} />}</span>] as [string, ReactNode])} />
      </section>
      <section className="flex flex-col gap-stack">
        <header className="flex items-center justify-between gap-snug">
          <h2 className="flex min-w-0 items-center gap-snug text-title font-bold"><LeagueBadge name={store.events[e]} size="md" /><span className="truncate">{store.events[e]}</span></h2>
          <Link to={`/league/${e}`} className={more}>More<ArrowRightIcon className="size-3.5" aria-hidden /></Link>
        </header>
        <TournamentStats eventIdx={e} season={q.season} onSeason={(k) => setQ({ season: k })} />
      </section>
    </div>
  );
}
