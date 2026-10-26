/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useData } from "@/lib/data";
import { dayKey, dayLabel, fixtureStart, localTime, odds, pretty, tzName } from "@/lib/format";
import { loadProps } from "@/lib/feeds";
import { setTitle } from "@/lib/title";
import { useFixtures, upcomingOnly } from "@/hooks/useEngine";
import { useQ } from "@/components/app/forms";
import { PillTabs } from "@/components/app/pill-tabs";
import { TeamBadge } from "@/components/app/badges";
import { Muted, OddsText } from "@/components/app/page";

const WORDS = ["T20", "ODI", "TEST", "IPL", "BBL", "PSL", "T20I", "WOMEN'S", "THE HUNDRED", "SA20", "CPL", "LIST A"];
const FEATS: [string, string][] = [
  ["BALL-BY-BALL DEPTH", "Batting position, innings order, partnerships and 20+ years of Cricsheet data behind every number."],
  ["FIND THE EDGE", "Hit rates over any line, fair decimal odds and the exchange void rules built in."],
  ["ADVANCED FILTERS", "Format, opposition, venue, home/away, batting first or chasing, position and dates."],
  ["CORRELATED PROPS", "When a line clears, see how often the player's other props clear too."],
];

function Landing() {
  return (
    <section className="relative -mx-4 mb-2 overflow-hidden border-b bg-[radial-gradient(90%_120%_at_15%_0%,#12261d_0%,transparent_60%)] px-5 pb-2 pt-9 md:-mx-8 md:px-8 md:pt-14 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-12 lg:pt-16">
      <div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="font-brand text-[clamp(72px,22vw,168px)] font-normal uppercase leading-[.86] tracking-[.01em] md:text-[clamp(96px,13vw,150px)] lg:text-[clamp(110px,10vw,168px)]">FIND THE<br /><span className="text-primary">EDGE</span></motion.h1>
        <p className="mb-4 mt-5 max-w-[560px] text-[17px] text-muted-foreground">Free cricket player props: scan hit rates over any line, DNP-aware form charts, partnerships and fancy markets, then compare with the market in Prop Hunter.</p>
        <div className="flex flex-wrap gap-2 pb-2"><Button asChild className="rounded-full font-semibold"><Link to="/ask">Ask a question <ArrowRight /></Link></Button><Button asChild variant="secondary" className="rounded-full"><Link to="/props">Open Prop Hunter</Link></Button></div>
      </div>
      <div className="grid gap-4 py-5 lg:py-0">{FEATS.map(([t, d]) => <div key={t} className="border-l-[3px] border-primary pl-3.5"><h3 className="font-brand text-2xl font-normal leading-none tracking-wide">{t}</h3><Muted className="mt-1">{d}</Muted></div>)}</div>
      <div aria-hidden className="-mx-5 mt-4 overflow-hidden border-y bg-black/25 md:-mx-8 lg:col-span-2">
        <motion.div className="flex w-max gap-11 py-3 font-brand text-2xl tracking-[.08em] text-muted-foreground" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 32, ease: "linear", repeat: Infinity }}>
          {[...WORDS, ...WORDS].map((w, i) => <span key={i} className={i % 3 === 0 ? "text-primary" : ""}>{w}</span>)}
        </motion.div>
      </div>
    </section>
  );
}

function Sidebar() {
  const { data } = useQuery({ queryKey: ["props-bundled"], queryFn: async () => { try { return await (await fetch("/data/props.json")).json(); } catch { return null; } } });
  const bets = (data?.value_bets || []).slice(0, 5), alerts = (data?.recent_alerts || []).slice(-5).reverse();
  const rows = (bets.length ? bets : alerts).map((b: any) => ({ t: b.selection, s: `${b.match} · ${b.market}`, o: b.best_odds }));
  return (
    <aside className="grid content-start gap-3">
      <Card className="gap-1 px-4 py-4 shadow-none"><div className="text-[11px] font-bold tracking-[.16em] text-primary">● PROP HUNTER</div><div className="text-xl font-medium">{bets.length ? `${bets.length} value bets now` : "Best-value props"}</div>
        <Button asChild size="sm" className="mt-2 w-fit rounded-full font-semibold"><Link to="/props">Open Prop Hunter →</Link></Button></Card>
      <Card className="gap-0 shadow-none"><h3 className="border-b px-4 py-3 text-lg font-medium">{bets.length ? "Top value bets" : "Recent alerts"}</h3>
        <div className="p-2">{rows.length ? rows.map((r: any, i: number) => <Link key={i} to="/props" className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted"><span className="min-w-0 text-sm">{r.t}<small className="block truncate text-xs text-muted-foreground">{r.s}</small></span><OddsText>{odds(r.o)}</OddsText></Link>) : <Muted className="p-2">Nothing flagged right now.</Muted>}</div></Card>
      <Card className="gap-1 px-4 py-4 shadow-none"><h3 className="text-lg font-medium">Ask anything</h3><Muted>Write your question your own way; typos are fine.</Muted><Button asChild className="mt-2 w-fit rounded-full font-semibold"><Link to="/ask">Ask a question</Link></Button></Card>
    </aside>
  );
}

function FixtureGroups({ fx }: { fx: any[] }) {
  if (!fx.length) return <Card className="px-4 py-3 text-muted-foreground shadow-none">Nothing scheduled for this selection.</Card>;
  const groups = new Map<string, any[]>();
  for (const f of fx) {
    const key = f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : f.source === "markets" ? "Matches with prop markets" : `${f.fmt || ""} ${f.gender === "female" ? "women's" : "men's"} cricket`.trim();
    (groups.get(key) || groups.set(key, []).get(key)!).push(f);
  }
  const entries = [...groups.entries()];
  const time = (s: string) => (s.length > 10 ? localTime(s) : "TBC");
  return (
    <Accordion type="multiple" defaultValue={entries.slice(0, 6).map(([n]) => n)} className="grid gap-3">
      {entries.map(([name, list], gi) => (
        <motion.div key={name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(gi * 0.04, 0.3) }}>
          <AccordionItem value={name} className="overflow-hidden rounded-lg border bg-card last:border-b">
            <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
              <span className="flex min-w-0 flex-1 items-center gap-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-extrabold text-primary">{list[0].fmt || "·"}</span>
                <span className="min-w-0 text-left"><b className="block truncate font-semibold">{name}</b><span className="text-[13px] font-normal text-muted-foreground">{list[0].gender === "female" ? "Women" : "Men"}</span></span></span>
              <Badge variant="secondary" className="mr-2">{list.length}</Badge>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              {list.map((f) => (
                <Link key={`${f.id}${f.a}${f.b}`} to={f.id ? `/fixture/${f.id}` : f.a_ix >= 0 ? `/team/${f.a_ix}` : "/teams"} className="flex items-center gap-3.5 border-t px-4 py-3 transition-colors hover:bg-[#151515]">
                  <div className="grid min-w-0 flex-1 gap-2 font-medium"><div className="flex items-center gap-2.5"><TeamBadge name={f.a} />{f.a}</div><div className="flex items-center gap-2.5"><TeamBadge name={f.b} />{f.b}</div></div>
                  <div className="max-w-44 text-right text-[13px] text-muted-foreground"><b className="block text-foreground">{time(f.start)}</b>{f.venue || f.fmt || ""}</div><ArrowRight className="size-4 text-muted-foreground" />
                </Link>))}
            </AccordionContent>
          </AccordionItem>
          {gi === 0 && entries.length > 1 && (
            <Card className="mt-3 gap-1 border-primary/30 bg-card px-4 py-4 shadow-none"><h3 className="text-xl font-medium text-primary">Unlock advanced stats</h3><Muted>Hit rates over any line, DNP-aware form charts and fair decimal odds for every player.</Muted>
              <div className="mt-2 flex flex-wrap gap-2"><Button asChild className="rounded-full font-semibold"><Link to="/props">Prop Hunter →</Link></Button><Button asChild variant="secondary" className="rounded-full"><Link to="/ask">Ask anything →</Link></Button></div></Card>)}
        </motion.div>))}
    </Accordion>
  );
}

export function HomePage() {
  setTitle("Cricket fixtures, player props and stats");
  const { store } = useData();
  const { data, isLoading } = useFixtures();
  const [q, setQ] = useQ();
  const [f, setF] = useState("all");
  const fx = upcomingOnly(data || []);
  const days = [...new Set(fx.map(dayKey))].slice(0, 12);
  const sel = days.includes(q.d) ? q.d : days[0];
  const list = fx.filter((x) => dayKey(x) === sel && (f === "all" || x.fmt === f || x.gender === f));
  return (
    <div>
      <Landing />
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <h1 className="text-2xl font-medium md:text-3xl">Today's cricket fixtures, player stats &amp; team stats</h1>
          <Muted className="mt-1">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Muted>
          <Muted className="my-1">Hit rates over any line, fair decimal odds, partnerships and fancy markets from {store.meta.matches.toLocaleString()} matches since 2001, men's and women's.</Muted>
          {days.length > 0 && <PillTabs scrollable layoutId="day-tab" tabs={days.map((k) => [k, <>{dayLabel(k)}<small className="ml-1.5 text-muted-foreground">{fx.filter((x) => dayKey(x) === k).length}</small></>])} value={sel} onChange={(d) => setQ({ d })} className="mt-3" />}
          <div className="my-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">{[["all", "ALL"], ["T20", "T20"], ["ODI", "ODI"], ["Test", "TEST"], ["male", "MEN"], ["female", "WOMEN"]].map(([v, l]) => <Button key={v} size="sm" variant={f === v ? "secondary" : "outline"} className="rounded-full" onClick={() => setF(v)}>{l}</Button>)}</div>
          <h2 className="mb-2 mt-4 text-lg font-medium">{days.length ? "Matches" : isLoading ? "Loading fixtures…" : "No upcoming fixtures"}</h2>
          {isLoading ? <div className="grid gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : <FixtureGroups fx={list} />}
          <Muted className="mt-4">Coverage is what the free schedule scrape and odds sources list. Times are shown in your time zone ({tzName()}).</Muted>
        </div>
        <Sidebar />
      </div>
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
void loadProps;
