-- Enforce society roles at the database boundary, including direct API access.

create or replace function public.has_society_role(
  target_society_id uuid,
  allowed_roles text[]
)
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
      and sm.role = any(allowed_roles)
  );
$$;

revoke all on function public.has_society_role(uuid, text[]) from public;
grant execute on function public.has_society_role(uuid, text[]) to authenticated;

-- Society details: members read; only Admin/Chairman can change or delete.
drop policy if exists "Members update societies" on public.societies;
drop policy if exists "Members delete societies" on public.societies;
create policy "Admins update societies"
  on public.societies for update to authenticated
  using (public.has_society_role(id, array['admin', 'chairman']))
  with check (public.has_society_role(id, array['admin', 'chairman']));
create policy "Admins delete societies"
  on public.societies for delete to authenticated
  using (public.has_society_role(id, array['admin', 'chairman']));

-- Structural records: all members read; only Admin/Chairman mutate.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['wings', 'flats'] loop
    execute format('drop policy if exists %I on public.%I', 'Society members manage ' || table_name, table_name);
    -- Drop the exact legacy names from migration 006.
    if table_name = 'wings' then
      drop policy if exists "Society members manage wings" on public.wings;
    else
      drop policy if exists "Society members manage flats" on public.flats;
    end if;
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_society_member(society_id))',
      'Members read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_society_role(society_id, array[''admin'', ''chairman'']))',
      'Admins insert ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_society_role(society_id, array[''admin'', ''chairman''])) with check (public.has_society_role(society_id, array[''admin'', ''chairman'']))',
      'Admins update ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_society_role(society_id, array[''admin'', ''chairman'']))',
      'Admins delete ' || table_name, table_name
    );
  end loop;
end;
$$;

-- Maintenance configuration is an administrative setting.
drop policy if exists "Society members manage maintenance settings" on public.maintenance_settings;
create policy "Members read maintenance settings"
  on public.maintenance_settings for select to authenticated
  using (public.is_society_member(society_id));
create policy "Admins insert maintenance settings"
  on public.maintenance_settings for insert to authenticated
  with check (public.has_society_role(society_id, array['admin', 'chairman']));
create policy "Admins update maintenance settings"
  on public.maintenance_settings for update to authenticated
  using (public.has_society_role(society_id, array['admin', 'chairman']))
  with check (public.has_society_role(society_id, array['admin', 'chairman']));
create policy "Admins delete maintenance settings"
  on public.maintenance_settings for delete to authenticated
  using (public.has_society_role(society_id, array['admin', 'chairman']));

-- Custom categories: shared system categories remain read-only.
drop policy if exists "Members manage society income categories" on public.income_categories;
create policy "Finance roles insert income categories"
  on public.income_categories for insert to authenticated
  with check (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer', 'operator']));
create policy "Finance roles update income categories"
  on public.income_categories for update to authenticated
  using (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer', 'operator']))
  with check (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer', 'operator']));
create policy "Finance managers delete income categories"
  on public.income_categories for delete to authenticated
  using (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer']));

drop policy if exists "Members manage society expense categories" on public.expense_categories;
create policy "Finance roles insert expense categories"
  on public.expense_categories for insert to authenticated
  with check (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer', 'operator']));
create policy "Finance roles update expense categories"
  on public.expense_categories for update to authenticated
  using (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer', 'operator']))
  with check (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer', 'operator']));
create policy "Finance managers delete expense categories"
  on public.expense_categories for delete to authenticated
  using (society_id is not null and public.has_society_role(society_id, array['admin', 'chairman', 'treasurer']));

-- Financial and event ledgers share the same role matrix.
do $$
declare
  table_name text;
  old_policy text;
begin
  foreach table_name in array array[
    'income_transactions', 'expense_transactions',
    'maintenance_bills', 'maintenance_payments',
    'events', 'event_flat_contributions', 'event_flat_payments',
    'event_contributions', 'event_expenses'
  ] loop
    old_policy := case table_name
      when 'income_transactions' then 'Society members manage income'
      when 'expense_transactions' then 'Society members manage expenses'
      when 'maintenance_bills' then 'Society members manage maintenance bills'
      when 'maintenance_payments' then 'Society members manage maintenance payments'
      when 'events' then 'Society members manage events'
      when 'event_flat_contributions' then 'Society members manage event flat contributions'
      when 'event_flat_payments' then 'Society members manage event flat payments'
      when 'event_contributions' then 'Society members manage event contributions'
      when 'event_expenses' then 'Society members manage event expenses'
    end;
    execute format('drop policy if exists %I on public.%I', old_policy, table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_society_member(society_id))',
      'Members read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_society_role(society_id, array[''admin'', ''chairman'', ''treasurer'', ''operator'']))',
      'Finance roles insert ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_society_role(society_id, array[''admin'', ''chairman'', ''treasurer'', ''operator''])) with check (public.has_society_role(society_id, array[''admin'', ''chairman'', ''treasurer'', ''operator'']))',
      'Finance roles update ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_society_role(society_id, array[''admin'', ''chairman'', ''treasurer'']))',
      'Finance managers delete ' || table_name, table_name
    );
  end loop;
end;
$$;

