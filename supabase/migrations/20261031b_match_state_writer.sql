-- The match-state writer does not hold the service key: it calls apply_match_state(token, ...) with the public key and a random write token whose SHA-256 is the only
-- thing stored (private.match_state_writer, not exposed through the API). The function is the only way to write public.match_state with that key.
create schema if not exists private;
create table if not exists private.match_state_writer (id int primary key default 1 check (id = 1), token_hash text not null);
alter table private.match_state_writer enable row level security;
revoke all on schema private from anon, authenticated;
revoke all on private.match_state_writer from anon, authenticated;

create or replace function public.apply_match_state(token text, upserts jsonb default '[]'::jsonb, phases jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ok boolean; n_up int := 0; n_ph int := 0;
begin
  select exists (select 1 from private.match_state_writer w where w.token_hash = encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.match_state as m (match_key, a, b, fmt, series, venue, start_utc, phase, session, summary, scores, updated_at)
  select r.match_key, r.a, r.b, coalesce(r.fmt, ''), coalesce(r.series, ''), coalesce(r.venue, ''), r.start_utc, r.phase, coalesce(r.session, ''), coalesce(r.summary, ''), coalesce(r.scores, '[]'::jsonb), now()
  from jsonb_to_recordset(upserts) as r(match_key text, a text, b text, fmt text, series text, venue text, start_utc timestamptz, phase text, session text, summary text, scores jsonb)
  on conflict (match_key) do update set a = excluded.a, b = excluded.b, fmt = excluded.fmt, series = excluded.series, venue = excluded.venue, start_utc = excluded.start_utc,
    phase = excluded.phase, session = excluded.session, summary = excluded.summary, scores = excluded.scores, updated_at = now();
  get diagnostics n_up = row_count;
  update public.match_state m set phase = p.phase, updated_at = now()
  from jsonb_to_recordset(phases) as p(match_key text, phase text) where m.match_key = p.match_key and p.phase in ('upcoming', 'live', 'final');
  get diagnostics n_ph = row_count;
  return jsonb_build_object('upserted', n_up, 'phased', n_ph);
end $$;
revoke all on function public.apply_match_state(text, jsonb, jsonb) from public;
grant execute on function public.apply_match_state(text, jsonb, jsonb) to anon;
