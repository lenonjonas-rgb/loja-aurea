insert into public.categories (name)
select distinct trim(category)
from public.products
where category is not null and trim(category) <> ''
on conflict (name) do nothing;

insert into public.sizes (name)
select distinct trim(split_size.name)
from public.sizes existing
cross join lateral regexp_split_to_table(existing.name, ',') as split_size(name)
where trim(split_size.name) <> ''
on conflict (name) do nothing;

delete from public.sizes where name like '%,%';

create table if not exists public.supplies (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  unit text not null default 'unidade',
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_supplies (
  product_id uuid not null references public.products(id) on delete cascade,
  supply_id uuid not null references public.supplies(id) on delete restrict,
  quantity_per_product numeric(10, 3) not null default 1 check (quantity_per_product >= 0),
  primary key (product_id, supply_id)
);

create table if not exists public.store_expenses (
  id uuid primary key default uuid_generate_v4(),
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.state_tax_rates (
  state char(2) primary key,
  rate_percent numeric(6, 3) not null check (rate_percent >= 0 and rate_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.state_tax_rates add column if not exists created_at timestamptz not null default now();

alter table public.orders add column if not exists shipping_state char(2);
alter table public.orders add column if not exists tax_rate_percent numeric(6, 3);
alter table public.orders add column if not exists tax_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists shipping_cost numeric(12, 2) not null default 0;
alter table public.order_items add column if not exists unit_cost numeric(12, 2) not null default 0;
alter table public.order_items add column if not exists supply_cost numeric(12, 2) not null default 0;
alter table public.order_items add column if not exists product_size text;
alter table public.order_items add column if not exists product_color text;

alter table public.supplies enable row level security;
alter table public.product_supplies enable row level security;
alter table public.store_expenses enable row level security;
alter table public.state_tax_rates enable row level security;

create policy "Admins manage supplies" on public.supplies for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage product supplies" on public.product_supplies for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage store expenses" on public.store_expenses for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage state tax rates" on public.state_tax_rates for all using (public.is_admin()) with check (public.is_admin());insert into public.categories (name)
select distinct trim(category)
from public.products
where category is not null and trim(category) <> ''
on conflict (name) do nothing;

insert into public.sizes (name)
select distinct trim(split_size.name)
from public.sizes existing
cross join lateral regexp_split_to_table(existing.name, ',') as split_size(name)
where trim(split_size.name) <> ''
on conflict (name) do nothing;

delete from public.sizes where name like '%,%';

create table if not exists public.supplies (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  unit text not null default 'unidade',
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_supplies (
  product_id uuid not null references public.products(id) on delete cascade,
  supply_id uuid not null references public.supplies(id) on delete restrict,
  quantity_per_product numeric(10, 3) not null default 1 check (quantity_per_product >= 0),
  primary key (product_id, supply_id)
);

create table if not exists public.store_expenses (
  id uuid primary key default uuid_generate_v4(),
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.state_tax_rates (
  state char(2) primary key,
  rate_percent numeric(6, 3) not null check (rate_percent >= 0 and rate_percent <= 100),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists shipping_state char(2);
alter table public.orders add column if not exists tax_rate_percent numeric(6, 3);
alter table public.orders add column if not exists tax_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists shipping_cost numeric(12, 2) not null default 0;
alter table public.order_items add column if not exists unit_cost numeric(12, 2) not null default 0;
alter table public.order_items add column if not exists product_size text;
alter table public.order_items add column if not exists product_color text;

alter table public.supplies enable row level security;
alter table public.product_supplies enable row level security;
alter table public.store_expenses enable row level security;
alter table public.state_tax_rates enable row level security;

create policy "Admins manage supplies" on public.supplies for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage product supplies" on public.product_supplies for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage store expenses" on public.store_expenses for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage state tax rates" on public.state_tax_rates for all using (public.is_admin()) with check (public.is_admin());