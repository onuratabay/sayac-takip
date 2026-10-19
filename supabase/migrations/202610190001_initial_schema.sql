create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_number text not null check (length(trim(unit_number)) > 0),
  apartment_type text not null check (apartment_type in ('1+0', '1+1', '1+2', '1+3')),
  created_at timestamptz not null default now(),
  unique (owner_id, unit_number),
  unique (id, owner_id)
);

create table public.monthly_rates (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rate_month date not null check (extract(day from rate_month) = 1),
  apartment_type text not null check (apartment_type in ('1+0', '1+1', '1+2', '1+3')),
  dues numeric(12, 2) not null default 0 check (dues >= 0),
  hot_water_price numeric(12, 2) not null default 0 check (hot_water_price >= 0),
  created_at timestamptz not null default now(),
  primary key (owner_id, rate_month, apartment_type)
);

create table public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reading_month date not null check (extract(day from reading_month) = 1),
  index_value numeric(14, 3) not null check (index_value >= 0),
  created_at timestamptz not null default now(),
  unique (apartment_id, reading_month),
  foreign key (apartment_id, owner_id)
    references public.apartments (id, owner_id)
    on delete cascade
);

create index meter_readings_owner_month_idx
  on public.meter_readings (owner_id, reading_month);

alter table public.apartments enable row level security;
alter table public.monthly_rates enable row level security;
alter table public.meter_readings enable row level security;

create policy "Owners manage their apartments"
  on public.apartments for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners manage their monthly rates"
  on public.monthly_rates for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners manage their meter readings"
  on public.meter_readings for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.apartments to authenticated;
grant select, insert, update, delete on public.monthly_rates to authenticated;
grant select, insert, update, delete on public.meter_readings to authenticated;
