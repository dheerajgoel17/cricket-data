-- Internal edge-bet ledger: every recommended edge we scrape (model value bets + fancy alerts), odds + edge,
-- settled to flat 1u paper P&L. Service role only. Never shown on the site. Rows are never deleted.
create table if not exists public.edge_bets (
  bet_key text primary key,
  kind text not null default 'model'
    check (kind in ('model', 'fancy')),
  match text not null default '',
  start_utc timestamptz,
  format text not null default '',
  gender text not null default '',
  market_type text not null default '',
  market text not null default '',
  selection text not null default '',
  line double precision,
  side text,
  player_id text,
  stat text,
  team text,
  scope text,
  inn int not null default 0,
  best_odds double precision,
  best_source text not null default '',
  effective_odds double precision,
  fair_prob double precision,
  model_prob double precision,
  market_prob double precision,
  edge double precision,
  edge_pct double precision,
  fair_basis text not null default '',
  confidence text not null default '',
  why text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'open'
    check (status in ('open', 'won', 'lost', 'push', 'void', 'unsettled')),
  result_value double precision,
  settled_at timestamptz,
  pnl_u double precision
);
create index if not exists edge_bets_status_start_idx on public.edge_bets (status, start_utc);
create index if not exists edge_bets_player_stat_idx on public.edge_bets (player_id, stat, inn) where player_id is not null;
alter table public.edge_bets enable row level security;
-- no policies for anon / authenticated: service role only (bypasses RLS)
