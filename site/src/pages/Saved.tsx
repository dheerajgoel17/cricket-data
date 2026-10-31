/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookmarkIcon, ClockIcon, LinkIcon, StarIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useData } from "@/lib/data";
import { parsePropKey, useCombos, useRecents, useSaved } from "@/lib/saved";
import { setTitle } from "@/lib/title";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";
import { PlayerName } from "@/components/app/player-name";

const CARD = "overflow-hidden rounded-2xl bg-card ring-1 ring-hairline";

function Section({ icon, title, count, empty, children }: { icon: ReactNode; title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-snug" aria-label={title}>
      <h2 className="flex items-center gap-tight text-body font-semibold">{icon}{title}{count > 0 && <span className="text-callout font-normal tabular-nums text-muted-foreground">{count}</span>}</h2>
      {count ? <ul className={CARD}>{children}</ul> : <p className="rounded-2xl bg-surface p-inset text-callout text-muted-foreground ring-1 ring-hairline">{empty}</p>}
    </section>
  );
}

const rowCls = "flex min-h-row items-center gap-snug border-t border-hairline px-inset py-snug first:border-t-0";
const iconBtn = "grid size-(--touch) shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90";

/** Everything kept on this device (no account): watchlist props, saved players and teams, saved filter combinations and recently opened players. */
export function SavedPage() {
  setTitle("Saved");
  const { store } = useData();
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

  return (
    <div className="flex flex-col gap-group">
      <h1 className="text-title font-bold tracking-tight">Saved</h1>
      {none && (
        <p className="rounded-2xl bg-surface p-inset text-callout text-muted-foreground ring-1 ring-hairline">
          Nothing saved yet. Tap the star on a prop row to watch it, the star on a player or team page to keep it, or save a filter combination from the Props filters.
          Everything stays on this device: there is no account.
        </p>
      )}
      <Section icon={<StarIcon className="size-4" />} title="Watchlist" count={props.length} empty="Tap the star on a prop row to track that line here.">
        {props.map(({ k, p }) => (
          <li key={k} className={rowCls}>
            <Link to={`/player/${p.idx}?stat=${p.stat}&line=${p.line}&fmt=${p.fmt}`} className="flex min-w-0 flex-1 items-center gap-snug outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <PlayerBadge idx={p.idx} size="md" className="size-control" />
              <span className="grid min-w-0"><span className="truncate text-body font-semibold"><PlayerName idx={p.idx} /></span>
                <span className="truncate text-callout text-muted-foreground"><span className="tabular-nums text-primary">O {p.line}</span> {(STATS as any)[p.stat]?.label ?? p.stat} · {FORMATS[p.fmt] ?? ""}</span></span>
            </Link>
            <button type="button" aria-label="Remove from watchlist" className={iconBtn} onClick={() => toggle(k)}><XMarkIcon className="size-5" /></button>
          </li>
        ))}
      </Section>
      <Section icon={<BookmarkIcon className="size-4" />} title="Filters" count={combos.length} empty="Open Props, set filters and use Save and share to keep a combination here.">
        {combos.map((c) => (
          <li key={c.name} className={rowCls}>
            <Link to={`/props?${c.query}`} className="grid min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="truncate text-body font-semibold">{c.name}</span><span className="truncate text-footnote text-muted-foreground">{c.query.replace(/&/g, " · ")}</span></Link>
            <button type="button" aria-label={`Copy link to ${c.name}`} className={iconBtn} onClick={() => copy(c.query)}><LinkIcon className="size-5" /></button>
            <button type="button" aria-label={`Delete ${c.name}`} className={iconBtn} onClick={() => remove(c.name)}><TrashIcon className="size-5" /></button>
          </li>
        ))}
      </Section>
      <Section icon={<StarIcon className="size-4" />} title="Players and teams" count={people.length} empty="Tap the star on a player or team page to keep it here.">
        {people.map((it) => <li key={it.k} className="border-t border-hairline first:border-t-0"><Link to={it.to} className={`${rowCls} border-t-0`}>{it.badge}<span className="flex-1 truncate text-body font-semibold">{it.name}</span><span className="text-callout text-muted-foreground">{it.sub}</span></Link></li>)}
      </Section>
      <Section icon={<ClockIcon className="size-4" />} title="Recently viewed" count={seen.length} empty="Players you open show up here.">
        {seen.map((i) => <li key={i} className="border-t border-hairline first:border-t-0"><Link to={`/player/${i}`} className={`${rowCls} border-t-0`}><PlayerBadge idx={i} size="md" className="size-control" /><span className="flex-1 truncate text-body font-semibold">{store.playerName(i)}</span><span className="text-callout text-muted-foreground">{store.teamName(store.P.tm[i])}</span></Link></li>)}
      </Section>
    </div>
  );
}
