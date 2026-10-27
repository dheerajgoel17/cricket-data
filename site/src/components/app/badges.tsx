import { useState } from "react";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data";
import { flagUrl, playerPhotos, teamLogos } from "@/lib/assets";
import { initials } from "@/lib/format";

/** Image with a fallback chain: tries each URL in turn, then renders `fallback`. */
function Img({ urls, alt, fallback, className }: { urls: string[]; alt: string; fallback: React.ReactNode; className?: string }) {
  const [i, setI] = useState(0);
  if (i >= urls.length) return <>{fallback}</>;
  return <img src={urls[i]} alt={alt} loading="lazy" className={className} onError={() => setI(i + 1)} />;
}

const SIZES = { xs: "size-5 text-[8px]", sm: "size-7 text-[10px]", md: "size-10 text-xs", lg: "size-16 text-lg", xl: "size-24 text-2xl" } as const;
export type BadgeSize = keyof typeof SIZES;

const Circle = ({ size, className, children, title }: { size: BadgeSize; className?: string; children: React.ReactNode; title?: string }) => (
  <span title={title} className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-full border bg-secondary font-bold text-muted-foreground", SIZES[size], className)}>{children}</span>
);

/** Round team badge: CREX logo when we know the team, else a flag, else initials. */
export function TeamBadge({ name, size = "sm", className }: { name: string; size?: BadgeSize; className?: string }) {
  const { photos } = useData();
  const urls = [...teamLogos(photos, name), flagUrl(name, size === "xl" || size === "lg" ? 160 : 40)].filter(Boolean) as string[];
  return <Circle size={size} className={className}><Img urls={urls} alt="" className="size-full object-cover" fallback={initials(name)} /></Circle>;
}

/** Flat (unrounded) team flag for tight rows: the national flag when there is one, else the CREX logo, else the initials; the name goes in the tooltip. */
export function TeamFlag({ name, className }: { name: string; className?: string }) {
  const { photos } = useData();
  const flag = flagUrl(name, 80);
  const urls = [flag, ...teamLogos(photos, name)].filter(Boolean) as string[];
  return (
    <span title={name} className={cn("inline-grid h-4 w-6 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-secondary text-[8px] font-bold text-muted-foreground ring-1 ring-inset ring-white/10", className)}>
      <Img urls={urls} alt={name} className="size-full object-cover" fallback={initials(name)} />
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
  return <div className={cn("grid place-items-end overflow-hidden", className)}><Img urls={urls} alt={store.playerName(idx)} className="size-full object-cover object-top" fallback={<Silhouette />} /></div>;
}
