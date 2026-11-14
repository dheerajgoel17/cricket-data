import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolvePlayerLabel } from "@cricket/engine/player-label.js";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data";
import { flagUrl, leagueLogos, playerPhotos, teamLogos } from "@/lib/assets";
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
      {!ready && <span aria-hidden className="absolute inset-0 animate-pulse bg-hairline" />}
      <img ref={(el) => { if (el?.complete && el.naturalWidth && !ready) { loaded.add(url); setReady(true); } }} src={url} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async"
        className={cn(className, "transition-opacity duration-200", ready ? "opacity-100" : "opacity-0")} onLoad={() => { loaded.add(url); setReady(true); }} onError={() => setI((n) => n + 1)} />
    </>
  );
}

const SIZES = { xs: "size-5 text-caption", sm: "size-6 text-caption", md: "size-9 text-caption", lg: "size-12 text-callout", xl: "size-16 text-title" } as const;
export type BadgeSize = keyof typeof SIZES;

const Circle = ({ size, className, children, title }: { size: BadgeSize; className?: string; children: React.ReactNode; title?: string }) => (
  <span data-slot="avatar" title={title} className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border bg-secondary font-emphasis text-muted-foreground", SIZES[size], className)}>{children}</span>
);

/**
 * Team crest: Source A logo when we know the team, else a flag, else initials.
 * `bare`: the logo alone (no circle) so the full crest shows — use in MatchChip / AvatarGroup.
 * Default is the round badge used on fixture cards and rows.
 */
export function TeamBadge({ name, size = "sm", className, eager, bare }: { name: string; size?: BadgeSize; className?: string; eager?: boolean; bare?: boolean }) {
  const { photos } = useData();
  const urls = [...teamLogos(photos, name), flagUrl(name, size === "xl" || size === "lg" ? 160 : 40)].filter(Boolean) as string[];
  if (bare) {
    return (
      <span title={name} className={cn("relative inline-grid shrink-0 place-items-center", SIZES[size], className)}>
        <Img eager={eager} urls={urls} alt={name} className="size-full object-contain" fallback={<span className="text-[length:inherit] font-emphasis text-muted-foreground">{initials(name)}</span>} />
      </span>
    );
  }
  return <Circle size={size} className={cn("border-0 bg-secondary", className)} title={name}><Img eager={eager} urls={urls} alt={name} className="size-full object-contain p-0.5" fallback={initials(name)} /></Circle>;
}

const AVATAR_SIZE = { xs: "sm", sm: "sm", md: "default", lg: "lg", xl: "lg" } as const;

/** shadcn Avatar for AvatarGroup (hashtags): one root, image fills it, initials as fallback — no nested Circle. */
export function TeamAvatar({ name, size = "sm", eager }: { name: string; size?: BadgeSize; eager?: boolean }) {
  const { photos } = useData();
  const urls = [...teamLogos(photos, name), flagUrl(name, size === "xl" || size === "lg" ? 160 : 40)].filter(Boolean) as string[];
  const [i, setI] = useState(0);
  const url = urls[i];
  return (
    <Avatar size={AVATAR_SIZE[size]} title={name} className={cn("bg-secondary", size === "xs" && "size-5")}>
      {url ? <AvatarImage src={url} alt={name} loading={eager ? "eager" : "lazy"} className="size-full object-contain p-0.5" onError={() => setI((n) => n + 1)} /> : null}
      <AvatarFallback className="bg-secondary text-caption font-emphasis">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Round league badge: the source's logo for the league's newest season, else the league's initials ("IPL"). */
export function LeagueBadge({ name, size = "md", className }: { name: string; size?: BadgeSize; className?: string }) {
  const { photos } = useData();
  return (
    <Circle size={size} className={cn("border-0", className)} title={name}>
      <Img urls={leagueLogos(photos, name) as string[]} alt={name} className="size-full object-contain p-0.5" fallback={initials(name)} />
    </Circle>
  );
}

/** Flat (unrounded) team flag for tight rows: the national flag when there is one, else the Source A logo, else the initials; the name goes in the tooltip. */
export function TeamFlag({ name, className }: { name: string; className?: string }) {
  const { photos } = useData();
  const flag = flagUrl(name, 80);
  const urls = [flag, ...teamLogos(photos, name)].filter(Boolean) as string[];
  return (
    <span title={name} className={cn("relative inline-grid h-4 w-6 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-transparent text-caption font-emphasis text-muted-foreground", className)}>
      <Img eager urls={urls} alt={name} className="size-full object-cover" fallback={initials(name)} />
    </span>
  );
}

const Silhouette = () => <svg viewBox="0 0 40 40" aria-hidden className="size-3/4 -translate-y-[7%] fill-current text-muted-foreground/50"><circle cx="20" cy="15" r="7" /><path d="M5 40c1-9 7-14 15-14s14 5 15 14z" /></svg>;

/** Avatar for a player index: photo when we have one, silhouette otherwise. */
export function PlayerBadge({ idx, size = "sm", className }: { idx: number; size?: BadgeSize; className?: string }) {
  const { store, photos, names } = useData();
  const pid = store.P.id[idx];
  const label = resolvePlayerLabel(store.playerName(idx), { catalogName: names?.[pid] });
  const urls = playerPhotos(photos, pid) as string[];
  return <Circle size={size} className={className} title={label}><Img urls={urls} alt={label} className="size-full object-cover" fallback={<Silhouette />} /></Circle>;
}

/** The hero photo: top-aligned crop, no circle (like props.cash). */
/** `contain`: show the whole picture (bottom-aligned) instead of cropping it to fill the box: the source avatars are head-and-shoulders, nearly square. */
export function PlayerPhoto({ idx, className, contain }: { idx: number; className?: string; contain?: boolean }) {
  const { store, photos, names } = useData();
  const pid = store.P.id[idx];
  const label = resolvePlayerLabel(store.playerName(idx), { catalogName: names?.[pid] });
  const urls = playerPhotos(photos, pid) as string[];
  return <div className={cn("relative grid place-items-end overflow-hidden", className)}><Img urls={urls} alt={label} className={contain ? "size-full object-contain object-bottom" : "size-full object-cover object-top"} fallback={<Silhouette />} /></div>;
}

/** Preload the primary flag/logo of each team so rows that mount later show them without a shimmer. */
export function usePreloadTeams(names: string[]) {
  const { photos } = useData();
  const key = names.join("|");
  useEffect(() => { preloadImages(names.flatMap((n) => { const logo = teamLogos(photos, n)[0]; return logo ? [logo] : [flagUrl(n, 40), flagUrl(n, 160), flagUrl(n, 80)]; })); }, [key, photos]); // eslint-disable-line react-hooks/exhaustive-deps
}
