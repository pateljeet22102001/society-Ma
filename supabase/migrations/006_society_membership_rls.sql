-- Society membership and tenant-isolated row level security.
-- Existing Phase-1 users are attached to the oldest society to avoid lockout.

create table if not exists public.society_members (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('admin', 'chairman', 'treasurer', 'operator', 'viewer', 'auditor')),
  status public.entity_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (society_id, user_id)
);

create index if not exists society_members_user_id_idx
  on public.society_members (user_id);
create index if not exists society_members_society_id_idx
  on public.society_members (society_id);

drop trigger if exists society_members_set_updated_at on public.society_members;
create trigger society_members_set_updated_at
before update on public.society_members
for each row execute function public.set_updated_at();

alter table public.society_members enable row level security;

-- SECURITY DEFINER avoids recursive RLS evaluation on society_members.
create or replace function public.is_society_member(target_society_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.society_members sm
    where sm.society_id = target_society_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  );
$$;

create or replace function public.is_society_admin(target_society_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.society_members sm
    where sm.society_id = target_society_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('admin', 'chairman')
  );
$$;

revoke all on function public.is_society_member(uuid) from public;
revoke all on function public.is_society_admin(uuid) from public;
grant execute on function public.is_society_member(uuid) to authenticated;
grant execute on function public.is_society_admin(uuid) to authenticated;

-- Preserve access for existing single-society installations.
insert into public.society_members (society_id, user_id, role, status)
select primary_society.id, p.id, 'admin', 'active'
from public.profiles p
cross join lateral (
  select s.id
  from public.societies s
  order by s.created_at asc
  limit 1
) primary_society
on conflict (society_id, user_id) do nothing;

-- Also preserve ownership when an installation already contains multiple societies.
insert into public.society_members (society_id, user_id, role, status)
select s.id, s.created_by, 'admin', 'active'
from public.societies s
where s.created_by is not null
on conflict (society_id, user_id) do nothing;

create or replace function public.add_society_creator_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.society_members (society_id, user_id, role, status)
    values (new.id, new.created_by, 'admin', 'active')
    on conflict (society_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists societies_add_creator_membership on public.societies;
create trigger societies_add_creator_membership
after insert on public.societies
for each row execute function public.add_society_creator_membership();

-- Membership policies.
drop policy if exists "Members read own memberships" on public.society_members;
create policy "Members read own memberships"
  on public.society_members for select to authenticated
  using (user_id = auth.uid() or public.is_society_admin(society_id));

drop policy if exists "Admins add society members" on public.society_members;
create policy "Admins add society members"
  on public.society_members for insert to authenticated
  with check (public.is_society_admin(society_id));

drop policy if exists "Admins update society members" on public.society_members;
create policy "Admins update society members"
  on public.society_members for update to authenticated
  using (public.is_society_admin(society_id))
  with check (public.is_society_admin(society_id));

drop policy if exists "Admins delete society members" on public.society_members;
create policy "Admins delete society members"
  on public.society_members for delete to authenticated
  using (public.is_society_admin(society_id));

-- Profiles: users see their own profile and profiles belonging to the same society.
drop policy if exists "Authenticated read profiles" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users read permitted profiles"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.society_members mine
      join public.society_members theirs on theirs.society_id = mine.society_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = profiles.id
        and theirs.status = 'active'
    )
  );
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Societies need a bootstrap insert rule; the trigger above creates membership.
drop policy if exists "Authenticated full access societies" on public.societies;
create policy "Members read societies"
  on public.societies for select to authenticated
  using (public.is_society_member(id));
create policy "Authenticated users create societies"
  on public.societies for insert to authenticated
  with check (created_by = auth.uid());
create policy "Members update societies"
  on public.societies for update to authenticated
  using (public.is_society_member(id))
  with check (public.is_society_member(id));
create policy "Members delete societies"
  on public.societies for delete to authenticated
  using (public.is_society_member(id));

-- Replace permissive tenant-table policies.
drop policy if exists "Authenticated full access wings" on public.wings;
create policy "Society members manage wings" on public.wings for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access flats" on public.flats;
create policy "Society members manage flats" on public.flats for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated read income categories" on public.income_categories;
drop policy if exists "Authenticated manage income categories" on public.income_categories;
create policy "Members read income categories" on public.income_categories for select to authenticated
  using (society_id is null or public.is_society_member(society_id));
create policy "Members manage society income categories" on public.income_categories for all to authenticated
  using (society_id is not null and public.is_society_member(society_id))
  with check (society_id is not null and public.is_society_member(society_id));

drop policy if exists "Authenticated read expense categories" on public.expense_categories;
drop policy if exists "Authenticated manage expense categories" on public.expense_categories;
create policy "Members read expense categories" on public.expense_categories for select to authenticated
  using (society_id is null or public.is_society_member(society_id));
create policy "Members manage society expense categories" on public.expense_categories for all to authenticated
  using (society_id is not null and public.is_society_member(society_id))
  with check (society_id is not null and public.is_society_member(society_id));

drop policy if exists "Authenticated full access income" on public.income_transactions;
create policy "Society members manage income" on public.income_transactions for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access expenses" on public.expense_transactions;
create policy "Society members manage expenses" on public.expense_transactions for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access maintenance settings" on public.maintenance_settings;
create policy "Society members manage maintenance settings" on public.maintenance_settings for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access maintenance bills" on public.maintenance_bills;
create policy "Society members manage maintenance bills" on public.maintenance_bills for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access maintenance payments" on public.maintenance_payments;
create policy "Society members manage maintenance payments" on public.maintenance_payments for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access events" on public.events;
create policy "Society members manage events" on public.events for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access event flat contributions" on public.event_flat_contributions;
create policy "Society members manage event flat contributions" on public.event_flat_contributions for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access event flat payments" on public.event_flat_payments;
create policy "Society members manage event flat payments" on public.event_flat_payments for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access event contributions" on public.event_contributions;
create policy "Society members manage event contributions" on public.event_contributions for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

drop policy if exists "Authenticated full access event expenses" on public.event_expenses;
create policy "Society members manage event expenses" on public.event_expenses for all to authenticated
  using (public.is_society_member(society_id))
  with check (public.is_society_member(society_id));

