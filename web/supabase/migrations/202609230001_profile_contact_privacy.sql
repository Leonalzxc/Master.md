-- Deploy together with the profile RPC readers in the application.
-- No rows or contact values are removed. See docs/profile-privacy-rollout.md.
begin;

-- RLS restricts rows, not columns. Public table SELECT used to expose phone,
-- telegram_chat_id and any newly added private fields, including in joins.
revoke all privileges on table public.profiles from public, anon, authenticated;
do $permissions$
declare
  cols text;
begin
  select string_agg(quote_ident(attname), ', ')
    into cols from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  -- Remove any earlier column grants as well as the table grants above.
  execute format(
    'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on public.profiles from public, anon, authenticated', cols
  );
end
$permissions$;

grant select (id, name, role, city, created_at, blocked_at)
  on public.profiles to anon, authenticated;
grant insert (id, phone, name, role, city) on public.profiles to authenticated;
grant update (name, role, city) on public.profiles to authenticated;

-- Column UPDATE still permits switching client/worker. It must not permit
-- granting oneself admin and then using the service-role admin interface.
create or replace function public.guard_profile_identity()
returns trigger
language plpgsql security definer set search_path = '' as $function$
declare
  auth_phone text;
begin
  if auth.role() in ('anon', 'authenticated') then
    if auth.uid() is null or new.id is distinct from auth.uid() then
      raise exception 'Profile owner mismatch' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      if new.role not in ('client', 'worker') then
        raise exception 'Invalid registration role' using errcode = '42501';
      end if;
      select u.phone into auth_phone from auth.users u where u.id = auth.uid();
      if auth_phone is null or
         regexp_replace(new.phone, '[^0-9]', '', 'g') is distinct from
         regexp_replace(auth_phone, '[^0-9]', '', 'g') then
        raise exception 'Phone must match verified identity' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role and
          (new.role = 'admin' or old.role = 'admin') then
      raise exception 'Admin role is not user-editable' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.guard_profile_identity() from public, anon, authenticated;
drop trigger if exists profile_identity_guard on public.profiles;
create trigger profile_identity_guard before insert or update on public.profiles
  for each row execute function public.guard_profile_identity();

-- No user-supplied UUID: callers can only read their own complete profile.
create or replace function public.get_my_profile()
returns setof public.profiles
language sql stable security definer set search_path = '' as $function$
  select p.* from public.profiles p
  where auth.uid() is not null and p.id = auth.uid();
$function$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- Reveal only the customer's phone, only to the actual selected bidder.
-- Telegram IDs and unrelated profile fields never leave this function.
create or replace function public.get_job_client_contact(p_job_id uuid)
returns table (name text, phone text)
language sql stable security definer set search_path = '' as $function$
  select p.name, p.phone
  from public.jobs j
  join public.profiles p on p.id = j.client_id
  join public.profiles actor on actor.id = auth.uid()
  where j.id = p_job_id
    and auth.uid() is not null
    and j.selected_worker_id = auth.uid()
    and j.client_id <> auth.uid()
    and j.status = 'in_progress'
    and p.blocked_at is null and actor.blocked_at is null
    and exists (
      select 1 from public.bids b
      where b.job_id = j.id and b.worker_id = auth.uid() and b.status = 'selected'
    );
$function$;
revoke all on function public.get_job_client_contact(uuid) from public, anon;
grant execute on function public.get_job_client_contact(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
