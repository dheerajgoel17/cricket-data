-- Account profiles and server-side Saved (watchlist keys + filter combos). Auth is Supabase Auth; RLS keeps each user to their own rows.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint saved_items_key_len check (char_length(key) between 1 and 120)
);

create table if not exists public.saved_combos (
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  query text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, name),
  constraint saved_combos_name_len check (char_length(name) between 1 and 40),
  constraint saved_combos_query_len check (char_length(query) between 1 and 500)
);

create index if not exists saved_items_user_idx on public.saved_items (user_id);
create index if not exists saved_combos_user_idx on public.saved_combos (user_id);

alter table public.profiles enable row level security;
alter table public.saved_items enable row level security;
alter table public.saved_combos enable row level security;

create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);

create policy "saved_items select own" on public.saved_items for select using (auth.uid() = user_id);
create policy "saved_items insert own" on public.saved_items for insert with check (auth.uid() = user_id);
create policy "saved_items delete own" on public.saved_items for delete using (auth.uid() = user_id);

create policy "saved_combos select own" on public.saved_combos for select using (auth.uid() = user_id);
create policy "saved_combos insert own" on public.saved_combos for insert with check (auth.uid() = user_id);
create policy "saved_combos update own" on public.saved_combos for update using (auth.uid() = user_id);
create policy "saved_combos delete own" on public.saved_combos for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
