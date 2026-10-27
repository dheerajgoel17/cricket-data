/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fixtureStart, localTime } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { usePricedFixtures } from "@/hooks/useEngine";
import { TeamBadge } from "@/components/app/badges";
import { FixtureRail } from "@/components/app/fixture-card";
import { HotProps } from "@/components/app/hot-props";
import { Muted } from "@/components/app/page";

export function HomePage() {
  setTitle("Cricket fixtures, hot player props and stats");
  const { fixtures: fx } = usePricedFixtures();
  return (
    <div>
      <FixtureRail fx={fx.slice(0, 14)} />
      <HotProps />
    </div>
  );
}

/** Countdown to a kick-off (updates every 30 s). */
export function Countdown({ when }: { when: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const ms = Math.max(0, when.getTime() - now), d = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60;
  return <div className="flex gap-3.5">{[[d, "d"], [String(hh).padStart(2, "0"), "h"], [String(mm).padStart(2, "0"), "m"]].map(([v, u]) => <div key={u as string} className="grid justify-items-center"><b className="text-2xl font-extrabold tabular-nums">{v}</b><span className="text-[11px] uppercase text-muted-foreground">{u}</span></div>)}</div>;
}

export function NextMatch({ f }: { f: any }) {
  const when = fixtureStart(f);
  return (
    <Card className="my-3 gap-3 px-4 py-4 shadow-none">
      <div className="flex items-center justify-between"><h3 className="text-lg font-medium">Next match</h3><Badge variant="secondary">{`${f.fmt || ""} ${f.gender === "female" ? "women" : "men"}`}</Badge></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div className="grid justify-items-center gap-2"><TeamBadge name={f.a} size="lg" /><b>{f.a}</b></div>
        <div className="grid justify-items-center gap-0.5"><div className="text-3xl font-extrabold">{f.start.length > 10 ? localTime(when) : "TBC"}</div><small className="text-muted-foreground">{when.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</small><div className="mt-2 text-sm text-muted-foreground">Kicks off in</div><Countdown when={when} /></div>
        <div className="grid justify-items-center gap-2"><TeamBadge name={f.b} size="lg" /><b>{f.b}</b></div>
      </div>
      {f.venue ? <Muted className="text-center">{f.venue}</Muted> : null}
    </Card>
  );
}
