create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  street text not null,
  number text not null,
  city text not null,
  state text not null,
  zip_code text not null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  price numeric(12, 2) not null check (price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  weight_kg numeric(8, 3),
  dimensions text,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  discount_percent numeric(5, 2) not null check (discount_percent > 0 and discount_percent <= 100),
  uses_limit integer check (uses_limit is null or uses_limit > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create type public.order_status as enum ('open', 'paid', 'separating', 'shipped', 'delivered', 'cancelled');

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  address_id uuid references public.addresses(id) on delete set null,
  status public.order_status not null default 'open',
  total numeric(12, 2) not null default 0 check (total >= 0),
  separation_note text,
  tracking_code text,
  invoice_url text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0)
);

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Customers view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Customers update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Customers manage own addresses" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Customers view own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Customers cancel recent orders" on public.orders for update using (auth.uid() = user_id and created_at > now() - interval '7 days') with check (auth.uid() = user_id);
create policy "Customers view own order items" on public.order_items for select using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));

-- Create a private storage bucket named invoices from Storage in the Supabase dashboard.
-- Administrative policies must be created after choosing how staff users are identified.