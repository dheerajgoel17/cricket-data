-- Our own copy of player photos / team logos and the CREX id maps (applied to the cricket-props-hub Supabase project).
create table if not exists public.crex_players (
  crex_id text primary key, name text not null, cricsheet_id text,
  source text not null default 'crex-sitemap', updated_at timestamptz not null default now());
create index if not exists crex_players_cricsheet_idx on public.crex_players (cricsheet_id);
create table if not exists public.crex_teams (
  crex_id text primary key, name text not null, folded_name text not null, updated_at timestamptz not null default now());
create table if not exists public.assets (
  kind text not null check (kind in ('player', 'team')), ref text not null, path text not null, content_type text, bytes integer,
  sha256 text, source_url text, fetched_at timestamptz not null default now(), primary key (kind, ref));
alter table public.crex_players enable row level security;
alter table public.crex_teams enable row level security;
alter table public.assets enable row level security;
create policy "public read crex_players" on public.crex_players for select using (true);
create policy "public read crex_teams" on public.crex_teams for select using (true);
create policy "public read assets" on public.assets for select using (true);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 204800, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 204800, allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg'];
