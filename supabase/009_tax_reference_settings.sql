create table if not exists public.tax_settings (
  id boolean primary key default true check (id),
  pis_rate_percent numeric(6, 3) not null default 1.65 check (pis_rate_percent between 0 and 100),
  cofins_rate_percent numeric(6, 3) not null default 7.6 check (cofins_rate_percent between 0 and 100),
  irpj_rate_percent numeric(6, 3) not null default 15 check (irpj_rate_percent between 0 and 100),
  irpj_additional_rate_percent numeric(6, 3) not null default 10 check (irpj_additional_rate_percent between 0 and 100),
  irpj_additional_monthly_threshold numeric(12, 2) not null default 20000 check (irpj_additional_monthly_threshold >= 0),
  csll_rate_percent numeric(6, 3) not null default 9 check (csll_rate_percent between 0 and 100),
  icms_sc_internal_rate_percent numeric(6, 3) not null default 17 check (icms_sc_internal_rate_percent between 0 and 100),
  ibs_transition_rate_percent numeric(6, 3) not null default 0.1 check (ibs_transition_rate_percent between 0 and 100),
  cbs_transition_rate_percent numeric(6, 3) not null default 0.9 check (cbs_transition_rate_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.tax_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.tax_settings enable row level security;

drop policy if exists "Admins manage tax settings" on public.tax_settings;
create policy "Admins manage tax settings" on public.tax_settings
  for all using (public.is_admin()) with check (public.is_admin());