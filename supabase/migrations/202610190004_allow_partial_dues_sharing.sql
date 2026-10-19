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
      * rate.hot_water_price)::numeric(12, 2)
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
  where apartment.owner_id = auth.uid()
    and apartment.unit_number in (
      select generate_series(1, 46)::text
    )
    and current_reading.index_value >= previous_reading.index_value;

  return share_id;
end;
$$;

create or replace function public.get_shared_dues(p_share_id uuid)
returns table (apartment_number text, monthly_due numeric, share_month date)
language sql
stable
security definer
set search_path = ''
as $$
  select result.apartment_number, result.monthly_due, result.share_month
  from (
    select shared_row.apartment_number, shared_row.monthly_due, shared.share_month
    from public.shared_dues_lists as shared
    join public.shared_dues_rows as shared_row on shared_row.share_id = shared.id
    where shared.id = p_share_id

    union all

    select null::text, null::numeric, shared.share_month
    from public.shared_dues_lists as shared
    where shared.id = p_share_id
      and not exists (
        select 1 from public.shared_dues_rows as shared_row
        where shared_row.share_id = shared.id
      )
  ) as result
  order by result.apartment_number::integer nulls last;
$$;
