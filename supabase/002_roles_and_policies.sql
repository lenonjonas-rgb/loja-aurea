alter table public.profiles add column if not exists role text not null default 'customer'
  check (role in ('customer', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

alter table public.products enable row level security;
alter table public.coupons enable row level security;

create policy "Customers create own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Admins manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Catalog is public" on public.products for select using (true);
create policy "Admins manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Coupons are public" on public.coupons for select using (true);
create policy "Admins manage coupons" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Customers create own orders" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "Admins manage orders" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Customers create own order items" on public.order_items
  for insert with check (
    exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );
create policy "Admins manage order items" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- Run this only after registering your account through Supabase Auth:
-- update public.profiles set role = 'admin' where id = (
--   select id from auth.users where email = 'lenonjonas@gmail.com'
-- );