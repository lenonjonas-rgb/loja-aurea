alter table public.profiles
  add column if not exists admin_level integer not null default 0;

alter table public.profiles drop constraint if exists profiles_admin_level_check;
alter table public.profiles add constraint profiles_admin_level_check check (admin_level between 0 and 3);

update public.profiles
set admin_level = 3
where role = 'admin' and admin_level = 0;

alter table public.addresses
  add column if not exists complement text,
  add column if not exists is_default boolean not null default false;

alter table public.store_settings add column if not exists complement text;

with first_address as (
  select distinct on (user_id) id, user_id
  from public.addresses
  where not exists (
    select 1 from public.addresses current_default
    where current_default.user_id = addresses.user_id and current_default.is_default
  )
  order by user_id, created_at, id
)
update public.addresses
set is_default = true
from first_address
where addresses.id = first_address.id;

alter table public.products
  add column if not exists ncm_code text,
  add column if not exists cest_code text,
  add column if not exists origin_code text not null default '0',
  add column if not exists gtin text,
  add column if not exists icms_cst text,
  add column if not exists pis_cst text,
  add column if not exists cofins_cst text,
  add column if not exists ipi_cst text;

alter table public.orders
  add column if not exists shipping_address jsonb not null default '{}'::jsonb,
  add column if not exists customer_name text,
  add column if not exists customer_email text;

alter table public.products drop constraint if exists products_ncm_code_format;
alter table public.products add constraint products_ncm_code_format
  check (ncm_code is null or ncm_code ~ '^[0-9]{8}$');
alter table public.products drop constraint if exists products_cest_code_format;
alter table public.products add constraint products_cest_code_format
  check (cest_code is null or cest_code ~ '^[0-9]{7}$');
alter table public.products drop constraint if exists products_origin_code_format;
alter table public.products add constraint products_origin_code_format
  check (origin_code ~ '^[0-8]$');
alter table public.products drop constraint if exists products_gtin_format;
alter table public.products add constraint products_gtin_format
  check (gtin is null or gtin ~ '^([0-9]{8}|[0-9]{12,14})$');

create or replace function public.has_admin_level(required_level integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and admin_level >= required_level
  );
$$;

grant execute on function public.has_admin_level(integer) to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_level(3);
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, admin_level)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    'customer',
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_customer_profile();

create or replace function public.protect_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() = new.id and not public.has_admin_level(3) then
    new.role := 'customer';
    new.admin_level := 0;
  elsif tg_op = 'UPDATE'
    and (new.role is distinct from old.role or new.admin_level is distinct from old.admin_level)
    and auth.role() = 'authenticated'
    and not public.has_admin_level(3) then
    raise exception 'Only level 3 administrators can change account permissions.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_permissions on public.profiles;
create trigger protect_profile_permissions
before insert or update on public.profiles
for each row execute function public.protect_profile_permissions();

create or replace function public.protect_order_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  logistics_fields text[] := array['status', 'tracking_code', 'invoice_url', 'separation_note'];
begin
  if public.has_admin_level(1) and not public.has_admin_level(3) then
    if (to_jsonb(new) - logistics_fields) is distinct from (to_jsonb(old) - logistics_fields) then
      raise exception 'Level 1 administrators can only update order logistics fields.';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'open' and new.status in ('separating', 'cancelled')) or
      (old.status = 'paid' and new.status in ('separating', 'cancelled')) or
      (old.status = 'separating' and new.status in ('shipped', 'cancelled')) or
      (old.status = 'shipped' and new.status = 'delivered')
    ) then
      raise exception 'Invalid order status transition.';
    end if;
  elsif auth.uid() = old.user_id and not public.has_admin_level(1) then
    if new.status is distinct from old.status and not (old.status = 'open' and new.status = 'cancelled') then
      raise exception 'Customers can only cancel open orders.';
    end if;
    if (to_jsonb(new) - array['status', 'cancelled_at']) is distinct from (to_jsonb(old) - array['status', 'cancelled_at']) then
      raise exception 'Customers cannot change order details.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_order_updates on public.orders;
create trigger protect_order_updates
before update on public.orders
for each row execute function public.protect_order_updates();

create or replace function public.create_customer_order(
  p_address_id uuid,
  p_shipping_address jsonb,
  p_total numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order_id uuid;
  item jsonb;
  item_price numeric(12, 2);
  calculated_total numeric(12, 2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order must contain at least one item.';
  end if;
  if p_address_id is not null and not exists (
    select 1 from public.addresses where id = p_address_id and user_id = auth.uid()
  ) then
    raise exception 'The delivery address does not belong to this account.';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    select price into item_price
    from public.products
    where id = (item ->> 'product_id')::uuid;
    if not found then
      raise exception 'A product in this order is no longer available.';
    end if;
    calculated_total := calculated_total + item_price * greatest(1, coalesce((item ->> 'quantity')::integer, 1));
  end loop;
  if p_total < 0 or p_total > calculated_total then
    raise exception 'Invalid order total.';
  end if;

  insert into public.orders (user_id, address_id, shipping_address, customer_name, customer_email, total, status)
  select auth.uid(), p_address_id, p_shipping_address, profiles.full_name, auth.jwt() ->> 'email', p_total, 'open'
  from public.profiles
  where profiles.id = auth.uid()
  returning id into new_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, product_size, product_color)
    select new_order_id, products.id, products.name, products.price,
      greatest(1, coalesce((item ->> 'quantity')::integer, 1)),
      nullif(item ->> 'size', ''), nullif(item ->> 'color', '')
    from public.products
    where products.id = (item ->> 'product_id')::uuid;
  end loop;

  return new_order_id;
end;
$$;

grant execute on function public.create_customer_order(uuid, jsonb, numeric, jsonb) to authenticated;

create or replace function public.set_default_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default then
    update public.addresses
    set is_default = false
    where user_id = new.user_id and id is distinct from new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_default_address on public.addresses;
create trigger set_default_address
before insert or update of is_default on public.addresses
for each row execute function public.set_default_address();

create unique index if not exists addresses_one_default_per_user
  on public.addresses(user_id) where is_default;

drop policy if exists "Staff view orders" on public.orders;
create policy "Staff view orders" on public.orders
  for select using (public.has_admin_level(1));

drop policy if exists "Staff update order logistics" on public.orders;
create policy "Staff update order logistics" on public.orders
  for update using (public.has_admin_level(1)) with check (public.has_admin_level(1));

drop policy if exists "Staff view order items" on public.order_items;
create policy "Staff view order items" on public.order_items
  for select using (public.has_admin_level(1));

drop policy if exists "Level 2 manage products" on public.products;
create policy "Level 2 manage products" on public.products
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Level 2 manage coupons" on public.coupons;
create policy "Level 2 manage coupons" on public.coupons
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Level 2 manage sizes" on public.sizes;
create policy "Level 2 manage sizes" on public.sizes
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Level 2 manage categories" on public.categories;
create policy "Level 2 manage categories" on public.categories
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Level 2 manage banners" on public.banners;
create policy "Level 2 manage banners" on public.banners
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Level 2 manage supplies" on public.supplies;
create policy "Level 2 manage supplies" on public.supplies
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Level 2 manage product supplies" on public.product_supplies;
create policy "Level 2 manage product supplies" on public.product_supplies
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Level 2 manage store expenses" on public.store_expenses;
create policy "Level 2 manage store expenses" on public.store_expenses
  for all using (public.has_admin_level(2)) with check (public.has_admin_level(2));

drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Level 3 manage profiles" on public.profiles;
create policy "Level 3 manage profiles" on public.profiles
  for all using (public.has_admin_level(3)) with check (public.has_admin_level(3));

drop policy if exists "Staff read invoice files" on storage.objects;
create policy "Staff read invoice files" on storage.objects
  for select using (bucket_id = 'invoices' and public.has_admin_level(1));

drop policy if exists "Staff upload invoice files" on storage.objects;
create policy "Staff upload invoice files" on storage.objects
  for insert with check (bucket_id = 'invoices' and public.has_admin_level(1));

drop policy if exists "Staff update invoice files" on storage.objects;
create policy "Staff update invoice files" on storage.objects
  for update using (bucket_id = 'invoices' and public.has_admin_level(1))
  with check (bucket_id = 'invoices' and public.has_admin_level(1));
