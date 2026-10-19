create table public.shared_dues_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  share_month date not null check (extract(day from share_month) = 1),
  created_at timestamptz not null default now()
);

create table public.shared_dues_rows (
  share_id uuid not null references public.shared_dues_lists (id) on delete cascade,
  apartment_number text not null,
  monthly_due numeric(12, 2) not null check (monthly_due >= 0),
  primary key (share_id, apartment_number)
);

alter table public.shared_dues_lists enable row level security;
alter table public.shared_dues_rows enable row level security;

create policy "Owners manage their shared dues lists"
  on public.shared_dues_lists for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners manage rows in their shared dues lists"
  on public.shared_dues_rows for all to authenticated
  using (
    exists (
      select 1
      from public.shared_dues_lists
      where shared_dues_lists.id = shared_dues_rows.share_id
        and shared_dues_lists.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.shared_dues_lists
      where shared_dues_lists.id = shared_dues_rows.share_id
        and shared_dues_lists.owner_id = (select auth.uid())
    )
  );

grant select, insert, delete on public.shared_dues_lists to authenticated;
grant select, insert, delete on public.shared_dues_rows to authenticated;
revoke all on public.shared_dues_lists from anon;
revoke all on public.shared_dues_rows from anon;

create function public.create_shared_dues(p_month date)
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
    );

  return share_id;
end;
$$;

create function public.get_shared_dues(p_share_id uuid)
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

revoke all on function public.create_shared_dues(date) from public, anon;
grant execute on function public.create_shared_dues(date) to authenticated;

revoke all on function public.get_shared_dues(uuid) from public;
grant execute on function public.get_shared_dues(uuid) to anon, authenticated;
