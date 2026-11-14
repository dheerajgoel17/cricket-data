import { DesignDocsShell, DesignHome } from "@/components/design-system/chrome";
import { DocsArticle, slugify, type TocItem } from "@/components/design-system/docs-article";
import { DocPanel, PreviewFrame } from "@/components/design-system/example-stage";
import { Link, useLocation } from "react-router-dom";
import { DesignReference, TypographyReference, referenceSections } from "@/components/design-system/reference";
import { MotionDemos } from "@/components/design-system/motion-demos";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import tokens from "@cricket/tokens/tokens.json";
import { LeagueBadge, TeamBadge, TeamFlag } from "@/components/app/badges";
import { BookTable } from "@/components/app/book-table";
import { ActiveChip, Chip } from "@/components/app/chip";
import { EmptyState } from "@/components/app/empty-state";
import { Field, LiveForm, NativeSelect } from "@/components/app/forms";
import { LadderRow, pricedFromBooks } from "@/components/app/line-ladder";
import { Note } from "@/components/app/note";
import { AnimatedHeight } from "@/components/app/animated-height";
import { ChartBars } from "@/components/app/chart";
import { CardGrid, Crumbs, DataTable, DetailSplit, Muted, OddsText, PageTitle, Panel, StatGridCards, StatTile, StickyPanel, TABLE_HEAD } from "@/components/app/page";
import { PillGroup } from "@/components/app/pill-group";
import { PillTabs } from "@/components/app/pill-tabs";
import { RowsSkeleton } from "@/components/app/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setTitle, syncMeta } from "@/lib/title";
import { cn } from "@/lib/utils";

const BOOK_DEMO = [
  { source: "book_a", over: 1.9, under: 1.95 },
  { source: "book_b", over: 1.85, under: 2.05 },
  { source: "book_c", over: 2.0, under: 1.88 },
];
const LADDER_DEMO = [
  { line: 24.5, books: BOOK_DEMO },
  { line: 25.5, books: [{ source: "book_a", over: 2.1, under: 1.75 }, { source: "book_b", over: 2.05, under: 1.8 }] },
  { line: 26.5, books: [{ source: "book_a", over: 2.4, under: 1.55 }, { source: "book_c", over: 2.35, under: 1.6 }] },
];

/** Synthetic form chart for the catalogue — hit / miss / DNP / void / push. */
const CHART_DEMO = [
  { date: "2026-05-01", opp: "Mumbai Indians", value: 43 },
  { date: "2026-05-05", opp: "Chennai Super Kings", value: 12 },
  { date: "2026-05-09", opp: "Delhi Capitals", value: null },
  { date: "2026-05-13", opp: "Gujarat Titans", value: null, void: true },
  { date: "2026-05-17", opp: "Punjab Kings", value: 28.5 },
  { date: "2026-05-21", opp: "Rajasthan Royals", value: 35 },
  { date: "2026-05-25", opp: "Kolkata Knight Riders", value: 22 },
  { date: "2026-05-29", opp: "Sunrisers Hyderabad", value: 51 },
];

const GROUPS: readonly { title: string; sections: readonly (readonly [string, string])[] }[] = [
  { title: "Foundations", sections: [["type", "Typography"], ["color", "Colour"], ["space", "Space & size"], ["motion", "Motion"]] },
  { title: "Components", sections: [["components", "Overview"], ["buttons", "Buttons"], ["chips", "Chips & tabs"], ["feedback", "Empty & notes"], ["data", "Data & metrics"], ["forms", "Forms"], ["icons", "Icons"]] },
  { title: "Reference", sections: referenceSections },
  { title: "Guidance", sections: [["rules", "Usage rules"]] },
] as const;

const PAGE_BLURB: Record<string, string> = {
  type: "Satoshi for UI. Barlow Condensed for scoreboard figures.",
  color: "Semantic colour tokens from tokens.json.",
  space: "Stack gaps and layout sizes used across web and app.",
  motion: "Curves, springs, and timings used in the product.",
  components: "Browse product components with live previews.",
  buttons: "Actions and status badges for CTAs and metadata.",
  chips: "Filters, segments, and tab twins for scoped choices.",
  feedback: "Empty, loading, and explanatory notes for every list state.",
  data: "Titles, metrics, charts, dense tables, badges, and priced ladders.",
  forms: "Live filters with disabled and invalid states.",
  icons: "Heroicons jobs used in product chrome.",
  rules: "Hard constraints for contributors.",
  search: "Search tokens, components, screens, and patterns.",
};

const PAGE_WHEN: Record<string, string> = {
  type: "Pick Satoshi for names and UI copy; Barlow Condensed only for scores, odds, hit rates, and label-cap rails.",
  color: "Use semantic tokens (primary, miss, amber, dnp) — never hard-code hex in product UI.",
  space: "Space siblings with parent gap tokens; do not add ad-hoc margins between blocks.",
  motion: "Reuse tokens.motion and the selection spring; honour prefers-reduced-motion.",
  buttons: "One primary action per region. Prefer h-control rounded-full for product CTAs.",
  chips: "Chip / PillGroup for filters; PillTabs when panels switch with the selection.",
  feedback: "Every empty, unknown, or error list uses EmptyState — never a bare spinner or blank panel.",
  data: "StatTile for glances; ChartBars for line history; DataTable + TABLE_HEAD for dense stats; DetailSplit + StickyPanel + CardGrid for desktop boards; TeamBadge sizes; LadderRow + BookTable for priced lines.",
  forms: "LiveForm for filters that apply as you change them; pair Field with NativeSelect or Input.",
  icons: "Heroicons only under components/app, components/ui, and pages — never Lucide.",
  rules: "Follow these before adding a component, page, or token.",
};

const PAGE_SOURCE: Record<string, string> = {
  type: "packages/tokens/tokens.json",
  color: "packages/tokens/tokens.json",
  space: "packages/tokens/tokens.json",
  motion: "packages/tokens/tokens.json",
  buttons: "components/ui/button.tsx",
  chips: "components/app/pill-group.tsx",
  feedback: "components/app/empty-state.tsx",
  data: "components/app/page.tsx · chart.tsx · badges.tsx · line-ladder.tsx · book-table.tsx",
  forms: "components/app/forms.tsx",
  icons: "@heroicons/react/24/outline",
};

const PAGE_TOC: Record<string, TocItem[]> = {
  type: [
    { id: "satoshi", label: "Satoshi" },
    { id: "barlow-condensed", label: "Barlow Condensed" },
    { id: "type-scale", label: "Type scale" },
  ],
  space: [
    { id: slugify("Spacing scale"), label: "Spacing scale" },
    { id: "layout-sizes", label: "Layout sizes" },
  ],
  motion: [
    { id: slugify("ease-out entrance"), label: "ease-out" },
    { id: slugify("ease-in-out toggle"), label: "ease-in-out" },
    { id: slugify("ease-drawer peek"), label: "ease-drawer" },
    { id: slugify("Selection spring"), label: "Selection spring" },
    { id: "product-timings", label: "Timings" },
  ],
  buttons: [
    { id: slugify("Variants"), label: "Variants" },
    { id: slugify("Loading"), label: "Loading" },
    { id: slugify("Badge"), label: "Badge" },
  ],
  chips: [
    { id: slugify("Chip + ActiveChip"), label: "Chip" },
    { id: slugify("PillGroup — default"), label: "PillGroup" },
    { id: slugify("PillGroup — segmented"), label: "Segmented" },
    { id: slugify("PillGroup — sub"), label: "Sub" },
    { id: slugify("PillTabs"), label: "PillTabs" },
  ],
  feedback: [
    { id: slugify("EmptyState"), label: "EmptyState" },
    { id: slugify("Loading skeleton"), label: "Skeleton" },
    { id: slugify("Unknown / error"), label: "Error" },
    { id: slugify("Note"), label: "Note" },
  ],
  data: [
    { id: slugify("PageTitle + Crumbs"), label: "PageTitle" },
    { id: slugify("StatTile + Panel"), label: "StatTile" },
    { id: slugify("ChartBars"), label: "ChartBars" },
    { id: `datatable-bleed-${TABLE_HEAD.includes("footnote") ? "table-head" : "head"}`, label: "DataTable" },
    { id: slugify("DetailSplit + StickyPanel"), label: "DetailSplit" },
    { id: slugify("CardGrid"), label: "CardGrid" },
    { id: slugify("TeamBadge sizes"), label: "Badges" },
    { id: slugify("BookTable"), label: "BookTable" },
    { id: slugify("LadderRow"), label: "LadderRow" },
  ],
  forms: [
    { id: slugify("LiveForm"), label: "LiveForm" },
    { id: slugify("Disabled"), label: "Disabled" },
    { id: slugify("Invalid"), label: "Invalid" },
  ],
  icons: [{ id: slugify("Heroicons in product code"), label: "Heroicons" }],
  rules: [
    { id: "hard-rules", label: "Hard rules" },
    { id: "changelog", label: "Changelog" },
  ],
};

const WEIGHTS = [
  [`Light · ${tokens.weight["weight-editorial"]}`, "font-editorial"],
  [`Regular · ${tokens.weight["weight-copy"]}`, "font-copy"],
  [`Medium · ${tokens.weight["weight-label"]}`, "font-label"],
  [`Bold · ${tokens.weight["weight-emphasis"]}`, "font-emphasis"],
  [`Black · ${tokens.weight["weight-brand"]}`, "font-display-heavy"],
] as const;

const focusLink = "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const COMPONENT_CARDS: readonly { id: string; title: string; detail: string; preview: ReactNode }[] = [
  { id: "buttons", title: "Buttons", detail: "Primary actions and badges", preview: <Button size="sm">Default</Button> },
  { id: "chips", title: "Chips & tabs", detail: "Filters and segmented controls", preview: <span className="inline-flex h-8 items-center rounded-full bg-primary px-snug text-footnote font-label text-primary-foreground">T20</span> },
  { id: "feedback", title: "Empty & notes", detail: "EmptyState, skeletons, Note", preview: <span className="text-footnote text-muted-foreground">Nothing saved yet</span> },
  { id: "data", title: "Data & metrics", detail: "StatTile, Panel, DataTable, DetailSplit, CardGrid", preview: <span className="font-condensed text-title tabular-nums text-primary">1.61</span> },
  { id: "forms", title: "Forms", detail: "LiveForm, Field, NativeSelect", preview: <span className="rounded border border-hairline px-snug py-hair text-footnote">Format ▾</span> },
  { id: "icons", title: "Icons", detail: "Heroicons in product jobs", preview: <StarIcon className="size-5" aria-hidden /> },
];

function TypeRow({ role, sample, className }: { role: string; sample: string; className: string }) {
  return (
    <div className="grid gap-tight border-b border-hairline py-stack last:border-0 sm:grid-cols-[7rem_1fr] sm:items-baseline">
      <code className="label-cap text-footnote text-muted-foreground">{role}</code>
      <p className={cn("min-w-0 text-foreground", className)}>{sample}</p>
    </div>
  );
}

function SpaceBar({ name, rem }: { name: string; rem: string }) {
  return (
    <div className="flex items-center gap-stack">
      <code className="w-24 shrink-0 text-footnote text-muted-foreground">{name}</code>
      <div className="h-5 rounded-sm bg-primary/40" style={{ width: rem }} />
      <span className="text-footnote text-muted-foreground">{rem}</span>
    </div>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  const isColor = value.startsWith("#") || value.startsWith("rgba") || value.startsWith("rgb");
  return (
    <div className="flex min-w-0 flex-col gap-tight overflow-hidden rounded-xl border border-hairline bg-card">
      <div className="aspect-[5/3] w-full" style={isColor ? { background: value } : { background: "var(--surface-raised)" }} aria-hidden />
      <div className="flex flex-col gap-hair px-snug py-tight">
        <span className="truncate text-callout font-label">{name}</span>
        <code className="truncate text-footnote text-muted-foreground">{value}</code>
      </div>
    </div>
  );
}

/**
 * Living design-system catalogue: tokens, type, space, motion, and product
 * component variants. Tool-style shell; noindex; not in the sitemap.
 */
export function DesignSystemPage() {
  setTitle("Design system");
  const reduce = useReducedMotion();
  const [pill, setPill] = useState("t20");
  const [seg, setSeg] = useState("over");
  const [sub, setSub] = useState("live");
  const [tab, setTab] = useState("log");
  const [chipOn, setChipOn] = useState(true);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [lineInvalid, setLineInvalid] = useState(false);
  const [ladderLine, setLadderLine] = useState(24.5);

  const { pathname, hash } = useLocation();
  const topics = GROUPS.flatMap(({ title, sections }) => Array.from(sections).map(([id, label]) => ({ id, label, group: title })));
  const topicPath = (id: string) => `/docs/${id}`;
  const legacy = pathname === "/" && topics.some((topic) => "#" + topic.id === hash);
  const current = topics.find((topic) => legacy ? "#" + topic.id === hash : topicPath(topic.id) === pathname);
  const index = current ? topics.indexOf(current) : -1;
  const search = pathname === "/search";
  const home = pathname === "/" && !current;
  const notFound = !home && !search && !current;
  const heading = current?.label ?? (search ? "Search" : home ? "Design system" : "Page not found");
  const blurb = current ? PAGE_BLURB[current.id] : search ? PAGE_BLURB.search : undefined;
  setTitle(heading);

  useEffect(() => {
    syncMeta("/design-system", pathname);
    if (hash && !legacy) document.getElementById(hash.slice(1))?.scrollIntoView?.();
    else window.scrollTo?.(0, 0);
  }, [pathname, hash, legacy]);

  const colors = Object.entries(tokens.color).filter(([, v]) => typeof v === "string" && (String(v).startsWith("#") || String(v).startsWith("rgba")));
  const spaces = Object.entries(tokens.space);
  const sizes = Object.entries(tokens.size).filter(([k]) => ["control", "gutter", "row-min", "card-radius", "chip-radius", "header-h", "touch"].includes(k));

  const tableBleedId = `datatable-bleed-${TABLE_HEAD.includes("footnote") ? "table-head" : "head"}`;

  const demos: Record<string, ReactNode> = {
    type: (
      <>
        <div className="grid gap-stack xl:grid-cols-2">
          <DocPanel id="satoshi" title="Satoshi">
            <p className="mb-stack text-callout text-muted-foreground">Regular for UI copy. Medium for controls. Bold for page titles.</p>
            <div>{WEIGHTS.map(([weight, style]) => <TypeRow key={weight} role={weight} sample="Cricket fixtures" className={cn("text-title", style)} />)}</div>
          </DocPanel>
          <DocPanel id="barlow-condensed" title="Barlow Condensed">
            <p className="mb-stack text-callout text-muted-foreground">Light for tabular figures. Medium for caps. Bold for key scores.</p>
            <div>{WEIGHTS.filter(([weight]) => !weight.startsWith("Regular")).map(([weight, style]) => <TypeRow key={weight} role={weight} sample="172/4 · 18.2 overs" className={cn("font-condensed text-metric tabular-nums", style)} />)}</div>
          </DocPanel>
        </div>
        <TypographyReference />
        <DocPanel id="type-scale" title="Type scale">
          <TypeRow role="display" sample="Harry Brook" className="text-display font-emphasis tracking-tight" />
          <TypeRow role="title" sample="Player props" className="text-title font-label tracking-tight" />
          <TypeRow role="body" sample="Hit rates over the listed line, last ten games." className="text-body" />
          <TypeRow role="callout" sample="Void when in the XI but did not bat." className="text-callout text-muted-foreground" />
          <TypeRow role="footnote" sample="n 24 · median 42 · fair 1.85" className="text-footnote text-muted-foreground" />
          <TypeRow role="caption" sample="label-cap uppercase" className="label-cap text-caption text-muted-foreground" />
          <TypeRow role="stat" sample="1.92" className="text-stat font-label tabular-nums" />
          <TypeRow role="metric" sample="O 24.5" className="text-metric font-condensed tabular-nums" />
          <TypeRow role="num-cond" sample="67 · 4/12 · fair 1.48" className="font-condensed text-title tabular-nums text-primary" />
        </DocPanel>
      </>
    ),

    color: (
      <>
        <Muted>Prefer primary for positive / selected, miss for under, amber for push / caution.</Muted>
        <div className="grid grid-cols-2 gap-snug sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {colors.map(([name, value]) => <Swatch key={name} name={name} value={String(value)} />)}
        </div>
      </>
    ),

    space: (
      <>
        <PreviewFrame title="Spacing scale" description="Parent flex/grid gap — do not margin blocks yourself." source="tokens.space">
          <div className="flex w-full flex-col gap-snug">
            {spaces.map(([name, rem]) => <SpaceBar key={name} name={name.replace("space-", "")} rem={String(rem)} />)}
          </div>
        </PreviewFrame>
        <DocPanel id="layout-sizes" title="Layout sizes">
          <div className="grid grid-cols-2 gap-snug sm:grid-cols-3">
            {sizes.map(([k, v]) => (
              <div key={k} className="grid gap-hair rounded-md border border-hairline px-inset py-snug">
                <code className="text-footnote text-muted-foreground">{k}</code>
                <p className="text-callout font-label">{String(v)}</p>
              </div>
            ))}
          </div>
        </DocPanel>
      </>
    ),

    motion: <MotionDemos />,

    components: (
      <div className="grid gap-snug sm:grid-cols-2 xl:grid-cols-3">
        {COMPONENT_CARDS.map(({ id, title, detail, preview }) => (
          <Link key={id} to={topicPath(id)} className={cn("group grid overflow-hidden rounded-xl border border-hairline bg-card hover:border-primary/40 hover:bg-surface", focusLink)}>
            <div className="grid min-h-28 place-items-center border-b border-hairline bg-muted/50 p-inset">{preview}</div>
            <span className="grid gap-hair p-inset">
              <span className="text-title font-emphasis">{title}</span>
              <span className="text-callout text-muted-foreground">{detail}</span>
            </span>
          </Link>
        ))}
      </div>
    ),

    buttons: (
      <>
        <PreviewFrame title="Variants" description="Product CTAs often use h-control rounded-full." source="components/ui/button.tsx">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button variant="secondary" className="h-control rounded-full">Pill control</Button>
        </PreviewFrame>
        <PreviewFrame title="Loading" description="Caller-managed: disable and change the label while the request runs.">
          <Button type="button" disabled={loadingBtn} onClick={() => { setLoadingBtn(true); window.setTimeout(() => setLoadingBtn(false), 1200); }}>
            {loadingBtn ? "Saving…" : "Save filter"}
          </Button>
        </PreviewFrame>
        <PreviewFrame title="Badge" description="Quiet status chips; secondary for metadata." source="components/ui/badge.tsx">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge className="bg-primary/15 text-primary">Primary wash</Badge>
        </PreviewFrame>
      </>
    ),

    chips: (
      <>
        <PreviewFrame title="Chip + ActiveChip" description="Single selectable filter; dismissible applied filter." source="components/app/chip.tsx">
          <Chip on={chipOn} onClick={() => setChipOn((v) => !v)}>Runs</Chip>
          <Chip on={!chipOn} onClick={() => setChipOn((v) => !v)}>Wickets</Chip>
          <ActiveChip label="Format" value="T20" onRemove={() => undefined} />
        </PreviewFrame>
        <PreviewFrame title="PillGroup — default" description="Parent filters; selected = primary fill." source="components/app/pill-group.tsx">
          <PillGroup layoutId="ds-pill" label="Format" value={pill} onChange={setPill} items={[["t20", "T20"], ["odi", "ODI"], ["test", "Test"]]} />
        </PreviewFrame>
        <PreviewFrame title="PillGroup — segmented" description="Raised thumb in a track (Over / Under).">
          <PillGroup segmented layoutId="ds-seg" label="Side" value={seg} onChange={setSeg} items={[["over", "Over"], ["under", "Under"]]} />
        </PreviewFrame>
        <PreviewFrame title="PillGroup — sub" description="Quiet underline row. Put hairline on the parent." canvasClassName="items-end bg-background">
          <div className="w-full border-b border-hairline">
            <PillGroup sub layoutId="ds-sub" label="Phase" value={sub} onChange={setSub} items={[["live", "In play"], ["pre", "Pre-match"], ["done", "Completed"]]} />
          </div>
        </PreviewFrame>
        <PreviewFrame title="PillTabs" description="Twin of PillGroup for TabsContent panels." source="components/app/pill-tabs.tsx">
          <PillTabs layoutId="ds-tabs" value={tab} onChange={setTab} tabs={[["log", "Game log"], ["splits", "Splits"], ["hits", "When it hits"]]}>
            <p className="text-callout text-muted-foreground">Active panel: {tab}</p>
          </PillTabs>
        </PreviewFrame>
      </>
    ),

    feedback: (
      <>
        <PreviewFrame title="EmptyState" description="Every empty / unknown / error list." canvasClassName="items-stretch" source="components/app/empty-state.tsx">
          <div className="grid w-full gap-stack md:grid-cols-2">
            <EmptyState title="Nothing saved yet" body="Tap the star on a prop, player or team." action={<Button variant="secondary" className="h-control rounded-full">Browse props</Button>} />
            <EmptyState compact title="No matches" body="Try another format or gender filter." />
          </div>
        </PreviewFrame>
        <PreviewFrame title="Loading skeleton" description="Page-shaped placeholders — never a bare spinner on product lists." canvasClassName="items-stretch">
          <div className="w-full"><RowsSkeleton rows={3} /></div>
        </PreviewFrame>
        <PreviewFrame title="Unknown / error" description="Same EmptyState job with a retry action.">
          <EmptyState compact title="Couldn’t load props" body="Check the connection and try again." action={<Button type="button" variant="secondary" size="sm">Retry</Button>} />
        </PreviewFrame>
        <PreviewFrame title="Note" description="How numbers are worked out — not warnings." source="components/app/note.tsx">
          <Note title="Reading tip" items={["Fair price is 1 ÷ historical hit rate.", "Void and DNP rules stay intact across formats."]} />
        </PreviewFrame>
      </>
    ),

    data: (
      <>
        <PreviewFrame title="PageTitle + Crumbs" description="Drill-in hierarchy on desktop." source="components/app/page.tsx" canvasClassName="items-stretch bg-background">
          <div className="grid w-full gap-snug">
            <Crumbs items={[["Examples"], ["Example"]]} />
            <PageTitle sub="Supporting line in callout muted.">Example page title</PageTitle>
          </div>
        </PreviewFrame>
        <PreviewFrame title="StatTile + Panel" description="Glance figures and titled reference blocks." canvasClassName="items-stretch">
          <div className="grid w-full gap-stack">
            <StatGridCards>
              <StatTile k="Hit rate" v="62%" s="last 10" />
              <StatTile k="Fair" v={<OddsText>1.61</OddsText>} s="1 ÷ hit rate" />
              <StatTile k="Line" v="O 24.5" s="best book 1.90" />
            </StatGridCards>
            <Panel title="Panel"><Muted>Not for bleed stats tables.</Muted></Panel>
          </div>
        </PreviewFrame>
        <PreviewFrame title="ChartBars" description="Last fixtures vs a line — hit / miss / push / DNP / void. Same component as Player and ResultView." canvasClassName="items-stretch bg-card" source="components/app/chart.tsx">
          <div className="w-full min-w-0 py-snug">
            <ChartBars entries={CHART_DEMO} line={28.5} side="over" height={220} animateKey="ds-chart" label="Runs over 28.5" />
          </div>
        </PreviewFrame>
        <PreviewFrame
          id={tableBleedId}
          title={`DataTable bleed (${TABLE_HEAD.includes("footnote") ? "TABLE_HEAD" : "head"})`}
          description="Dense stats: phone edge bleed, label-cap + footnote headers. Product uses TABLE_BLEED (-mx-gutter)."
          canvasClassName="items-stretch bg-background"
          source="components/app/page.tsx"
        >
          <div className="w-full min-w-0">
            <DataTable bleed columns={["Line", "Over", "Fair", "Under"]} rows={[["24.5", "1.90", "1.61", "1.95"], ["25.5", "2.10", "1.85", "1.75"], ["26.5", "2.40", "2.05", "1.55"]]} />
          </div>
        </PreviewFrame>
        <PreviewFrame title="DetailSplit + StickyPanel" description="Desktop detail board: asymmetric chart column + sticky side rail (Lines, game log). Phone stacks." source="components/app/page.tsx" canvasClassName="items-stretch bg-background">
          <DetailSplit className="w-full">
            <section className="flex min-w-0 flex-col gap-snug rounded-lg border border-hairline bg-card p-inset">
              <span className="label-cap text-footnote text-muted-foreground">Primary</span>
              <p className="text-body text-muted-foreground">Chart, meters, books.</p>
            </section>
            <StickyPanel label="Side rail demo" className="lg:static lg:max-h-none">
              <div className="border-b border-hairline px-gutter py-snug lg:px-inset">
                <h3 className="text-body font-emphasis">Lines</h3>
              </div>
              <div className="px-gutter py-snug lg:px-inset">
                <p className="text-callout text-muted-foreground">Sticky panel stacks ladder + dense game log.</p>
              </div>
            </StickyPanel>
          </DetailSplit>
        </PreviewFrame>
        <PreviewFrame title="CardGrid" description="Directory cards: 1 → 2 (md) → 3 (xl). Fancy list." source="components/app/page.tsx" canvasClassName="items-stretch bg-background">
          <CardGrid className="w-full">
            {["Match A", "Match B", "Match C"].map((label) => (
              <div key={label} className="rounded-lg border border-hairline bg-card px-inset py-snug text-body font-label">{label}</div>
            ))}
          </CardGrid>
        </PreviewFrame>
        <PreviewFrame title="TeamBadge sizes" description="xs/sm/md initials use text-caption; lg/xl use callout/title. Flag for tight rows." source="components/app/badges.tsx">
          <div className="flex flex-wrap items-end gap-stack">
            {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
              <div key={size} className="grid justify-items-center gap-hair">
                <TeamBadge name="India" size={size} />
                <code className="label-cap text-caption text-muted-foreground">{size}</code>
              </div>
            ))}
            <div className="grid justify-items-center gap-hair">
              <LeagueBadge name="IPL" size="md" />
              <code className="label-cap text-caption text-muted-foreground">league</code>
            </div>
            <div className="grid justify-items-center gap-hair">
              <TeamFlag name="Australia" />
              <code className="label-cap text-caption text-muted-foreground">flag</code>
            </div>
          </div>
        </PreviewFrame>
        <PreviewFrame title="BookTable" description="Extra books behind +N — face prices stay up front." source="components/app/book-table.tsx" canvasClassName="items-stretch">
          <BookTable books={BOOK_DEMO} shown={["book_a"]} className="w-full" />
        </PreviewFrame>
        <PreviewFrame title="LadderRow" description="Priced line ladder: best book per side, extras via BookTable." source="components/app/line-ladder.tsx" canvasClassName="items-stretch bg-background">
          <div className="w-full min-w-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(TABLE_HEAD, "w-[3rem]")}>Line</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "min-w-0")}>Over</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "min-w-0")}>Under</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "w-[3.75rem]")}>Hit O</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "w-[3.75rem]")}>Hit U</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LADDER_DEMO.map(({ line, books }) => {
                  const priced = pricedFromBooks(line, books);
                  return (
                    <LadderRow
                      key={line}
                      line={line}
                      priced={priced}
                      selected={ladderLine === line}
                      onPick={() => setLadderLine(line)}
                      summary={{ pOver: 0.55, pUnder: 0.45, fairOver: 1.82, fairUnder: 2.22 }}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </PreviewFrame>
      </>
    ),

    forms: (
      <>
        <PreviewFrame title="LiveForm" description="Filters apply as you change them; typed fields debounce." source="components/app/forms.tsx">
          <LiveForm onValues={() => undefined} className="max-w-xl border-0 bg-transparent p-0 shadow-none">
            <Field label="Format"><NativeSelect name="fmt" options={[["T20", "T20"], ["ODI", "ODI"], ["Test", "Test"]]} /></Field>
            <Field label="Line"><Input name="line" type="number" step="0.5" defaultValue="24.5" className="w-28" /></Field>
          </LiveForm>
        </PreviewFrame>
        <PreviewFrame title="Disabled" description="Visible but out of the tab order when using native disabled.">
          <LiveForm onValues={() => undefined} className="max-w-xl border-0 bg-transparent p-0 shadow-none">
            <Field label="Format"><NativeSelect name="fmt-off" disabled options={[["T20", "T20"]]} /></Field>
            <Field label="Line"><Input name="line-off" type="number" disabled defaultValue="24.5" className="w-28" /></Field>
          </LiveForm>
        </PreviewFrame>
        <PreviewFrame title="Invalid" description="Caller sets aria-invalid and a short message.">
          <div className="grid max-w-xl gap-stack">
            <Field label="Line">
              <Input name="line-bad" type="number" step="0.5" defaultValue="0" aria-invalid={lineInvalid} aria-describedby={lineInvalid ? "line-bad-msg" : undefined} className="w-28 aria-invalid:border-destructive" onChange={(e) => setLineInvalid(Number(e.currentTarget.value) <= 0)} />
            </Field>
            {lineInvalid ? <p id="line-bad-msg" className="text-callout text-destructive">Line must be greater than 0.</p> : null}
            <Button type="button" size="sm" variant="secondary" onClick={() => setLineInvalid(true)}>Show invalid</Button>
          </div>
        </PreviewFrame>
      </>
    ),

    icons: (
      <PreviewFrame title="Heroicons in product code" description="Never Lucide under components/app, components/ui, or pages." source="@heroicons/react/24/outline" canvasClassName="items-stretch">
        <ul className="grid w-full gap-snug sm:grid-cols-2">
          {([
            [InformationCircleIcon, "Info", "Tooltips / how-it-works"],
            [BookmarkIcon, "Bookmark", "Save affordance (outline)"],
            [StarIcon, "Star", "Saved / watchlist"],
            [MagnifyingGlassIcon, "Search", "Global search trigger"],
            [ArrowLeftIcon, "Back", "Phone header drill-in"],
          ] as const).map(([Icon, name, job]) => (
            <li key={name} className="flex items-center gap-stack rounded-lg border border-hairline bg-background px-inset py-snug">
              <Icon className="size-6 shrink-0" aria-hidden />
              <span className="grid min-w-0 gap-hair">
                <span className="text-callout font-label">{name}</span>
                <span className="text-footnote text-muted-foreground">{job}</span>
              </span>
            </li>
          ))}
        </ul>
      </PreviewFrame>
    ),

    rules: (
      <>
        <DocPanel id="hard-rules" title="Hard rules">
          <ul className="grid gap-snug text-callout text-muted-foreground">
            <li>All numbers on the site come from the engine / data — never from an LLM.</li>
            <li>Named type and space roles only on GOVERNED files (design-tokens.test.ts).</li>
            <li>Empty lists use EmptyState; tables use TABLE_HEAD + optional bleed.</li>
            <li>Web + app share jobs; native twins when DOM cannot run (Segmented, FlashList, blur).</li>
            <li>Before merge to main: centralize UI in shared components; ask before adding a variant; update the catalogue and <code className="text-foreground">docs/DESIGN_SYSTEM_CHANGELOG.md</code>.</li>
            <li>Docs: <code className="text-foreground">docs/DESIGN_SYSTEM.md</code>, <code className="text-foreground">docs/SITE.md</code>, <code className="text-foreground">.cursor/rules/design-system-centralization.mdc</code>.</li>
          </ul>
        </DocPanel>
        <DocPanel id="changelog" title="Changelog">
          <p className="text-callout text-muted-foreground">
            Component and token history lives in the repo at{" "}
            <code className="text-foreground">docs/DESIGN_SYSTEM_CHANGELOG.md</code>
            {" "}(append-only). Open that file on GitHub or locally to see what changed and which callers to re-check.
          </p>
        </DocPanel>
      </>
    ),
  };

  const brand = tokens.color.primary;
  const articleKey = current?.id ?? (search ? "search" : pathname);

  if (home) return <DesignHome brandColor={brand} groups={GROUPS} topicPath={topicPath} />;

  const prevTopic = index > 0 ? topics[index - 1] : null;
  const nextTopic = index >= 0 && index < topics.length - 1 ? topics[index + 1] : null;

  const articleBody = search
    ? <DesignReference />
    : current
      ? demos[current.id] ?? <DesignReference section={current.id} />
      : null;

  return (
    <DesignDocsShell groups={GROUPS} currentId={current?.id} topicPath={topicPath}>
      <AnimatedHeight>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={articleKey}
            initial={{ opacity: 0, y: reduce ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="min-w-0 pb-section"
          >
            {notFound ? (
              <DocsArticle title="Page not found" lead="That documentation URL is not in the catalogue.">
                <div className="flex flex-wrap gap-snug">
                  <Button asChild variant="secondary" className="h-control rounded-full"><Link to="/">Design system home</Link></Button>
                  <Button asChild variant="outline" className="h-control rounded-full"><Link to="/docs/type">Foundations</Link></Button>
                </div>
              </DocsArticle>
            ) : (
              <DocsArticle
                title={heading}
                lead={blurb}
                group={current?.group ?? (search ? "Reference" : undefined)}
                source={current ? PAGE_SOURCE[current.id] : undefined}
                when={current ? PAGE_WHEN[current.id] : undefined}
                toc={current ? PAGE_TOC[current.id] ?? [] : []}
                pager={current ? {
                  prev: prevTopic ? { to: topicPath(prevTopic.id), label: prevTopic.label, group: prevTopic.group } : null,
                  next: nextTopic ? { to: topicPath(nextTopic.id), label: nextTopic.label, group: nextTopic.group } : null,
                } : undefined}
              >
                {articleBody}
              </DocsArticle>
            )}
          </motion.div>
        </AnimatePresence>
      </AnimatedHeight>
    </DesignDocsShell>
  );
}
