create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  whatsapp text,
  contact_email text,
  street text,
  number text,
  city text,
  state text,
  origin_zip_code text,
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;

create policy "Store settings are public" on public.store_settings for select using (true);
create policy "Admins manage store settings" on public.store_settings
  for all using (public.is_admin()) with check (public.is_admin());