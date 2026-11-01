-- Water and electricity bills per apartment and month. The manager and concierges enter
-- them in the meter table; they are added to the apartment's monthly due.
create table public.apartment_bills (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null,
  owner_id uuid not null default public.current_building_owner_id() references auth.users (id) on delete cascade,
  bill_month date not null check (extract(day from bill_month) = 1),
  water_amount numeric(12, 2) check (water_amount >= 0),
  electricity_amount numeric(12, 2) check (electricity_amount >= 0),
  created_at timestamptz not null default now(),
  unique (apartment_id, bill_month),
  foreign key (apartment_id, owner_id)
    references public.apartments (id, owner_id)
    on delete cascade
);

create index apartment_bills_owner_month_idx
  on public.apartment_bills (owner_id, bill_month);

alter table public.apartment_bills enable row level security;

create policy "Managers and concierges view apartment bills"
  on public.apartment_bills for select to authenticated
  using (public.can_view_building_details(owner_id));
create policy "Managers manage apartment bills"
  on public.apartment_bills for all to authenticated
  using (public.can_manage_building(owner_id))
  with check (public.can_manage_building(owner_id));
create policy "Managers and concierges add apartment bills"
  on public.apartment_bills for insert to authenticated
  with check (public.can_edit_meter_readings(owner_id));
create policy "Managers and concierges update apartment bills"
  on public.apartment_bills for update to authenticated
  using (public.can_edit_meter_readings(owner_id))
  with check (public.can_edit_meter_readings(owner_id));

grant select, insert, update, delete on public.apartment_bills to authenticated;

-- Monthly dues now also include the apartment's water and electricity bills.
create or replace function public.get_monthly_dues(p_month date)
returns table (apartment_number text, monthly_due numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  building_owner_id uuid := public.current_building_owner_id();
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Giriş yapmanız gerekiyor.';
  end if;

  if building_owner_id is null or not public.can_access_building(building_owner_id) then
    raise exception using errcode = '42501', message = 'Bu binanın aidat listesine erişiminiz yok.';
  end if;

  if p_month is null or extract(day from p_month) <> 1 then
    raise exception using errcode = '22023', message = 'Geçersiz ay.';
  end if;

  return query
  select
    apartment.unit_number,
    (rate.dues + (current_reading.index_value - previous_reading.index_value)
      * rate.hot_water_price
      + coalesce(bill.water_amount, 0) + coalesce(bill.electricity_amount, 0))::numeric(12, 2)
  from public.apartments as apartment
  join lateral (
    select monthly_rate.dues, monthly_rate.hot_water_price
    from public.monthly_rates as monthly_rate
    where monthly_rate.owner_id = building_owner_id
      and monthly_rate.apartment_type = apartment.apartment_type
      and monthly_rate.rate_month <= p_month
    order by monthly_rate.rate_month desc
    limit 1
  ) as rate on true
  join public.meter_readings as previous_reading
    on previous_reading.apartment_id = apartment.id
    and previous_reading.reading_month = (p_month - interval '1 month')::date
  join public.meter_readings as current_reading
    on current_reading.apartment_id = apartment.id
    and current_reading.reading_month = p_month
  left join public.apartment_bills as bill
    on bill.apartment_id = apartment.id
    and bill.bill_month = p_month
  where apartment.owner_id = building_owner_id
    and current_reading.index_value >= previous_reading.index_value;
end;
$$;

create or replace function public.create_shared_dues(p_month date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  share_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Giriş yapmanız gerekiyor.';
  end if;

  if extract(day from p_month) <> 1 then
    raise exception using errcode = '22023', message = 'Geçersiz ay.';
  end if;

  insert into public.shared_dues_lists (owner_id, share_month)
  values (auth.uid(), p_month)
  returning id into share_id;

  insert into public.shared_dues_rows (share_id, apartment_number, monthly_due)
  select
    share_id,
    apartment.unit_number,
    (rate.dues + (current_reading.index_value - previous_reading.index_value)
      * rate.hot_water_price
      + coalesce(bill.water_amount, 0) + coalesce(bill.electricity_amount, 0))::numeric(12, 2)
  from public.apartments as apartment
  join lateral (
    select monthly_rate.dues, monthly_rate.hot_water_price
    from public.monthly_rates as monthly_rate
    where monthly_rate.owner_id = auth.uid()
      and monthly_rate.apartment_type = apartment.apartment_type
      and monthly_rate.rate_month <= p_month
    order by monthly_rate.rate_month desc
    limit 1
  ) as rate on true
  join public.meter_readings as previous_reading
    on previous_reading.apartment_id = apartment.id
    and previous_reading.reading_month = (p_month - interval '1 month')::date
  join public.meter_readings as current_reading
    on current_reading.apartment_id = apartment.id
    and current_reading.reading_month = p_month
  left join public.apartment_bills as bill
    on bill.apartment_id = apartment.id
    and bill.bill_month = p_month
  where apartment.owner_id = auth.uid()
    and apartment.unit_number in (
      select generate_series(1, 46)::text
    )
    and current_reading.index_value >= previous_reading.index_value;

  return share_id;
end;
$$;

notify pgrst, 'reload schema';
