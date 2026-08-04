create or replace function public.grant_admin_for_institut_moisson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and lower(new.email) = 'institutmoisson@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_grant_institut_admin on auth.users;
create trigger on_auth_user_created_grant_institut_admin
after insert on auth.users
for each row execute function public.grant_admin_for_institut_moisson();

drop trigger if exists on_auth_user_confirmed_grant_institut_admin on auth.users;
create trigger on_auth_user_confirmed_grant_institut_admin
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.grant_admin_for_institut_moisson();

insert into public.user_roles (user_id, role)
select u.id, 'admin' from auth.users u
where lower(u.email) = 'institutmoisson@gmail.com' and u.email_confirmed_at is not null
on conflict do nothing;