alter table public.products
  add column if not exists color_variants jsonb not null default '[]'::jsonb;

alter table public.products drop constraint if exists products_color_variants_array;
alter table public.products add constraint products_color_variants_array
  check (jsonb_typeof(color_variants) = 'array');
