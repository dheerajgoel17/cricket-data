/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fixtureStart, localTime } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { useHomeRail } from "@/hooks/useHomeRail";
import { TeamBadge } from "@/components/app/badges";
import { FixtureRail } from "@/components/app/fixture-card";
import { HotHome } from "@/components/app/hot-home";
import { Muted } from "@/components/app/page";
import { RailSkeleton } from "@/components/app/skeletons";

export function HomePage() {
  setTitle("Cricket fixtures, hot player props and stats");
  // matches in play first, then the ones to come, finished ones last; inside each the viewer's own team, then the biggest matches (src/lib/priority.ts, settings in config/home_rail.json)
  const { ready, fixtures } = useHomeRail();
  return (
    <div className="flex flex-col gap-section">
      <div className="lg:hidden">{ready ? <FixtureRail fx={fixtures} /> : <RailSkeleton />}</div>
      <HotHome />
    </div>
  );
}

/** Countdown to a kick-off (updates every 30 s). */
export function Countdown({ when }: { when: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const ms = Math.max(0, when.getTime() - now), d = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60;
  return <div className="flex gap-snug">{[[d, "d"], [String(hh).padStart(2, "0"), "h"], [String(mm).padStart(2, "0"), "m"]].map(([v, u]) => <div key={u as string} className="grid justify-items-center"><b className="text-metric font-extrabold tabular-nums">{v}</b><span className="text-caption uppercase text-muted-foreground">{u}</span></div>)}</div>;
}

export function NextMatch({ f }: { f: any }) {
  const when = fixtureStart(f);
  return (
    <Card className="gap-snug px-4 py-stack shadow-none">
      <div className="flex items-center justify-between"><h3 className="text-body font-medium">Next match</h3><Badge variant="secondary">{`${f.fmt || ""} ${f.gender === "female" ? "women" : "men"}`}</Badge></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-snug text-center">
        <div className="grid justify-items-center gap-tight"><TeamBadge name={f.a} size="lg" /><b>{f.a}</b></div>
        <div className="grid justify-items-center gap-hair"><div className="text-metric font-extrabold">{f.start.length > 10 ? localTime(when) : "TBC"}</div><small className="text-muted-foreground">{when.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</small><div className="pt-tight text-callout text-muted-foreground">Kicks off in</div><Countdown when={when} /></div>
        <div className="grid justify-items-center gap-tight"><TeamBadge name={f.b} size="lg" /><b>{f.b}</b></div>
      </div>
      {f.venue ? <Muted className="text-center">{f.venue}</Muted> : null}
    </Card>
  );
}
