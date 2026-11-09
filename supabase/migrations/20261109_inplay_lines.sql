-- The latest in-play lines the price feed lists (one row), written every few seconds while a match is on by site/scripts/inplay-snapshot.mjs (service key, from a GitHub run)
-- and read by api/inplay.js (public read). Nothing is kept: each write replaces the row, and the pre-match files and the archive never see it.
create table if not exists public.inplay_lines (
  id int primary key default 1 check (id = 1),
  as_of timestamptz not null default now(),
  body jsonb not null default '{"matches":[]}'::jsonb
);
alter table public.inplay_lines enable row level security;
create policy "public read inplay_lines" on public.inplay_lines for select using (true);
-- writes: service role only (no insert/update/delete policy for anon or authenticated)
