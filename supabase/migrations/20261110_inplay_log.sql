-- The in-play line log: every in-play line the price feed and the other books list, written only when a line first appears or its price moves (site/scripts/inplay-log.mjs,
-- run by the in-play snapshot job with the service key), each with the match's score at that moment. DATA ONLY, for later statistical grading:
-- settlement (book_lines.json, the archive), the site and the apps never read it. Append-only for good: no job or script updates or deletes a row (a trigger refuses it too), retention is forever.
-- RLS is on with no policy, so anon and authenticated can neither read nor write; only the service role (which bypasses RLS) can.
create table if not exists public.inplay_log (
  id bigint generated always as identity primary key,
  at timestamptz not null,                 -- when the line was read (the snapshot round)
  -- the match (self-contained rows: the same facts on every row of a match)
  match_key text not null,                 -- "<sorted team keys>@<kickoff>", fixed by the first row of the match
  pair text not null,                      -- the two sides, sorted ("india|australia"), for the read-back and for grouping
  home text not null,
  away text not null,
  league text not null default '',
  kickoff timestamptz,
  fmt text,                                -- T20 / ODI / Test / ... from the live score, null when the match was not matched to it
  -- the line
  book text not null,                      -- the book's published name
  kind text not null check (kind in ('player_runs', 'team_runs', 'ou', 'pick')),
  market text not null,                    -- the market's name as the book lists it ("M Rahim Innings Runs", "Runs in First 20 Overs", "Method of Dismissal 6-Way")
  subject text,                            -- the batter (player_runs) or the side (team_runs), as the book spells it
  line_key text not null,                  -- book|kind|market-or-subject|innings|line, the identity a change is detected on
  inn smallint,                            -- innings scope: the batter's own side's current innings (a Test: 1 or 2), or the side's innings of a team_runs line
  line numeric,                            -- null for a pick
  over_price numeric,
  under_price numeric,
  outcomes jsonb,                          -- pick: [{label, price, sub?}]
  -- the score at that moment (from the live scores; all null when the match was not found there)
  score_at timestamptz,                    -- as-of of the live score read (up to about a minute behind `at`)
  cur_inn smallint,                        -- the match's current innings number
  bat_team text,
  runs int,
  wkts smallint,
  overs numeric,                           -- 12.3 = 12 overs 3 balls
  inn_balls int,                           -- the same in balls
  b_runs int,                              -- a batter line: his runs and balls so far in that innings
  b_balls int,
  session text,                            -- Stumps / Lunch / Rain delay / ...
  ctx jsonb                                -- display, status, summary, crr, rrr, partnership
);
alter table public.inplay_log enable row level security;
revoke all on public.inplay_log from anon, authenticated;

-- a line read once per round: the writer is idempotent (insert ... on conflict do nothing); the same index serves one match's time series per line
create unique index if not exists inplay_log_line_idx on public.inplay_log (match_key, line_key, at);
create index if not exists inplay_log_pair_idx on public.inplay_log (pair, at desc);      -- the writer's read-back of the latest value per line
create index if not exists inplay_log_subject_idx on public.inplay_log (subject, at);     -- one batter or side across matches
create index if not exists inplay_log_at_brin on public.inplay_log using brin (at);        -- time ranges, a few kB however big the table grows

-- append-only: updates, deletes and truncates are refused, not just not done. (Dropping the trigger is a deliberate maintainer act, never a job's.)
create or replace function public.inplay_log_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'inplay_log is append-only (% refused)', tg_op;
end;
$$;
drop trigger if exists inplay_log_no_change on public.inplay_log;
create trigger inplay_log_no_change before update or delete on public.inplay_log for each row execute function public.inplay_log_append_only();
drop trigger if exists inplay_log_no_truncate on public.inplay_log;
create trigger inplay_log_no_truncate before truncate on public.inplay_log for each statement execute function public.inplay_log_append_only();

-- The latest logged value of every line of the given sides since a time: what the writer compares against so a repeated read writes nothing (called with the service key only).
create or replace function public.inplay_log_latest(p_pairs text[], p_since timestamptz)
returns table (match_key text, pair text, kickoff timestamptz, line_key text, over_price numeric, under_price numeric, outcomes jsonb)
language sql stable as $$
  select distinct on (l.match_key, l.line_key) l.match_key, l.pair, l.kickoff, l.line_key, l.over_price, l.under_price, l.outcomes
  from public.inplay_log l
  where l.pair = any (p_pairs) and l.at >= p_since
  order by l.match_key, l.line_key, l.at desc
$$;
revoke execute on function public.inplay_log_latest(text[], timestamptz) from public, anon, authenticated;
grant execute on function public.inplay_log_latest(text[], timestamptz) to service_role;
