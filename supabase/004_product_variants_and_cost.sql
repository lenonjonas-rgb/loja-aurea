alter table public.products add column if not exists cost_price numeric(12, 2) not null default 0 check (cost_price >= 0);
alter table public.products add column if not exists sizes text[] not null default '{}';
alter table public.products add column if not exists colors text[] not null default '{}';