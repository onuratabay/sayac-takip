create table public.building_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('accountant', 'concierge')),
  created_at timestamptz not null default now(),
  check (owner_id <> user_id)
);

alter table public.building_members enable row level security;

create function public.is_manager_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    where account.id = auth.uid()
      and account.email_confirmed_at is not null
      and lower(account.email) = 'onuratabay@hotmail.com'
  );
$$;

create function public.current_building_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_manager_account() then auth.uid()
    else (
      select member.owner_id
      from public.building_members as member
      where member.user_id = auth.uid()
    )
  end;
$$;

create function public.can_access_building(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_owner_id = auth.uid() and public.is_manager_account())
    or exists (
      select 1 from public.building_members as member
      where member.owner_id = p_owner_id and member.user_id = auth.uid()
    );
$$;

create function public.can_manage_building(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner_id = auth.uid() and public.is_manager_account();
$$;

create function public.can_edit_meter_readings(p_owner_id uuid)
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

create function public.get_my_access()
returns table (owner_id uuid, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid(), 'manager'::text
  where auth.uid() is not null
    and public.is_manager_account()
  union all
  select member.owner_id, member.role
  from public.building_members as member
  where member.user_id = auth.uid()
    and not public.is_manager_account();
$$;

create function public.add_building_member(p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_user_id uuid;
  member_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Giriş yapmanız gerekiyor.';
  end if;

  if p_role is null or p_role not in ('accountant', 'concierge') then
    raise exception using errcode = '22023', message = 'Geçersiz rol.';
  end if;

  if trim(coalesce(p_email, '')) = '' then
    raise exception using errcode = '22023', message = 'E-posta adresi girin.';
  end if;

  if not public.is_manager_account() then
    raise exception using errcode = '42501', message = 'Yalnızca yönetici ekip üyelerini yönetebilir.';
  end if;

  select users.id into member_user_id
  from auth.users as users
  where lower(users.email) = lower(trim(p_email))
  limit 1;

  if member_user_id is null then
    raise exception using errcode = 'P0002', message = 'Bu e-posta ile kayıtlı bir kullanıcı bulunamadı. Önce kullanıcı hesabı oluşturulmalı.';
  end if;

  if member_user_id = auth.uid() then
    raise exception using errcode = '22023', message = 'Yönetici hesabına başka bir rol atanamaz.';
  end if;

  select member.owner_id into member_owner_id
  from public.building_members as member
  where member.user_id = member_user_id;

  if member_owner_id is not null and member_owner_id <> auth.uid() then
    raise exception using errcode = '23505', message = 'Bu kullanıcı başka bir apartman yönetimine bağlı.';
  end if;

  if member_owner_id = auth.uid() then
    update public.building_members
    set role = p_role
    where user_id = member_user_id;
    return member_user_id;
  end if;

  insert into public.building_members (owner_id, user_id, role)
  values (auth.uid(), member_user_id, p_role);

  return member_user_id;
end;
$$;

create function public.list_building_members()
returns table (user_id uuid, email text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Giriş yapmanız gerekiyor.';
  end if;

  if not public.is_manager_account() then
    raise exception using errcode = '42501', message = 'Yalnızca yönetici ekip listesini görebilir.';
  end if;

  return query
  select member.user_id, users.email::text, member.role
  from public.building_members as member
  join auth.users as users on users.id = member.user_id
  where member.owner_id = auth.uid()
  order by lower(users.email);
end;
$$;

create function public.remove_building_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Giriş yapmanız gerekiyor.';
  end if;

  if not public.is_manager_account() then
    raise exception using errcode = '42501', message = 'Yalnızca yönetici ekip üyelerini yönetebilir.';
  end if;

  delete from public.building_members as member
  where member.owner_id = auth.uid() and member.user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Ekip üyesi bulunamadı.';
  end if;
end;
$$;

alter table public.apartments
  alter column owner_id set default public.current_building_owner_id();
alter table public.monthly_rates
  alter column owner_id set default public.current_building_owner_id();
alter table public.meter_readings
  alter column owner_id set default public.current_building_owner_id();
alter table public.shared_dues_lists
  alter column owner_id set default public.current_building_owner_id();

drop policy "Owners manage their apartments" on public.apartments;
create policy "Building members view apartments"
  on public.apartments for select to authenticated
  using (public.can_access_building(owner_id));
create policy "Managers manage apartments"
  on public.apartments for all to authenticated
  using (public.can_manage_building(owner_id))
  with check (public.can_manage_building(owner_id));

drop policy "Owners manage their monthly rates" on public.monthly_rates;
create policy "Building members view monthly rates"
  on public.monthly_rates for select to authenticated
  using (public.can_access_building(owner_id));
create policy "Managers manage monthly rates"
  on public.monthly_rates for all to authenticated
  using (public.can_manage_building(owner_id))
  with check (public.can_manage_building(owner_id));

drop policy "Owners manage their meter readings" on public.meter_readings;
create policy "Building members view meter readings"
  on public.meter_readings for select to authenticated
  using (public.can_access_building(owner_id));
create policy "Managers manage meter readings"
  on public.meter_readings for all to authenticated
  using (public.can_manage_building(owner_id))
  with check (public.can_manage_building(owner_id));
create policy "Managers and concierges add meter readings"
  on public.meter_readings for insert to authenticated
  with check (
    public.can_edit_meter_readings(owner_id)
    and exists (
      select 1 from public.apartments as apartment
      where apartment.id = meter_readings.apartment_id
        and apartment.owner_id = meter_readings.owner_id
    )
  );
create policy "Managers and concierges update meter readings"
  on public.meter_readings for update to authenticated
  using (public.can_edit_meter_readings(owner_id))
  with check (
    public.can_edit_meter_readings(owner_id)
    and exists (
      select 1 from public.apartments as apartment
      where apartment.id = meter_readings.apartment_id
        and apartment.owner_id = meter_readings.owner_id
    )
  );

drop policy "Owners manage their shared dues lists" on public.shared_dues_lists;
create policy "Managers manage their shared dues lists"
  on public.shared_dues_lists for all to authenticated
  using (public.can_manage_building(owner_id))
  with check (public.can_manage_building(owner_id));

drop policy "Owners manage rows in their shared dues lists" on public.shared_dues_rows;
create policy "Managers manage rows in their shared dues lists"
  on public.shared_dues_rows for all to authenticated
  using (
    exists (
      select 1 from public.shared_dues_lists as shared
      where shared.id = shared_dues_rows.share_id
        and public.can_manage_building(shared.owner_id)
    )
  )
  with check (
    exists (
      select 1 from public.shared_dues_lists as shared
      where shared.id = shared_dues_rows.share_id
        and public.can_manage_building(shared.owner_id)
    )
  );

revoke all on public.building_members from anon, authenticated;
revoke all on function public.is_manager_account() from public;
revoke all on function public.current_building_owner_id() from public;
revoke all on function public.can_access_building(uuid) from public;
revoke all on function public.can_manage_building(uuid) from public;
revoke all on function public.can_edit_meter_readings(uuid) from public;
revoke all on function public.get_my_access() from public;
revoke all on function public.add_building_member(text, text) from public;
revoke all on function public.list_building_members() from public;
revoke all on function public.remove_building_member(uuid) from public;

grant execute on function public.is_manager_account() to authenticated;
grant execute on function public.current_building_owner_id() to authenticated;
grant execute on function public.can_access_building(uuid) to authenticated;
grant execute on function public.can_manage_building(uuid) to authenticated;
grant execute on function public.can_edit_meter_readings(uuid) to authenticated;
grant execute on function public.get_my_access() to authenticated;
grant execute on function public.add_building_member(text, text) to authenticated;
grant execute on function public.list_building_members() to authenticated;
grant execute on function public.remove_building_member(uuid) to authenticated;

notify pgrst, 'reload schema';
