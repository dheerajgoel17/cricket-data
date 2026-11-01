-- Alerts already sent to the channel, so each goes out once. Written by the match-state Worker through claim_alerts / release_alerts only: it holds the public key and the same write
-- token as apply_match_state (private.match_state_writer), so no new secret. No policy on the table: the public key can neither read nor write it directly.
create table if not exists public.alert_sent (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.alert_sent enable row level security;

-- Marks the keys as sent and returns the ones that were new (a key already there is not returned). With dry = true nothing is written. Keys older than 30 days are dropped on the way:
-- a line is only ever announced while its match is on (a Test: six days), so an older key can never come back.
create or replace function public.claim_alerts(token text, keys jsonb, dry boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ok boolean; fresh jsonb;
begin
  select exists (select 1 from private.match_state_writer w where w.token_hash = encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  if dry then
    select coalesce(jsonb_agg(k), '[]'::jsonb) into fresh
    from (select distinct k from jsonb_array_elements_text(keys) as t(k) where not exists (select 1 from public.alert_sent s where s.key = t.k)) n;
    return fresh;
  end if;
  delete from public.alert_sent where sent_at < now() - interval '30 days';
  with ins as (
    insert into public.alert_sent (key) select distinct k from jsonb_array_elements_text(keys) as t(k) on conflict (key) do nothing returning key
  )
  select coalesce(jsonb_agg(key), '[]'::jsonb) into fresh from ins;
  return fresh;
end $$;
revoke all on function public.claim_alerts(text, jsonb, boolean) from public;
grant execute on function public.claim_alerts(text, jsonb, boolean) to anon;

-- Gives keys back (a post that failed) so the next run tries them again.
create or replace function public.release_alerts(token text, keys jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ok boolean; n int;
begin
  select exists (select 1 from private.match_state_writer w where w.token_hash = encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.alert_sent s where s.key in (select jsonb_array_elements_text(keys));
  get diagnostics n = row_count;
  return jsonb_build_object('released', n);
end $$;
revoke all on function public.release_alerts(text, jsonb) from public;
grant execute on function public.release_alerts(text, jsonb) to anon;
