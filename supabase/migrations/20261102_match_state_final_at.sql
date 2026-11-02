-- When a match turned final. The site keeps a Test (or first-class match) that has a result for 24 hours after this moment instead of 6 days after it started (engine/lines.js `keepUntil`).
-- Stamped once, on the first write that makes the row final (an upsert of the feed's own word or the clock settling a row the feed dropped), and cleared if the row ever leaves final,
-- so it always names the current final spell. Same function signature and token check as before: the Worker needs no change.
alter table public.match_state add column if not exists final_at timestamptz;

-- Rows already final: updated_at is the nearest thing to the moment (the last write). A row the feed still lists as final is rewritten every minute, so for those it is "now": they leave
-- the lists 24 hours after this migration rather than right away. To expire one sooner by hand: update public.match_state set final_at = '<when it ended>' where match_key = '<key>';
update public.match_state set final_at = updated_at where phase = 'final' and final_at is null;

create or replace function public.apply_match_state(token text, upserts jsonb default '[]'::jsonb, phases jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ok boolean; n_up int := 0; n_ph int := 0;
begin
  select exists (select 1 from private.match_state_writer w where w.token_hash = encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.match_state as m (match_key, a, b, fmt, series, venue, start_utc, phase, session, summary, scores, updated_at, final_at)
  select r.match_key, r.a, r.b, coalesce(r.fmt, ''), coalesce(r.series, ''), coalesce(r.venue, ''), r.start_utc, r.phase, coalesce(r.session, ''), coalesce(r.summary, ''), coalesce(r.scores, '[]'::jsonb), now(),
    case when r.phase = 'final' then now() end
  from jsonb_to_recordset(upserts) as r(match_key text, a text, b text, fmt text, series text, venue text, start_utc timestamptz, phase text, session text, summary text, scores jsonb)
  on conflict (match_key) do update set a = excluded.a, b = excluded.b, fmt = excluded.fmt, series = excluded.series, venue = excluded.venue, start_utc = excluded.start_utc,
    phase = excluded.phase, session = excluded.session, summary = excluded.summary, scores = excluded.scores, updated_at = now(),
    final_at = case when excluded.phase = 'final' then coalesce(m.final_at, now()) end;
  get diagnostics n_up = row_count;
  update public.match_state m set phase = p.phase, updated_at = now(), final_at = case when p.phase = 'final' then coalesce(m.final_at, now()) end
  from jsonb_to_recordset(phases) as p(match_key text, phase text) where m.match_key = p.match_key and p.phase in ('upcoming', 'live', 'final');
  get diagnostics n_ph = row_count;
  return jsonb_build_object('upserted', n_up, 'phased', n_ph);
end $$;
revoke all on function public.apply_match_state(text, jsonb, jsonb) from public;
grant execute on function public.apply_match_state(text, jsonb, jsonb) to anon;
