import { useState, type ComponentProps } from "react";
import tokens from "@cricket/tokens/tokens.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import inventory from "./inventory.generated.json";

export const referenceSections = [
  ["token-reference", "Token reference"],
  ["component-registry", "Component registry"],
  ["patterns", "Patterns"],
  ["platforms", "Platforms"],
] as const;

const entries = Object.entries(tokens).filter(([, values]) => typeof values === "object" && values !== null).flatMap(([group, values]) =>
  Object.entries(values).map(([name, value]) => ({ group, name, value: String(value) })),
);

function Copy({ value }: { value: string }) {
  const [status, setStatus] = useState("");
  return <span className="inline-flex items-center gap-tight">
    <Button size="xs" variant="outline" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setStatus("Copied"); }
      catch { setStatus("Copy unavailable"); }
    }}>Copy</Button>
    <span role="status" className="text-footnote">{status}</span>
  </span>;
}

const variants = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const satisfies readonly ComponentProps<typeof Button>["variant"][];
const sizes = ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const satisfies readonly ComponentProps<typeof Button>["size"][];

function ButtonSpec() {
  const [variant, setVariant] = useState<(typeof variants)[number]>("default");
  const [size, setSize] = useState<(typeof sizes)[number]>("default");
  const [disabled, setDisabled] = useState(false);
  const icon = size.startsWith("icon");
  const code = `import { Button } from "@/components/ui/button";\n\n<Button variant="${variant}" size="${size}"${disabled ? " disabled" : ""}${icon ? ' aria-label="Add filter"' : ""}>${icon ? '<span aria-hidden>+</span>' : "Add filter"}</Button>`;
  return <div className="grid gap-stack">
    <p>Use Button for an action. Use a link for navigation. On native, compose Press with the relevant text and surface styles.</p>
    <div className="flex flex-wrap items-end gap-stack">
      <label className="grid gap-tight">Variant<select value={variant} onChange={(e) => setVariant(variants[e.currentTarget.selectedIndex])}>{variants.map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className="grid gap-tight">Size<select value={size} onChange={(e) => setSize(sizes[e.currentTarget.selectedIndex])}>{sizes.map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className="flex items-center gap-tight"><input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.currentTarget.checked)} /> Disabled</label>
      <Button type="button" variant={variant} size={size} disabled={disabled} aria-label={icon ? "Add filter" : undefined}>{icon ? <span aria-hidden>+</span> : "Add filter"}</Button>
    </div>
    <div className="rounded-xl border border-hairline p-inset"><code>Button root → label or icon</code><p className="text-callout text-muted-foreground">The root provides the surface, padding, and focus ring. An SVG child uses the size recipe. Default, xs, sm, and lg are 36, 24, 32, and 40 CSS px at a 16 px root. Icon variants use square dimensions.</p></div>
    <p>Tab to focus, then activate with Enter or Space. Give icon-only controls an accessible name. Disabled controls are removed from the tab order. <code>asChild</code> delegates semantics to the child. Loading requires a caller-managed state.</p>
    <pre className="overflow-x-auto rounded-xl bg-card p-inset text-footnote">{code}</pre><Copy value={code} />
  </div>;
}

const patterns = [
  ["Authentication", "Sign-in sheet → email form → callback → session → Saved", "Keep the current screen behind sign-in and restore focus after dismissing.", "site/src/components/app/sign-in-sheet.tsx · mobile/src/ui/sign-in-sheet.tsx"],
  ["Search", "Search trigger → query → grouped results → entity route", "Give the field an accessible name and preserve a clear no-results state.", "site/src/components/layout/GlobalSearch.tsx · mobile/src/app/search.tsx"],
  ["Filtering and sorting", "Filters → draft selection → Apply → filtered rows", "Keep the current selection visible. Offer a reset when filters exclude all results.", "site/src/components/app/screener-filters.tsx · mobile/src/ui/screener-filters.tsx"],
  ["Loading, refresh and errors", "Cold fetch → shaped skeleton → content, empty state, or error", "Keep cached content visible during refresh. Reserve retry for failures and distinguish failures from valid empty results.", "site/src/components/app/hot-home.tsx · mobile/src/ui/motion.tsx"],
  ["Player research", "Player and market → line and window → chart → splits, when it hits, game log", "Keep the line and sample context visible when switching sections.", "site/src/pages/Player.tsx · mobile/src/app/player/[idx].tsx"],
  ["Live data", "Snapshot → current standing → row → Tick on change", "Keep a readable value when motion is reduced. Avoid moving the layout around changing numbers.", "site/src/components/app/tick.tsx · mobile/src/ui/tick.tsx"],
  ["Responsive tables", "Page gutter → bleed wrapper → table headers and rows", "Use semantic web headers and preserve numeric alignment. Native uses flex columns and platform scrolling.", "site/src/components/app/page.tsx · mobile/src/ui/data-table.tsx"],
  ["Mobile interactions", "Screen → segmented control or sheet → selection → content", "Keep affordances and dismissal behavior native. Use safe-area insets for bottom controls.", "mobile/src/ui/segmented.ios.tsx · mobile/src/ui/insets.ts"],
] as const;

export function TypographyReference() {
  const scale = Object.entries(tokens.type).filter(([name]) => /^fs-[a-z]+$/.test(name));
  const values: Record<string, string> = tokens.type;
  const [wrap, setWrap] = useState(true);
  return <div className="grid min-w-0 gap-stack">
    <DataTable columns={["Size token", "CSS size", "Line height", "Tracking"]} rows={scale.map(([name, size]) => [
      name, size, values[name + "-lh"] ?? "Inherited", values[name + "-ls"] ?? "Inherited",
    ])} />
    <label className="flex items-center gap-tight"><input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.currentTarget.checked)} /> Wrap specimen</label>
    <p className={wrap ? "max-w-xs text-body" : "max-w-xs truncate text-body"}>Player props and historical hit rates across the last ten matches.</p>
    <p className="text-callout text-muted-foreground">Type size and weight are separate roles. Web display can use a fluid clamp. Native resolves shared rem sizes through its token module and applies width-based fitting. Read the full name in the entity view when a compact row truncates it.</p>
    <div className="grid gap-tight">
      <p className="label-cap text-caption text-muted-foreground">font-sans-stack</p>
      <pre className="overflow-x-auto rounded-xl border border-hairline bg-muted/60 p-inset text-footnote leading-relaxed text-foreground">
        <code>{tokens.font["font-sans-stack"]}</code>
      </pre>
      <Copy value={tokens.font["font-sans-stack"]} />
    </div>
  </div>;
}

export function DesignReference({ section }: { section?: string } = {}) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const match = (...parts: string[]) => query.trim().toLowerCase().split(/\s+/).every((term) => parts.join(" ").toLowerCase().includes(term));
  const modules = inventory.filter((item) =>
    (platform === "all" || item.platform === platform || (item.platform === "native" && ["ios", "android"].includes(platform))) &&
    match(item.path, ...item.exports),
  );
  const foundTokens = entries.filter(({ group, name, value }) => match(group, name, value));
  const foundPatterns = patterns.filter((entry) => match(...entry));
  const noHits = query.trim() !== "" && foundTokens.length === 0 && modules.length === 0 && foundPatterns.length === 0;
  return <div className="grid min-w-0 gap-section">
    <label className="grid gap-tight font-label">Search reference
      <div className="flex flex-wrap items-center gap-snug">
        <Input type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder="Search token, component, screen, or pattern" className="max-w-xl" />
        {query.trim() ? <Button type="button" size="sm" variant="ghost" onClick={() => setQuery("")}>Clear</Button> : null}
      </div>
    </label>
    <p role="status" className="text-callout text-muted-foreground">{foundTokens.length} tokens · {modules.length} source modules · {foundPatterns.length} patterns</p>
    {noHits && <EmptyState compact title="No matches" body="Try another token name, module path, or pattern keyword." action={<Button type="button" size="sm" variant="secondary" onClick={() => setQuery("")}>Clear search</Button>} />}

    {(!section || section === "token-reference") && <section id="token-reference" className="grid min-w-0 scroll-mt-32 gap-stack">
      <h2 className="text-display font-emphasis">Token reference</h2>
      <p className="text-callout text-muted-foreground">Values come from tokens.json. Web exposes CSS variables and utilities. Native resolves the shared values through its token module.</p>
      {Object.keys(tokens).map((group) => {
        const rows = foundTokens.filter((token) => token.group === group);
        return rows.length > 0 && <details key={group} open={query.trim() ? true : undefined} className="rounded-xl border border-hairline p-inset">
          <summary className="cursor-pointer text-title font-label capitalize">{group} ({rows.length})</summary>
          <dl className="divide-y divide-hairline">{rows.map(({ name, value }) => <div key={name} className="grid gap-tight py-snug sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0"><dt className="break-all font-label">{name}</dt><dd className="break-words font-mono text-footnote text-muted-foreground">{value}</dd></div>
            <Copy value={name + ": " + value} />
          </div>)}</dl>
        </details>;
      })}
    </section>}

    {(!section || section === "component-registry") && <section id="component-registry" className="grid min-w-0 scroll-mt-32 gap-stack">
      <h2 className="text-display font-emphasis">Component and screen registry</h2>
      <label className="flex items-center gap-snug">Platform<select value={platform} onChange={(e) => setPlatform(e.currentTarget.value)}>
        <option value="all">All platforms</option><option value="web">Web</option><option value="ios">iOS</option><option value="android">Android</option>
      </select></label>
      <p className="text-callout text-muted-foreground">Indexed entries show source and direct UI imports. A source entry is not a complete component spec.</p>
      {modules.map(({ path, exports, platform: target, route, dependencies }) => <details key={path} className="rounded-xl border border-hairline p-inset">
        <summary className="cursor-pointer break-words text-callout font-label">{exports.join(", ") || path.split("/").at(-1)} <span className="font-copy text-muted-foreground">· {target} · {route ? "Screen" : path.endsWith("/button.tsx") ? "Interactive spec" : "Indexed"}</span></summary>
        <div className="grid gap-snug pt-snug">
          <code className="break-all text-footnote">{path}</code>
          {dependencies.length > 0 && <p className="break-words text-footnote text-muted-foreground">Direct UI imports: {dependencies.join(", ")}</p>}
          {path === "site/src/components/ui/button.tsx" && <ButtonSpec />}
        </div>
      </details>)}
      {!modules.length && <EmptyState compact title="No source modules match" body="Adjust the search or platform filter." />}
    </section>}

    {(!section || section === "patterns") && <section id="patterns" className="grid scroll-mt-32 gap-stack">
      <h2 className="text-display font-emphasis">Patterns</h2>
      {foundPatterns.map(([title, flow, guide, source]) => <section key={title} className="grid gap-snug rounded-xl border border-hairline p-inset">
        <h3 className="text-title font-label">{title}</h3><p className="text-primary">{flow}</p><p>{guide}</p><code className="break-words text-footnote text-muted-foreground">{source}</code>
      </section>)}
      {!foundPatterns.length && <EmptyState compact title="No patterns match" body="Try another keyword, or clear the search." />}
    </section>}

    {(!section || section === "platforms") && <section id="platforms" className="grid min-w-0 scroll-mt-32 gap-stack">
      <h2 className="text-display font-emphasis">Platforms</h2>
      <p>Shared JSON supplies semantic colors, type, and spacing. CSS generates the web variables. Native converts the shared dimensions into text and layout styles, with platform-specific controls.</p>
      <DataTable columns={["Job", "Web", "iOS / Android", "Contract"]} rows={[
        ["Section selection", "PillTabs", "Segmented", "Selection and typography"],
        ["Data table", "DataTable", "DataTable", "Alignment, spacing, bleed"],
        ["Loading", "Skeletons", "Working and skeletons", "Shape and reduced motion"],
        ["Navigation", "Shell and IosTabBar", "Expo tabs / floating tab bar", "Destinations and semantic color"],
        ["Actions", "Button", "Press-based controls", "Accessible labels and feedback"],
      ]} />
    </section>}
  </div>;
}
