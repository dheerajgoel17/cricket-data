-- One row per match with one phase (upcoming / live / final), written by scripts/state-sync.mjs (service key) and read by api/state.js (public read).
create table if not exists public.match_state (
  match_key text primary key,
  a text not null, b text not null, fmt text not null default '', series text not null default '', venue text not null default '',
  start_utc timestamptz not null,
  phase text not null check (phase in ('upcoming', 'live', 'final')),
  session text not null default '', summary text not null default '',
  scores jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists match_state_phase_start_idx on public.match_state (phase, start_utc);
alter table public.match_state enable row level security;
create policy "public read match_state" on public.match_state for select using (true);
-- writes: service role only (no insert/update/delete policy for anon or authenticated)
