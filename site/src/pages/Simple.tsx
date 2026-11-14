/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronRightIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { RULES } from "@cricket/engine/rules.js";
import { useData } from "@/lib/data";
import { localWhen, num, odds, pc, tzName } from "@/lib/format";
import { Crumbs, DataTable, Muted, OddsText, PageTitle, StatTile } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { Field, NativeSelect } from "@/components/app/forms";
import { PillGroup } from "@/components/app/pill-group";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";
import { FORMATS } from "@cricket/engine/util.js";
import { useQ } from "@/components/app/forms";
import { setTitle } from "@/lib/title";
import { StatsAd } from "@/components/app/stats-ad";
void localWhen; void num; void tzName; void TeamBadge;

const TOOLS: [string, string, string, string][] = [["trends", "Player trends", "Players whose recent games clear a line, for any upcoming match.", "Popular"],
  ["odds", "Price & probability calculator", "Decimal prices, implied probability, margin removal, EV and Kelly stake.", "New"], ["players", "Player stats", "Hit rates over any line with DNP-aware form charts.", ""],
  ["teams", "Team & venue stats", "Match totals, fancy markets and player grids.", ""], ["pair", "Partnerships", "Who gets out first for any pair of batters.", ""],
  ["competitions", "Competitions", "Markets, teams and results for every league and series.", ""], ["glossary", "Cricket stats explained", "What every market and rule means.", ""]];
export function ToolsPage() {
  setTitle("Free cricket stats tools");
  return (
    <div className="flex flex-col gap-stack">
      <Crumbs items={[["Home", "/"], ["Tools"]]} />
      <PageTitle sub="Cricket stats and data, completely free: no login, no paywall, no betting.">Free cricket stats tools</PageTitle>
      <div className="flex flex-wrap gap-hair">{["100% free", "No registration", "Ball-by-ball data"].map((x) => <Badge key={x} variant="secondary" className="rounded-full px-snug py-tight font-copy">{x}</Badge>)}</div>
      <div className="grid gap-stack [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {TOOLS.map(([r, t, d, b], i) => (
          <motion.div key={r} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -3 }}>
            <Link to={`/${r}`}>
              <Card className="h-full gap-hair px-inset py-stack shadow-none transition-colors hover:bg-surface-raised">
                {b ? <Badge className="w-fit bg-primary/15 text-primary">{b}</Badge> : null}
                <h3 className="text-title font-label">{t}</h3>
                <Muted>{d}</Muted>
                <OddsText>Open →</OddsText>
              </Card>
            </Link>
          </motion.div>))}
      </div>
    </div>
  );
}

export function OddsPage() {
  setTitle("Price calculator");
  const [v, setV] = useState({ dec: "1.90", opp: "1.90", p: "55", bank: "1000" });
  const d = Number(v.dec), o = Number(v.opp), p = Number(v.p) / 100, b = Number(v.bank);
  const imp = d > 1 ? 1 / d : null, impO = o > 1 ? 1 / o : null, over = imp && impO ? imp + impO : null;
  const fair = over ? imp! / over : null, ev = p && d > 1 ? p * d - 1 : null, kelly = ev != null && d > 1 ? Math.max(0, ev / (d - 1)) : null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="flex flex-col gap-stack">
      <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Price calculator"]]} />
      <PageTitle sub="A stats calculator: turn a decimal price into a probability and strip the two-way margin. It does not place a bet.">Price &amp; probability calculator</PageTitle>
      <Card className="flex-row flex-wrap items-end gap-stack p-inset shadow-none">
        <Field label="Decimal price (this side)"><Input type="number" step="0.01" min="1.01" value={v.dec} onChange={set("dec")} className="w-36" /></Field>
        <Field label="Decimal price (other side)"><Input type="number" step="0.01" min="1.01" value={v.opp} onChange={set("opp")} className="w-36" /></Field>
        <Field label="Your probability %"><Input type="number" step="0.1" min="0" max="100" value={v.p} onChange={set("p")} className="w-36" /></Field>
        <Field label="Bankroll"><Input type="number" step="1" min="0" value={v.bank} onChange={set("bank")} className="w-36" /></Field>
      </Card>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-stack">
        <StatTile k="Implied probability" v={imp ? pc(imp) : "–"} s="1 ÷ decimal price" />
        <StatTile k="Margin (overround)" v={over ? `${((over - 1) * 100).toFixed(1)}%` : "–"} s="both sides of the market" />
        <StatTile k="No-vig probability" v={fair ? pc(fair) : "–"} s={fair ? `fair price ${odds(1 / fair)}` : "enter both sides"} />
        <StatTile k="Expected value" v={ev != null ? `${(ev * 100).toFixed(1)}%` : "–"} s="per 1 staked at your probability" />
        <StatTile k="Kelly stake" v={kelly != null && b ? `${(kelly * b).toFixed(0)}` : "–"} s={kelly != null ? `full Kelly ${(kelly * 100).toFixed(1)}% · quarter ${(kelly * 25).toFixed(1)}%` : ""} />
      </div>
      <Muted>For reading prices as statistics only. Fair price on this site is 1 ÷ historical hit rate and ignores margin, form, pitch and XIs. Fancy.cash does not offer, promote or encourage gambling.</Muted>
    </div>
  );
}

const GLOSS: [string, string, string, string][] = [
  ["Hit rate", "Basic", "Prices", "Share of eligible games that finished on the chosen side of the line. Over means above the line, and under means below it. A result exactly on the line is left out of the rate."],
  ["Fair decimal price", "Basic", "Prices", "1 ÷ hit rate. The price at which the historical rate breaks even, with no bookmaker margin."],
  ["Line", "Basic", "Prices", "The threshold in a prop, e.g. sixes over 0.5 or runs over 24.5."],
  ["Similar in-play lines", "Basic", "Form", "How recent live batter-run lines finished in comparable T20 or ODI innings. The comparison uses runs scored, balls faced and runs needed to go over. Each batter innings counts once in the comparison."],
  ["Batter’s own history", "Basic", "Form", "How this batter's own past innings finished against today's line after scoring a similar number of runs from the same number of balls."],
  ["Similar team innings", "Basic", "Form", "How past teams finished against today's line after scoring a similar number of runs at the same point in the innings."],
  ["On the line (push)", "Basic", "Rules", "The final score lands exactly on the line. For example, 50 runs on a line of 50 is a push. The stake is returned."],
  ["DNP", "Basic", "Form", "Did not play: the team had a fixture but the player was not in the playing XI. Shown on charts, left out of hit rates."],
  ["VOID (did not bat / bowl)", "Intermediate", "Rules", "Named in the playing XI but never reached the crease (or never bowled): bets on that player's batting (or bowling) stats are void and the stake is returned. Left out of hit rates."],
  ["30s", "Basic", "Markets", "Innings of 30-49 runs. Counted per match as a fancy market."],
  ["50s", "Basic", "Markets", "Innings of 50-99 runs (100+ are centuries)."],
  ["Double-digit scores", "Basic", "Markets", "Batters reaching 10 or more."],
  ["Single-digit scores", "Basic", "Markets", "Scores of 1-9. Ducks (out for 0) are not single-digit."],
  ["Highest runs in an over", "Intermediate", "Markets", "Most runs scored in a single over of the match."],
  ["Most runs conceded", "Intermediate", "Markets", "The largest number of runs conceded by one bowler in the match."],
  ["Top batter", "Intermediate", "Markets", "Highest scorer in the match, or for the team batting first. Ties are shown separately."],
  ["Void rules", "Intermediate", "Rules", "T20 and ODI summary markets are void unless 80% of the overs are bowled in both innings; Tests unless there is a result or 300 (5-day) / 200 (4-day) overs."],
  ["Team-specific markets", "Intermediate", "Rules", "Count only the team batting first."],
  ["Retired hurt", "Basic", "Rules", "Not a wicket. Penalty runs count. Super overs are ignored."],
  ["Batting position", "Intermediate", "Form", "Order in which a batter first appears at the crease (openers are 1 and 2)."],
  ["Home / away / neutral", "Intermediate", "Form", "Inferred from the series name, the venue's host nation and who plays there most; the base data has no home flag."],
  ["Correlated props", "Advanced", "Prices", "How often two of a player's stats clear their lines together, compared with how often each clears on its own."],
  ["Overround", "Advanced", "Prices", "The sum of implied probabilities above 100%: the bookmaker's margin."],
  ["Kelly stake", "Advanced", "Prices", "Stake sized from your edge: (p × price - 1) ÷ (price - 1). Quarter Kelly is the usual cautious fraction."],
  ["Provisional matches", "Intermediate", "Data", "Recent matches shown from early scorecards while we wait for the full match data. Some stats may be unavailable."],
];
export function GlossaryPage() {
  setTitle("Cricket stats explained");
  const [q] = useQ();
  const [t, setT] = useState(q.q || ""), [c, setC] = useState("All"), [l, setL] = useState("All");
  const cats = ["All", ...new Set(GLOSS.map((g) => g[2]))], levels = ["All", "Basic", "Intermediate", "Advanced"];
  const list = GLOSS.filter((g) => (c === "All" || g[2] === c) && (l === "All" || g[1] === l) && (!t || (g[0] + g[3]).toLowerCase().includes(t.toLowerCase())));
  return (
    <div className="flex flex-col gap-stack">
      <StatsAd />
      <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Cricket stats explained"]]} />
      <PageTitle sub="Every market, rule and number on this site, in plain words.">Cricket stats explained</PageTitle>
      <Card className="flex-row flex-wrap items-center gap-stack p-inset shadow-none">
        <Input type="search" aria-label="Search stats and rules" placeholder="Search stats and rules" value={t} onChange={(e) => setT(e.target.value)} className="min-w-52 flex-1" />
        <NativeSelect name="c" options={cats.map((x) => [x, x])} defaultValue={c} onChange={(e) => setC(e.target.value)} />
        <NativeSelect name="l" options={levels.map((x) => [x, x])} defaultValue={l} onChange={(e) => setL(e.target.value)} />
      </Card>
      {list.length ? (
        <Card className="px-inset shadow-none">
          <Accordion type="single" collapsible>
            {list.map(([title, lv, cat, d]) => (
              <AccordionItem key={title} value={title}>
                <AccordionTrigger>
                  <span className="flex flex-1 items-center gap-snug">
                    {title}
                    <span className="ml-auto flex gap-hair"><Badge variant="outline">{lv}</Badge><Badge variant="secondary">{cat}</Badge></span>
                  </span>
                </AccordionTrigger>
                <AccordionContent><p className="text-callout text-muted-foreground">{d}</p></AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      ) : (
        <EmptyState title="Nothing matches" body="Try another search or clear the filters." />
      )}
    </div>
  );
}

const DEFS = [
  "Fair decimal price = 1 ÷ hit rate on the filtered sample. Pushes (whole-number lines) are void. A 90% interval shows how far small samples can mislead.",
  "Home / away / neutral is inferred from the event ('X tour of Y'), the venue's country and the team that plays most at the ground: the base data has no home flag.",
  "Batting position is the order batters first appear at the crease. Batting first / chasing is the player's team.",
  "Runs conceded include penalty runs, exclude byes and leg byes. Super overs are ignored.",
  "A player named in the XI who never batted or bowled shows as VOID (the bet is void); a player not named shows as DNP; an XI that was not recorded reliably shows N/A. None of the three counts in a hit rate.",
  "Provisional (scraped) matches fill the gap before the base data is updated: they carry player totals only, so they feed player props but not partnerships, batting position, innings order or match markets.",
];
export function AboutPage() {
  setTitle("Rules and data");
  const { store } = useData();
  const f = store.freshness();
  const list = (xs: string[]) => <ul className="flex list-disc flex-col gap-tight pl-inset">{xs.map((r) => <li key={r} className="text-callout text-muted-foreground">{r}</li>)}</ul>;
  return (
    <div className="flex flex-col gap-stack">
      <StatsAd />
      <Crumbs items={[["Home", "/"], ["Rules & data"]]} />
      <PageTitle>Rules, definitions and data</PageTitle>
      <Card className="px-inset shadow-none"><Accordion type="single" collapsible defaultValue="rules">
        <AccordionItem value="rules"><AccordionTrigger><span className="flex items-center gap-snug">Settlement rules applied <Badge variant="secondary">{RULES.length}</Badge></span></AccordionTrigger><AccordionContent>{list(RULES)}</AccordionContent></AccordionItem>
        <AccordionItem value="defs"><AccordionTrigger><span className="flex items-center gap-snug">Definitions <Badge variant="secondary">{DEFS.length}</Badge></span></AccordionTrigger><AccordionContent>{list(DEFS)}</AccordionContent></AccordionItem>
        <AccordionItem value="fresh"><AccordionTrigger>Data freshness</AccordionTrigger><AccordionContent><p className="text-callout text-muted-foreground">Ball-by-ball data through <b>{f.newestBase}</b>{f.provisionalIncluded ? <> · includes <b>{f.provisionalMatches}</b> provisional matches up to <b>{f.newestProvisional || "?"}</b></> : " · no provisional matches included"}.</p></AccordionContent></AccordionItem>
        <AccordionItem value="credits"><AccordionTrigger>Credits and how to use the site</AccordionTrigger><AccordionContent><p className="text-callout text-muted-foreground">We count page views and which buttons are used; analytics load without a consent prompt (ads cookies stay off; no account, no personal data sold). A short-lived site cookie is used only to load the data files; it is not a tracking cookie and is not prompted. Free cricket stats and data. Photos: Wikimedia Commons (free licences, where available). Data: open ball-by-ball data plus provisional scorecards. Decimal prices are market data shown next to history; fair price is 1 ÷ historical hit rate with no margin. Fancy.cash does not offer, promote or encourage gambling. Book names and logos are trademarks of their owners, shown only to say where a listed price comes from.</p></AccordionContent></AccordionItem>
      </Accordion></Card>
      <Muted>See also: <Link className="text-primary" to="/glossary">Cricket stats explained</Link>.</Muted>
    </div>
  );
}

export function PlayersPage() {
  setTitle("Cricket player stats");
  const { store, rz } = useData();
  const [q, setQ] = useQ();
  const [text, setText] = useState(q.q || "");
  const t = text.trim();
  const rows = useMemo(() => (t.length < 2 ? [] : rz.players(t, {}, 20)), [t, rz]);
  const change = (v: string) => { setText(v); setQ({ q: v }); };
  return (
    <div className="flex flex-col gap-stack">
      <StatsAd />
      <h1 className="text-title font-emphasis tracking-tight">Players</h1>
      <InputGroup className="h-control rounded-[10px] border-0 bg-muted">
        <InputGroupAddon><MagnifyingGlassIcon className="size-4" /></InputGroupAddon>
        <InputGroupInput type="search" placeholder="Search a player (typos ok)" aria-label="Search players" value={text} onChange={(e) => change(e.target.value)} className="text-body" />
        {text && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear" onClick={() => change("")}><XMarkIcon className="size-4" /></InputGroupButton></InputGroupAddon>}
      </InputGroup>
      {t.length < 2 ? <EmptyState compact title="Type at least two letters" body="Search finds players by name (typos ok)." />
        : !rows.length ? <EmptyState compact title={`No player matches “${t}”`} body="Try another spelling." /> : (
          <ul className="overflow-hidden rounded-2xl bg-card ring-1 ring-hairline">
            {rows.map((p: any) => (
              <li key={p.idx} className="relative after:absolute after:bottom-0 after:left-[calc(var(--gutter)+var(--control)+var(--spacing-snug))] after:right-0 after:h-px after:bg-hairline last:after:hidden">
                <Item asChild size="sm" className="min-h-row rounded-none border-0 px-gutter py-snug transition-colors active:bg-accent">
                  <Link to={`/player/${p.idx}`}>
                    <ItemMedia><PlayerBadge idx={p.idx} size="md" className="size-control" /></ItemMedia>
                    <ItemContent className="min-w-0 gap-hair">
                      <ItemTitle className="max-w-full text-body font-label leading-snug"><span className="truncate">{p.name}</span></ItemTitle>
                      <ItemDescription className="truncate text-callout text-muted-foreground">{store.teamName(p.team)} · {FORMATS.filter((_: string, i: number) => (store.P.fm[p.idx] >> i) & 1).join(" ")}{p.last ? ` · last ${p.last}` : ""}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-tight text-footnote tabular-nums text-muted-foreground">{store.P.n[p.idx]} inns<ChevronRightIcon className="size-4" aria-hidden /></ItemActions>
                  </Link>
                </Item>
              </li>
            ))}
          </ul>)}
    </div>
  );
}

export function TeamsPage() {
  setTitle("Teams and venues");
  const { store, rz } = useData();
  const [q, setQ] = useQ();
  const tab = q.tab === "venues" ? "venues" : "teams";
  const [text, setText] = useState(q.q || "");
  const rows = useMemo((): [string, number, number][] => {
    const t = text.trim();
    if (tab === "venues" && t.length >= 2) return rz.venues(t, 60).map((v: { name: string; idx: number }) => [v.name, v.idx, rz.venueCount[v.idx]] as [string, number, number]);
    const counts = tab === "teams" ? rz.teamCount : rz.venueCount;
    const names: string[] = tab === "teams" ? store.teams.map((_: any, i: number) => store.teamName(i)) : store.venues;
    const q = t.toLowerCase();
    return names.map((n, i) => [n, i] as [string, number]).filter(([n]) => !q || n.toLowerCase().includes(q)).sort((a, b) => counts[b[1]] - counts[a[1]]).slice(0, 60).map(([n, i]) => [n, i, counts[i]] as [string, number, number]);
  }, [tab, text, store, rz]);
  return (
    <div className="flex flex-col gap-stack">
      <StatsAd />
      <PageTitle>Teams &amp; venues</PageTitle>
      <PillGroup segmented layoutId="tv-tab" label="Directory" value={tab} onChange={(k) => setQ({ tab: k })} items={[["teams", "Teams"], ["venues", "Venues"]]} />
      <Input type="search" aria-label={`Search ${tab}`} placeholder={`Search ${tab}`} value={text} onChange={(e) => setText(e.target.value)} />
      <DataTable bleed columns={[tab === "teams" ? "Team" : "Venue", "Matches"]} rows={rows.map(([n, i, c]) => [<Link key={i} className="text-primary" to={`/${tab === "teams" ? "team" : "venue"}/${i}`}>{n}</Link>, c])} />
    </div>
  );
}
