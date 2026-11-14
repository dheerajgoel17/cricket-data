import { useEffect, useState, type ReactNode } from "react";
import { BookmarkIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import tokens from "@cricket/tokens/tokens.json";
import { ActiveChip, Chip } from "@/components/app/chip";
import { EmptyState } from "@/components/app/empty-state";
import { Field, LiveForm, NativeSelect } from "@/components/app/forms";
import { Note } from "@/components/app/note";
import { Crumbs, DataTable, Muted, OddsText, PageTitle, Panel, StatGridCards, StatTile, TABLE_BLEED, TABLE_HEAD } from "@/components/app/page";
import { PillGroup } from "@/components/app/pill-group";
import { PillTabs } from "@/components/app/pill-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setTitle } from "@/lib/title";
import { cn } from "@/lib/utils";

/** In-page sections for the living design-system catalogue (designers + engineers). */
const SECTIONS: [string, string][] = [
  ["intro", "Overview"],
  ["color", "Colour"],
  ["type", "Typography"],
  ["space", "Space & size"],
  ["motion", "Motion"],
  ["buttons", "Buttons"],
  ["chips", "Chips & tabs"],
  ["feedback", "Empty & notes"],
  ["data", "Data & metrics"],
  ["forms", "Forms"],
  ["icons", "Icons"],
  ["rules", "Rules"],
];

function Spec({ title, job, children }: { title: string; job?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-stack rounded-2xl bg-surface ring-1 ring-hairline p-inset">
      <header className="flex flex-col gap-hair">
        <h3 className="text-title font-medium tracking-tight">{title}</h3>
        {job ? <p className="text-callout text-muted-foreground">{job}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  const isColor = value.startsWith("#") || value.startsWith("rgba") || value.startsWith("rgb");
  return (
    <div className="flex min-w-0 flex-col gap-tight overflow-hidden rounded-xl ring-1 ring-hairline">
      <div className="aspect-[5/3] w-full" style={isColor ? { background: value } : { background: "var(--surface-raised)" }} aria-hidden />
      <div className="flex flex-col gap-hair px-snug py-tight">
        <span className="truncate text-callout font-medium text-foreground">{name}</span>
        <code className="truncate text-footnote text-muted-foreground">{value}</code>
      </div>
    </div>
  );
}

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

/**
 * Living design-system catalogue at `/design-system`: tokens, type, space, and product
 * component variants for designers and engineers. noindex; not in the sitemap.
 */
export function DesignSystemPage() {
  setTitle("Design system");
  const [pill, setPill] = useState("t20");
  const [seg, setSeg] = useState("over");
  const [sub, setSub] = useState("live");
  const [tab, setTab] = useState("log");
  const [chipOn, setChipOn] = useState(true);

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
  }, []);

  const colors = Object.entries(tokens.color).filter(([, v]) => typeof v === "string" && (String(v).startsWith("#") || String(v).startsWith("rgba")));
  const spaces = Object.entries(tokens.space);
  const sizes = Object.entries(tokens.size).filter(([k]) => ["control", "gutter", "row-min", "card-radius", "chip-radius", "header-h", "touch"].includes(k));

  return (
    <div className="flex flex-col gap-section lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-group">
      <nav aria-label="Design system sections" className="sticky top-[calc(var(--header-h)+0.5rem)] z-10 -mx-gutter overflow-x-auto border-b border-hairline bg-background/90 px-gutter py-snug backdrop-blur-md lg:mx-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="flex flex-col gap-snug">
        <p className="hidden label-cap text-footnote text-muted-foreground lg:block">On this page</p>
        <ul className="flex gap-snug lg:flex-col lg:gap-tight">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex h-control items-center whitespace-nowrap rounded-full px-snug text-callout text-muted-foreground hover:bg-secondary hover:text-foreground lg:h-auto lg:rounded-md lg:px-snug lg:py-tight">
                {label}
              </a>
            </li>
          ))}
        </ul>
        </div>
      </nav>

      <div className="flex min-w-0 flex-col gap-section">
        <div id="intro" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <Crumbs items={[["Home", "/"], ["Design system"]]} />
          <PageTitle sub="Living catalogue of Fancy.cash tokens and product components. Same contract as the iOS / Android app. Source: packages/tokens + docs/DESIGN_SYSTEM.md.">
            Design system
          </PageTitle>
          <div className="flex flex-wrap gap-hair">
            {["Dark only", "Free MIT", "Heroicons", "Decimal odds", "Web + App"].map((x) => (
              <Badge key={x} variant="secondary" className="rounded-full px-snug py-tight font-normal">{x}</Badge>
            ))}
          </div>
          <Note
            title="How to use this page"
            items={[
              "Pick a job first (empty list, dense table, filter chip), then the component.",
              "Edit tokens in site/packages/tokens/tokens.json, then npm run tokens.",
              "Product code uses named roles (text-body, gap-stack) — never raw text-sm / gap-4.",
              "App twins live in mobile/src/ui with the same jobs and token names.",
            ]}
          />
        </div>

        <div id="color" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Colour</h2>
          <Muted>Semantic tokens from tokens.json. Prefer primary for positive / selected, miss for under, amber for push / caution.</Muted>
          <div className="grid grid-cols-2 gap-snug sm:grid-cols-3 md:grid-cols-4">
            {colors.map(([name, value]) => <Swatch key={name} name={name} value={String(value)} />)}
          </div>
        </div>

        <div id="type" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Typography</h2>
          <Muted>Satoshi for UI. Barlow Condensed for scoreboard figures (num-cond / label-cap).</Muted>
          <Panel title="Type scale">
            <TypeRow role="display" sample="Harry Brook" className="text-display font-medium tracking-tight" />
            <TypeRow role="title" sample="Player props" className="text-title font-medium tracking-tight" />
            <TypeRow role="body" sample="Hit rates over the listed line, last ten games." className="text-body" />
            <TypeRow role="callout" sample="Void when in the XI but did not bat." className="text-callout text-muted-foreground" />
            <TypeRow role="footnote" sample="n 24 · median 42 · fair 1.85" className="text-footnote text-muted-foreground" />
            <TypeRow role="caption" sample="label-cap uppercase" className="label-cap text-caption text-muted-foreground" />
            <TypeRow role="stat" sample="1.92" className="text-stat font-medium tabular-nums" />
            <TypeRow role="metric" sample="O 24.5" className="text-metric font-condensed tabular-nums" />
            <TypeRow role="num-cond" sample="67 · 4/12 · fair 1.48" className="font-condensed text-title tabular-nums text-primary" />
          </Panel>
        </div>

        <div id="space" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Space &amp; size</h2>
          <Muted>Stacks and gaps use hair / tight / snug / stack / group / section. Controls are --control tall.</Muted>
          <Spec title="Spacing scale" job="Parent flex/grid gap — do not margin blocks yourself.">
            <div className="flex flex-col gap-snug">
              {spaces.map(([name, rem]) => <SpaceBar key={name} name={name.replace("space-", "")} rem={String(rem)} />)}
            </div>
          </Spec>
          <Spec title="Layout sizes" job="Touch targets, gutters, radii from tokens.size.">
            <div className="grid grid-cols-2 gap-snug sm:grid-cols-3">
              {sizes.map(([k, v]) => (
                <Card key={k} className="gap-hair px-inset py-snug shadow-none">
                  <code className="text-footnote text-muted-foreground">{k}</code>
                  <p className="text-callout font-medium">{String(v)}</p>
                </Card>
              ))}
            </div>
          </Spec>
        </div>

        <div id="motion" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Motion</h2>
          <Muted>Curves from tokens.motion. Prefer ease-out for entrances; respect prefers-reduced-motion.</Muted>
          <div className="grid gap-snug sm:grid-cols-3">
            {Object.entries(tokens.motion).map(([k, v]) => (
              <Card key={k} className="gap-hair px-inset py-snug shadow-none">
                <code className="text-footnote text-muted-foreground">{k}</code>
                <p className="break-all text-callout">{String(v)}</p>
              </Card>
            ))}
          </div>
        </div>

        <div id="buttons" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Buttons</h2>
          <Spec title="Button variants" job="Primary actions; product CTAs often use h-control rounded-full secondary/primary.">
            <div className="flex flex-wrap items-center gap-snug">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
              <Button variant="secondary" className="h-control rounded-full">Pill control</Button>
            </div>
          </Spec>
          <Spec title="Badge" job="Quiet status chips; secondary for metadata.">
            <div className="flex flex-wrap gap-snug">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge className="bg-primary/15 text-primary">Primary wash</Badge>
            </div>
          </Spec>
        </div>

        <div id="chips" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Chips &amp; tabs</h2>
          <Spec title="Chip + ActiveChip" job="Single selectable filter; dismissible applied filter.">
            <div className="flex flex-wrap items-center gap-snug">
              <Chip on={chipOn} onClick={() => setChipOn((v) => !v)}>Runs</Chip>
              <Chip on={!chipOn} onClick={() => setChipOn((v) => !v)}>Wickets</Chip>
              <ActiveChip label="Format" value="T20" onRemove={() => undefined} />
            </div>
          </Spec>
          <Spec title="PillGroup — default" job="Parent filters; selected = primary fill.">
            <PillGroup layoutId="ds-pill" label="Format" value={pill} onChange={setPill} items={[["t20", "T20"], ["odi", "ODI"], ["test", "Test"]]} />
          </Spec>
          <Spec title="PillGroup — segmented" job="Raised thumb in a track (Over / Under).">
            <PillGroup segmented layoutId="ds-seg" label="Side" value={seg} onChange={setSeg} items={[["over", "Over"], ["under", "Under"]]} />
          </Spec>
          <Spec title="PillGroup — sub" job="Quiet underline row (home phase / scope). Put hairline on the parent.">
            <div className="border-b border-hairline">
              <PillGroup sub layoutId="ds-sub" label="Phase" value={sub} onChange={setSub} items={[["live", "In play"], ["pre", "Pre-match"], ["done", "Completed"]]} />
            </div>
          </Spec>
          <Spec title="PillTabs" job="Documented twin of PillGroup for TabsContent panels (league / team markets).">
            <PillTabs layoutId="ds-tabs" value={tab} onChange={setTab} tabs={[["log", "Game log"], ["splits", "Splits"], ["hits", "When it hits"]]}>
              <p className="text-callout text-muted-foreground">Active panel: {tab}</p>
            </PillTabs>
          </Spec>
        </div>

        <div id="feedback" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Empty states &amp; notes</h2>
          <Spec title="EmptyState" job="Every empty / unknown / error list. Prefer titled EmptyState over plain text.">
            <div className="grid gap-stack md:grid-cols-2">
              <EmptyState title="Nothing saved yet" body="Tap the star on a prop, player or team." action={<Button variant="secondary" className="h-control rounded-full">Browse props</Button>} />
              <EmptyState compact title="No matches" body="Try another format or gender filter." />
            </div>
          </Spec>
          <Spec title="Note" job="How these numbers are worked out — not warnings.">
            <Note title="Reading tip" items={["Fair price is 1 ÷ historical hit rate.", "Void and DNP rules stay intact across formats."]} />
          </Spec>
        </div>

        <div id="data" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Data &amp; metrics</h2>
          <Spec title="PageTitle + Crumbs" job="Drill-in hierarchy on desktop; phone often uses HeaderActions.">
            <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Example"]]} />
            <PageTitle sub="Supporting line in callout muted.">Example page title</PageTitle>
          </Spec>
          <Spec title="StatTile + Panel" job="Glance figures and titled cards.">
            <StatGridCards>
              <StatTile k="Hit rate" v="62%" s="last 10" />
              <StatTile k="Fair" v={<OddsText>1.61</OddsText>} s="1 ÷ hit rate" />
              <StatTile k="Line" v="O 24.5" s="best book 1.90" />
            </StatGridCards>
            <Panel title="Panel">
              <Muted>Card with a hairline under the title. Use for reference blocks — not around bleed stats tables.</Muted>
            </Panel>
          </Spec>
          <Spec title={`DataTable bleed (${TABLE_HEAD.includes("footnote") ? "TABLE_HEAD" : "head"})`} job="Dense stats: phone edge bleed, label-cap + footnote headers.">
            <div className={TABLE_BLEED}>
              <DataTable
                bleed
                columns={["Line", "Over", "Fair", "Under"]}
                rows={[
                  ["24.5", "1.90", "1.61", "1.95"],
                  ["25.5", "2.10", "1.85", "1.75"],
                  ["26.5", "2.40", "2.05", "1.55"],
                ]}
              />
            </div>
          </Spec>
        </div>

        <div id="forms" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Forms</h2>
          <Spec title="LiveForm + Field + NativeSelect" job="Filters apply as you change them; typed fields debounce.">
            <LiveForm onValues={() => undefined} className="max-w-xl">
              <Field label="Format"><NativeSelect name="fmt" options={[["T20", "T20"], ["ODI", "ODI"], ["Test", "Test"]]} /></Field>
              <Field label="Line"><Input name="line" type="number" step="0.5" defaultValue="24.5" className="w-28" /></Field>
            </LiveForm>
          </Spec>
        </div>

        <div id="icons" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Icons</h2>
          <Spec title="Heroicons in product code" job="Never Lucide under components/app or pages. shadcn ui/* may still ship CLI Lucide until edited.">
            <div className="flex items-center gap-stack text-foreground">
              <InformationCircleIcon className="size-6" aria-hidden />
              <BookmarkIcon className="size-6" aria-hidden />
              <span className="text-callout text-muted-foreground">@heroicons/react/24/outline (and /solid for filled)</span>
            </div>
          </Spec>
        </div>

        <div id="rules" className="flex scroll-mt-[calc(var(--header-h)+var(--space-stack))] flex-col gap-stack">
          <h2 className="text-display font-medium tracking-tight">Rules</h2>
          <Panel title="Hard rules">
            <ul className="grid gap-snug text-callout text-muted-foreground">
              <li>All numbers on the site come from the engine / data — never from an LLM.</li>
              <li>Named type and space roles only on GOVERNED files (design-tokens.test.ts).</li>
              <li>Empty lists use EmptyState; tables use TABLE_HEAD + optional bleed.</li>
              <li>Web + app share jobs; native twins when DOM cannot run (Segmented, FlashList, blur).</li>
              <li>Docs: <code className="text-foreground">docs/DESIGN_SYSTEM.md</code>, <code className="text-foreground">docs/SITE.md</code>.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
