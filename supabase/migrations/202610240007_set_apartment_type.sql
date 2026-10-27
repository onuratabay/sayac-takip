create function public.set_apartment_type(p_unit_number text, p_apartment_type text)
returns public.apartments
language plpgsql
security definer
set search_path = ''
as $$
declare
  building_owner_id uuid := public.current_building_owner_id();
  saved_apartment public.apartments;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Giriş yapmanız gerekiyor.';
  end if;

  if building_owner_id is null or not public.can_edit_meter_readings(building_owner_id) then
    raise exception using errcode = '42501', message = 'Daire tipini yalnızca yönetici ve apartman görevlisi değiştirebilir.';
  end if;

  if trim(coalesce(p_unit_number, '')) = '' then
    raise exception using errcode = '22023', message = 'Daire numarası gerekli.';
  end if;

  if p_apartment_type is null or p_apartment_type not in ('1+0', '1+1', '2+1', '3+1') then
    raise exception using errcode = '22023', message = 'Geçersiz daire tipi.';
  end if;

  insert into public.apartments (owner_id, unit_number, apartment_type)
  values (building_owner_id, trim(p_unit_number), p_apartment_type)
  on conflict (owner_id, unit_number)
    do update set apartment_type = excluded.apartment_type
  returning * into saved_apartment;

  return saved_apartment;
end;
$$;

revoke all on function public.set_apartment_type(text, text) from public;
grant execute on function public.set_apartment_type(text, text) to authenticated;

notify pgrst, 'reload schema';
