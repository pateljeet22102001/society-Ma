-- Allow monthly, yearly, and custom maintenance periods from 1 to 12 months.
alter table public.maintenance_settings
  drop constraint if exists maintenance_settings_billing_frequency_months_check;
alter table public.maintenance_settings
  add constraint maintenance_settings_billing_frequency_months_check
  check (billing_frequency_months between 1 and 12);

alter table public.maintenance_bills
  drop constraint if exists maintenance_bills_period_months_check;
alter table public.maintenance_bills
  add constraint maintenance_bills_period_months_check
  check (period_months between 1 and 12);

comment on column public.maintenance_settings.billing_frequency_months is
  'Default billing period in months (1-12); each generated bill may override it.';
comment on column public.maintenance_bills.period_months is
  'Exact number of months covered by this bill (1-12).';

create or replace function public.prevent_overlapping_maintenance_bills()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  new_start integer;
  new_end integer;
begin
  new_start := new.bill_year * 12 + new.bill_month - 1;
  new_end := new_start + new.period_months - 1;
  if exists (
    select 1 from public.maintenance_bills existing
    where existing.flat_id = new.flat_id
      and existing.id <> new.id
      and new_start <= existing.bill_year * 12 + existing.bill_month - 1 + existing.period_months - 1
      and existing.bill_year * 12 + existing.bill_month - 1 <= new_end
  ) then
    raise exception 'Maintenance billing period overlaps an existing bill for this flat';
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_bills_prevent_overlap on public.maintenance_bills;
create trigger maintenance_bills_prevent_overlap
before insert or update of flat_id, bill_month, bill_year, period_months
on public.maintenance_bills
for each row execute function public.prevent_overlapping_maintenance_bills();
