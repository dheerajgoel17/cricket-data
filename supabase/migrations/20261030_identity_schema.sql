-- Who is who: live/scorecard/book names -> Cricsheet id, and CREX fixtures with format.
-- Hand-checked CSV is the source of truth; hourly assets_sync upserts so a new alias is live
-- without guessing at click time. Public read, service-key write (same as crex_players / assets).
create table if not exists public.player_names (
  folded text not null,
  raw text not null,
  cricsheet_id text not null,
  gender smallint,
  team text not null default '',
  source text not null default 'csv',
  updated_at timestamptz not null default now(),
  primary key (folded, team, cricsheet_id)
);
create index if not exists player_names_id_idx on public.player_names (cricsheet_id);
create index if not exists player_names_folded_idx on public.player_names (folded);

create table if not exists public.fixture_identity (
  id text primary key,
  team_a text not null,
  team_b text not null,
  a_key text not null,
  b_key text not null,
  fmt text not null,
  gender text not null default 'male',
  start_utc timestamptz not null,
  source text not null default 'crex',
  updated_at timestamptz not null default now()
);
create index if not exists fixture_identity_sides_idx on public.fixture_identity (a_key, b_key, start_utc);

alter table public.player_names enable row level security;
alter table public.fixture_identity enable row level security;
create policy "public read player_names" on public.player_names for select using (true);
create policy "public read fixture_identity" on public.fixture_identity for select using (true);
