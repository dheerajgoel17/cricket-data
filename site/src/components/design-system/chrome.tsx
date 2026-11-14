import { Link, NavLink } from "react-router-dom";
import { ArrowRightIcon, BookOpenIcon, CircleStackIcon, MagnifyingGlassIcon, Squares2X2Icon, SwatchIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

const links = [
  { title: "Foundations", detail: "Typography, colour, spacing, and motion.", to: "/docs/type", Icon: SwatchIcon },
  { title: "Components", detail: "Explore live components and their variants.", to: "/docs/buttons", Icon: Squares2X2Icon },
  { title: "Patterns", detail: "Research, filtering, and live data flows.", to: "/docs/patterns", Icon: BookOpenIcon },
  { title: "Resources", detail: "Find web and native implementations.", to: "/docs/component-registry", Icon: CircleStackIcon },
];

function DesignBrand() {
  return <Link to="/" className="inline-flex items-center gap-snug font-emphasis">
    <img src="/icon-192.png" alt="" width="36" height="36" className="rounded-lg" />
    <span>Fancy.cash <span className="font-copy opacity-75">Design</span></span>
  </Link>;
}

export function DesignHeader() {
  return <header className="flex flex-wrap items-center justify-between gap-stack border-b border-hairline py-stack">
    <DesignBrand />
    <nav aria-label="Primary" className="flex flex-wrap items-center gap-snug">
      {links.slice(0, 2).map(({ to, title }) => <NavLink key={to} to={to} className="rounded-lg px-snug py-tight font-label hover:bg-secondary aria-[current=page]:bg-secondary">{title}</NavLink>)}
      <Button asChild variant="outline"><NavLink to="/search"><MagnifyingGlassIcon aria-hidden /> Search</NavLink></Button>
    </nav>
  </header>;
}

export function DesignFooter() {
  return <footer className="grid gap-group rounded-2xl bg-[#10251b] p-group text-white sm:grid-cols-[1fr_auto] sm:items-center">
    <div className="grid justify-items-start gap-snug">
      <DesignBrand />
      <a href="https://fancy.cash/" className="text-callout text-white/80 underline underline-offset-4">Visit Fancy.cash</a>
    </div>
    <nav aria-label="Footer" className="flex flex-wrap gap-stack">
      {links.map(({ to, title }) => <Link key={to} to={to} className="text-callout text-white/85 hover:underline">{title}</Link>)}
    </nav>
  </footer>;
}

export function DesignHome({ brandColor }: { brandColor: string }) {
  return <>
    <section style={{ backgroundColor: brandColor }} className="grid items-center gap-section rounded-2xl p-group text-[#10251b] sm:p-section lg:grid-cols-[1.2fr_1fr] lg:p-12">
      <div className="grid justify-items-start gap-group">
        <h1 className="max-w-[12ch] text-[clamp(2.65rem,7vw,6rem)] leading-[0.94] font-emphasis tracking-[-0.055em]">Fancy.cash design system</h1>
        <p className="max-w-[42ch] text-title">The tokens, components, and patterns behind Fancy.cash on web, iOS, and Android.</p>
        <Button asChild className="bg-[#10251b] text-white hover:bg-[#203e30]"><Link to="/docs/type">Explore foundations <ArrowRightIcon aria-hidden /></Link></Button>
      </div>
      <figure className="grid gap-stack rounded-xl bg-[#10251b] p-group text-white">
        <figcaption className="text-callout font-label text-white/75">Scoreboard typography specimen</figcaption>
        <div className="flex flex-wrap items-baseline justify-between gap-snug">
          <span className="font-condensed text-[clamp(3.5rem,8vw,7rem)] leading-none font-emphasis tabular-nums">172/4</span>
          <span style={{ color: brandColor }} className="font-condensed text-title tabular-nums">18.2 overs</span>
        </div>
      </figure>
    </section>
    <nav aria-label="Explore documentation" className="grid gap-snug sm:grid-cols-2 lg:grid-cols-4">
      {links.map(({ title, detail, to, Icon }) => <Link key={to} to={to} className="group grid gap-stack rounded-xl border border-hairline bg-surface p-inset hover:bg-secondary">
        <span className="flex items-center justify-between gap-snug text-primary"><Icon className="size-6" aria-hidden /><ArrowRightIcon className="size-4" aria-hidden /></span>
        <span className="grid gap-hair"><span className="text-title font-emphasis">{title}</span><span className="text-callout text-muted-foreground">{detail}</span></span>
      </Link>)}
    </nav>
  </>;
}
