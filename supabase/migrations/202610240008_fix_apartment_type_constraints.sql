alter table public.apartments
  drop constraint if exists apartments_apartment_type_check;

alter table public.monthly_rates
  drop constraint if exists monthly_rates_apartment_type_check;

update public.apartments
set apartment_type = case apartment_type
  when '1+2' then '2+1'
  when '1+3' then '3+1'
  else apartment_type
end
where apartment_type in ('1+2', '1+3');

update public.monthly_rates
set apartment_type = case apartment_type
  when '1+2' then '2+1'
  when '1+3' then '3+1'
  else apartment_type
end
where apartment_type in ('1+2', '1+3');

alter table public.apartments
  add constraint apartments_apartment_type_check
  check (apartment_type in ('1+0', '1+1', '2+1', '3+1'));

alter table public.monthly_rates
  add constraint monthly_rates_apartment_type_check
  check (apartment_type in ('1+0', '1+1', '2+1', '3+1'));
