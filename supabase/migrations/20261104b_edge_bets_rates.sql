-- Full market-rate snapshot on each recommended edge (internal ledger only).
alter table public.edge_bets
  add column if not exists fair_odds double precision,
  add column if not exists lay_odds double precision,
  add column if not exists back_liquidity double precision,
  add column if not exists overround double precision,
  add column if not exists implied_prob double precision,
  add column if not exists notes text not null default '',
  add column if not exists hits int,
  add column if not exists played int,
  add column if not exists sample_window int,
  add column if not exists rates jsonb not null default '{}'::jsonb;
