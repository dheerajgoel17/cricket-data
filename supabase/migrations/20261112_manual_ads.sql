-- Manual ads: admin membership, placements, public creatives bucket.
-- Passwords stay in Supabase Auth; ad_admins is membership only.
-- Bootstrap the first admin in the SQL editor (service role):
--   insert into public.ad_admins (user_id, email) values ('<auth.users.id>', 'you@example.com');

create table if not exists public.ad_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create unique index if not exists ad_admins_email_idx on public.ad_admins (lower(email));

create or replace function public.is_ad_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ad_admins where user_id = auth.uid());
$$;

revoke all on function public.is_ad_admin() from public;
grant execute on function public.is_ad_admin() to anon, authenticated;

create table if not exists public.ad_slots (
  id text primary key,
  label text not null,
  size_note text not null,
  path_hint text not null
);

insert into public.ad_slots (id, label, size_note, path_hint) values
  ('fancy_detail_top', 'Match Fancy detail top strip', 'Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).', '/fixture/:id/fancy'),
  ('stats_top', 'Stats pages top strip', 'Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).', '/leagues, /league/:id, /competitions, /teams, /team/:id, /venue/:id, /players, /glossary, /about')
on conflict (id) do update set label = excluded.label, size_note = excluded.size_note, path_hint = excluded.path_hint;

create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  slot_id text not null references public.ad_slots (id) on delete restrict,
  name text not null,
  href text not null,
  image_path text not null,
  alt text not null default '',
  enabled boolean not null default true,
  priority int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_placements_name_len check (char_length(name) between 1 and 80),
  constraint ad_placements_href_len check (char_length(href) between 1 and 2000),
  constraint ad_placements_image_len check (char_length(image_path) between 1 and 500),
  constraint ad_placements_alt_len check (char_length(alt) <= 120),
  constraint ad_placements_href_http check (href ~* '^https?://')
);

create index if not exists ad_placements_slot_idx on public.ad_placements (slot_id, enabled, priority desc);

create or replace function public.ad_placements_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ad_placements_touch on public.ad_placements;
create trigger ad_placements_touch before update on public.ad_placements
  for each row execute function public.ad_placements_touch();

alter table public.ad_admins enable row level security;
alter table public.ad_slots enable row level security;
alter table public.ad_placements enable row level security;

create policy "ad_slots public read" on public.ad_slots for select using (true);

create policy "ad_admins select if admin" on public.ad_admins for select using (public.is_ad_admin());
create policy "ad_admins insert if admin" on public.ad_admins for insert with check (public.is_ad_admin());
create policy "ad_admins delete if admin" on public.ad_admins for delete using (public.is_ad_admin());

-- Public only sees enabled placements inside their optional schedule window.
create policy "ad_placements public read active" on public.ad_placements for select using (
  enabled
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);
create policy "ad_placements admin read all" on public.ad_placements for select using (public.is_ad_admin());
create policy "ad_placements admin insert" on public.ad_placements for insert with check (public.is_ad_admin());
create policy "ad_placements admin update" on public.ad_placements for update using (public.is_ad_admin());
create policy "ad_placements admin delete" on public.ad_placements for delete using (public.is_ad_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-creatives', 'ad-creatives', true, 2097152, array['image/gif', 'image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/gif', 'image/png', 'image/webp', 'image/jpeg'];

drop policy if exists "ad creatives public read" on storage.objects;
create policy "ad creatives public read" on storage.objects
  for select using (bucket_id = 'ad-creatives');

drop policy if exists "ad creatives admin insert" on storage.objects;
create policy "ad creatives admin insert" on storage.objects
  for insert with check (bucket_id = 'ad-creatives' and public.is_ad_admin());

drop policy if exists "ad creatives admin update" on storage.objects;
create policy "ad creatives admin update" on storage.objects
  for update using (bucket_id = 'ad-creatives' and public.is_ad_admin());

drop policy if exists "ad creatives admin delete" on storage.objects;
create policy "ad creatives admin delete" on storage.objects
  for delete using (bucket_id = 'ad-creatives' and public.is_ad_admin());
