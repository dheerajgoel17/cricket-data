-- Saved syncs with an upsert (insert ... on conflict do update). Without an update policy, saving an item that already exists on the server is rejected by RLS.
-- Keep each user to their own rows: the row must be theirs before and after the update.
drop policy if exists "saved_items update own" on public.saved_items;
create policy "saved_items update own" on public.saved_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
