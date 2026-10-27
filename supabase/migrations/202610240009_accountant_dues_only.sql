-- Accountants may only see apartment numbers and monthly dues. Apartment types,
-- meter readings and rates stay visible to the manager and concierges only.
create function public.can_view_building_details(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_owner_id = auth.uid() and public.is_manager_account())
    or exists (
      select 1 from public.building_members as member
      where member.owner_id = p_owner_id
        and member.user_id = auth.uid()
        and member.role = 'concierge'
    );
$$;

drop policy "Building members view apartments" on public.apartments;
create policy "Managers and concierges view apartments"
  on public.apartments for select to authenticated
  using (public.can_view_building_details(owner_id));

drop policy "Building members view monthly rates" on public.monthly_rates;
create policy "Managers and concierges view monthly rates"
  on public.monthly_rates for select to authenticated
  using (public.can_view_building_details(owner_id));

drop policy "Building members view meter readings" on public.meter_readings;
create policy "Managers and concierges view meter readings"
  on public.meter_readings for select to authenticated
  using (public.can_view_building_details(owner_id));

create function public.get_monthly_dues(p_month date)
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
      * rate.hot_water_price)::numeric(12, 2)
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
  where apartment.owner_id = building_owner_id
    and current_reading.index_value >= previous_reading.index_value;
end;
$$;

revoke all on function public.get_monthly_dues(date) from public, anon;
grant execute on function public.get_monthly_dues(date) to authenticated;

notify pgrst, 'reload schema';
