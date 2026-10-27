import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data";
import { flagUrl, playerPhotos, teamLogos } from "@/lib/assets";
import { initials } from "@/lib/format";

const loaded = new Set<string>(); // URLs already decoded this session: they render instantly, with no shimmer or re-fade
const requested = new Set<string>();
/** Start fetching images before they are on screen (the first URL of each list is the one that normally wins). */
export function preloadImages(urls: (string | null | undefined)[]) {
  for (const u of urls) if (u && !requested.has(u)) { requested.add(u); const i = new Image(); i.decoding = "async"; i.onload = () => loaded.add(u); i.src = u; }
}

/** Image with a fallback chain and a calm load: a shimmer fills the (fixed-size) parent until the image arrives, then it fades in; `fallback` shows only when every URL fails. Parent must be `relative`. */
function Img({ urls, alt, fallback, className, eager }: { urls: string[]; alt: string; fallback: React.ReactNode; className?: string; eager?: boolean }) {
  const [i, setI] = useState(0);
  const url = urls[i];
  const [ready, setReady] = useState(() => !!url && loaded.has(url));
  useEffect(() => { setReady(!!url && loaded.has(url)); }, [url]);
  if (!url) return <>{fallback}</>;
  return (
    <>
      {!ready && <span aria-hidden className="absolute inset-0 animate-pulse bg-white/[0.07]" />}
      <img ref={(el) => { if (el?.complete && el.naturalWidth && !ready) { loaded.add(url); setReady(true); } }} src={url} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async"
        className={cn(className, "transition-opacity duration-200", ready ? "opacity-100" : "opacity-0")} onLoad={() => { loaded.add(url); setReady(true); }} onError={() => setI((n) => n + 1)} />
    </>
  );
}

const SIZES = { xs: "size-5 text-[8px]", sm: "size-6 text-[9px]", md: "size-9 text-[10px]", lg: "size-12 text-callout", xl: "size-16 text-title" } as const;
export type BadgeSize = keyof typeof SIZES;

const Circle = ({ size, className, children, title }: { size: BadgeSize; className?: string; children: React.ReactNode; title?: string }) => (
  <span title={title} className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border bg-secondary font-bold text-muted-foreground", SIZES[size], className)}>{children}</span>
);

/** Round team badge: CREX logo when we know the team, else a flag, else initials. */
export function TeamBadge({ name, size = "sm", className, eager }: { name: string; size?: BadgeSize; className?: string; eager?: boolean }) {
  const { photos } = useData();
  const urls = [...teamLogos(photos, name), flagUrl(name, size === "xl" || size === "lg" ? 160 : 40)].filter(Boolean) as string[];
  return <Circle size={size} className={cn("border-0 bg-transparent", className)} title={name}><Img eager={eager} urls={urls} alt={name} className="size-full object-cover" fallback={initials(name)} /></Circle>;
}

/** Flat (unrounded) team flag for tight rows: the national flag when there is one, else the CREX logo, else the initials; the name goes in the tooltip. */
export function TeamFlag({ name, className }: { name: string; className?: string }) {
  const { photos } = useData();
  const flag = flagUrl(name, 80);
  const urls = [flag, ...teamLogos(photos, name)].filter(Boolean) as string[];
  return (
    <span title={name} className={cn("relative inline-grid h-4 w-6 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-transparent text-[8px] font-bold text-muted-foreground", className)}>
      <Img eager urls={urls} alt={name} className="size-full object-cover" fallback={initials(name)} />
    </span>
  );
}

const Silhouette = () => <svg viewBox="0 0 40 40" aria-hidden className="mt-[14%] size-3/4 fill-current text-muted-foreground/50"><circle cx="20" cy="15" r="7" /><path d="M5 40c1-9 7-14 15-14s14 5 15 14z" /></svg>;

/** Avatar for a player index: photo when we have one, silhouette otherwise. */
export function PlayerBadge({ idx, size = "sm", className }: { idx: number; size?: BadgeSize; className?: string }) {
  const { store, photos } = useData();
  const urls = playerPhotos(photos, store.P.id[idx]) as string[];
  return <Circle size={size} className={className} title={store.playerName(idx)}><Img urls={urls} alt={store.playerName(idx)} className="size-full object-cover" fallback={<Silhouette />} /></Circle>;
}

/** The hero photo: top-aligned crop, no circle (like props.cash). */
export function PlayerPhoto({ idx, className }: { idx: number; className?: string }) {
  const { store, photos } = useData();
  const urls = playerPhotos(photos, store.P.id[idx]) as string[];
  return <div className={cn("relative grid place-items-end overflow-hidden", className)}><Img urls={urls} alt={store.playerName(idx)} className="size-full object-cover object-top" fallback={<Silhouette />} /></div>;
}

/** Preload the primary flag/logo of each team so rows that mount later show them without a shimmer. */
export function usePreloadTeams(names: string[]) {
  const { photos } = useData();
  const key = names.join("|");
  useEffect(() => { preloadImages(names.flatMap((n) => { const logo = teamLogos(photos, n)[0]; return logo ? [logo] : [flagUrl(n, 40), flagUrl(n, 160), flagUrl(n, 80)]; })); }, [key, photos]); // eslint-disable-line react-hooks/exhaustive-deps
}
