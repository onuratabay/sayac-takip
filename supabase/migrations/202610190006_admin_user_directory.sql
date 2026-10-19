create function public.list_registered_users()
returns table (
  user_id uuid,
  email text,
  role text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
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
    raise exception using errcode = '42501', message = 'Yalnızca yönetici kullanıcı listesini görebilir.';
  end if;

  return query
  select
    account.id,
    account.email::text,
    case
      when account.id = auth.uid() then 'manager'::text
      else member.role
    end,
    account.last_sign_in_at,
    account.created_at
  from auth.users as account
  left join public.building_members as member
    on member.user_id = account.id
    and member.owner_id = auth.uid()
  where account.email is not null
  order by account.last_sign_in_at desc nulls last, lower(account.email);
end;
$$;

revoke all on function public.list_registered_users() from public;
grant execute on function public.list_registered_users() to authenticated;

notify pgrst, 'reload schema';
