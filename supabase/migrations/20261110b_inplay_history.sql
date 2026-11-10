-- Private history. The workflow uses the service role for uploads and reads.
insert into storage.buckets (id, name, public)
values ('inplay-history', 'inplay-history', false)
on conflict (id) do nothing;
