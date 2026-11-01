-- Monthly water and electricity bills of the building. The manager and concierges
-- enter them next to the meter readings; accountants cannot see them.
create table public.utility_bills (
  owner_id uuid not null default public.current_building_owner_id() references auth.users (id) on delete cascade,
  bill_month date not null check (extract(day from bill_month) = 1),
  water_amount numeric(12, 2) check (water_amount >= 0),
  electricity_amount numeric(12, 2) check (electricity_amount >= 0),
  created_at timestamptz not null default now(),
  primary key (owner_id, bill_month)
);

alter table public.utility_bills enable row level security;

create policy "Managers and concierges view utility bills"
  on public.utility_bills for select to authenticated
  using (public.can_view_building_details(owner_id));
create policy "Managers manage utility bills"
  on public.utility_bills for all to authenticated
  using (public.can_manage_building(owner_id))
  with check (public.can_manage_building(owner_id));
create policy "Managers and concierges add utility bills"
  on public.utility_bills for insert to authenticated
  with check (public.can_edit_meter_readings(owner_id));
create policy "Managers and concierges update utility bills"
  on public.utility_bills for update to authenticated
  using (public.can_edit_meter_readings(owner_id))
  with check (public.can_edit_meter_readings(owner_id));

grant select, insert, update, delete on public.utility_bills to authenticated;

notify pgrst, 'reload schema';
