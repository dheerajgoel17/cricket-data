/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookmarkIcon, ClockIcon, LinkIcon, StarIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { parsePropKey, useCombos, useRecents, useSaved } from "@/lib/saved";
import { setTitle } from "@/lib/title";
import { EmptyState } from "@/components/app/empty-state";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";
import { PlayerName } from "@/components/app/player-name";
import { Button } from "@/components/ui/button";

const CARD = "overflow-hidden rounded-2xl bg-card ring-1 ring-hairline";

function Section({ icon, title, count, emptyTitle, emptyBody, children }: { icon: ReactNode; title: string; count: number; emptyTitle: string; emptyBody: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-snug" aria-label={title}>
      <h2 className="flex items-center gap-tight text-body font-medium">{icon}{title}{count > 0 && <span className="text-callout font-normal tabular-nums text-muted-foreground">{count}</span>}</h2>
      {count ? <ul className={CARD}>{children}</ul> : <EmptyState compact icon={icon} title={emptyTitle} body={emptyBody} />}
    </section>
  );
}

const rowCls = "flex min-h-row items-center gap-snug border-t border-hairline px-inset py-snug first:border-t-0";
const iconBtn = "grid size-(--touch) shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90";

/** Account Saved: watchlist props, players/teams, filter combos (server). Recently viewed stays on this device. */
export function SavedPage() {
  setTitle("Saved");
  const { store } = useData();
  const { user, loading, openSignIn } = useAuth();
  const { list, toggle } = useSaved();
  const { combos, remove } = useCombos();
  const { recents } = useRecents();

  const props = list.map((k) => ({ k, p: parsePropKey(k) })).filter((x): x is { k: string; p: NonNullable<ReturnType<typeof parsePropKey>> } => !!x.p && x.p.idx >= 0 && x.p.idx < store.P.id.length);
  const people = list.filter((k) => k.startsWith("player:") || k.startsWith("team:")).map((k) => {
    const [kind, i] = k.split(":");
    return kind === "player" ? { k, to: `/player/${i}`, name: store.playerName(+i), sub: store.teamName(store.P.tm[+i]), badge: <PlayerBadge idx={+i} /> }
      : { k, to: `/team/${i}`, name: store.teamName(+i), sub: "Team", badge: <TeamBadge name={store.teams[+i].n} /> };
  });
  const seen = recents.filter((k) => k.startsWith("player:")).map((k) => +k.split(":")[1]).filter((i) => i >= 0 && i < store.P.id.length);
  const none = !props.length && !people.length && !combos.length;
  const copy = async (query: string) => { try { await navigator.clipboard.writeText(`${location.origin}/props?${query}`); toast("Link copied"); } catch { toast("Copy failed"); } };

  if (!user) {
    return (
      <div className="flex flex-col gap-group">
        <h1 className="text-title font-bold tracking-tight">Saved</h1>
        <EmptyState
          icon={<StarIcon />}
          title="Sign in to sync Saved"
          body="Create a free account or continue with Google. Your watchlist, players, teams and filters are stored on the server."
        />
        <Button type="button" disabled={loading} className="h-control w-full max-w-xs rounded-full self-center" onClick={openSignIn}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-group">
      <h1 className="text-title font-bold tracking-tight">Saved</h1>
      {none && (
        <EmptyState
          icon={<StarIcon />}
          title="Nothing saved yet"
          body="Tap the star on a prop, player or team, or save a filter combination from Props. They sync to your account."
        />
      )}
      <Section icon={<StarIcon className="size-4" />} title="Watchlist" count={props.length} emptyTitle="No watchlist props" emptyBody="Tap the star on a prop row to track that line here.">
        {props.map(({ k, p }) => (
          <li key={k} className={rowCls}>
            <Link to={`/player/${p.idx}?stat=${p.stat}&line=${p.line}&fmt=${p.fmt}`} className="flex min-w-0 flex-1 items-center gap-snug outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <PlayerBadge idx={p.idx} size="md" className="size-control" />
              <span className="grid min-w-0"><span className="truncate text-body font-medium"><PlayerName idx={p.idx} /></span>
                <span className="truncate text-callout text-muted-foreground"><span className="tabular-nums text-primary">O {p.line}</span> {(STATS as any)[p.stat]?.label ?? p.stat} · {FORMATS[p.fmt] ?? ""}</span></span>
            </Link>
            <button type="button" aria-label="Remove from watchlist" className={iconBtn} onClick={() => toggle(k)}><XMarkIcon className="size-5" /></button>
          </li>
        ))}
      </Section>
      <Section icon={<BookmarkIcon className="size-4" />} title="Filters" count={combos.length} emptyTitle="No saved filters" emptyBody="Open Props, set filters and use Save and share to keep a combination here.">
        {combos.map((c) => (
          <li key={c.name} className={rowCls}>
            <Link to={`/props?${c.query}`} className="grid min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="truncate text-body font-medium">{c.name}</span><span className="truncate text-footnote text-muted-foreground">{c.query.replace(/&/g, " · ")}</span></Link>
            <button type="button" aria-label={`Copy link to ${c.name}`} className={iconBtn} onClick={() => copy(c.query)}><LinkIcon className="size-5" /></button>
            <button type="button" aria-label={`Delete ${c.name}`} className={iconBtn} onClick={() => remove(c.name)}><TrashIcon className="size-5" /></button>
          </li>
        ))}
      </Section>
      <Section icon={<StarIcon className="size-4" />} title="Players and teams" count={people.length} emptyTitle="No saved players or teams" emptyBody="Tap the star on a player or team page to keep it here.">
        {people.map((it) => <li key={it.k} className="border-t border-hairline first:border-t-0"><Link to={it.to} className={`${rowCls} border-t-0`}>{it.badge}<span className="flex-1 truncate text-body font-medium">{it.name}</span><span className="text-callout text-muted-foreground">{it.sub}</span></Link></li>)}
      </Section>
      <Section icon={<ClockIcon className="size-4" />} title="Recently viewed" count={seen.length} emptyTitle="No recent players" emptyBody="Players you open show up here on this device.">
        {seen.map((i) => <li key={i} className="border-t border-hairline first:border-t-0"><Link to={`/player/${i}`} className={`${rowCls} border-t-0`}><PlayerBadge idx={i} size="md" className="size-control" /><span className="flex-1 truncate text-body font-medium">{store.playerName(i)}</span><span className="text-callout text-muted-foreground">{store.teamName(store.P.tm[i])}</span></Link></li>)}
      </Section>
    </div>
  );
}
