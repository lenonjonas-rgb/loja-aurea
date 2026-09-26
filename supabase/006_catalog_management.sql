create table if not exists public.sizes (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  product_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sizes enable row level security;
alter table public.categories enable row level security;
alter table public.banners enable row level security;

create policy "Sizes are public" on public.sizes for select using (true);
create policy "Admins manage sizes" on public.sizes for all using (public.is_admin()) with check (public.is_admin());
create policy "Categories are public" on public.categories for select using (true);
create policy "Admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "Active banners are public" on public.banners for select using (active = true or public.is_admin());
create policy "Admins manage banners" on public.banners for all using (public.is_admin()) with check (public.is_admin());