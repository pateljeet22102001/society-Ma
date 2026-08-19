-- Separate maintenance receipt series from income (REC-) and expense (EXP-).
-- Maintenance: MNT-YYYY-0001

alter table public.maintenance_payments
  add column if not exists receipt_number text;

alter table public.document_number_counters
  drop constraint if exists document_number_counters_document_type_check;

alter table public.document_number_counters
  add constraint document_number_counters_document_type_check
  check (document_type in ('receipt', 'expense_voucher', 'maintenance_receipt'));

create or replace function public.assign_maintenance_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  number_year integer := extract(year from new.payment_date)::integer;
  next_number integer;
  existing_max integer;
begin
  if nullif(btrim(new.receipt_number), '') is not null then
    return new;
  end if;

  select coalesce(max(substring(receipt_number from '([0-9]+)$')::integer), 0)
    into existing_max
  from public.maintenance_payments
  where society_id = new.society_id
    and receipt_number ~ ('^MNT-' || number_year || '-[0-9]+$');

  insert into public.document_number_counters (society_id, document_type, document_year, last_number)
  values (new.society_id, 'maintenance_receipt', number_year, existing_max + 1)
  on conflict (society_id, document_type, document_year)
  do update set last_number = public.document_number_counters.last_number + 1,
                updated_at = timezone('utc', now())
  returning last_number into next_number;

  new.receipt_number := 'MNT-' || number_year || '-' || lpad(next_number::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists maintenance_assign_receipt_number on public.maintenance_payments;
create trigger maintenance_assign_receipt_number
before insert on public.maintenance_payments
for each row execute function public.assign_maintenance_receipt_number();

create unique index if not exists maintenance_payments_receipt_unique
  on public.maintenance_payments (society_id, receipt_number)
  where receipt_number ~ '^MNT-[0-9]{4}-[0-9]+$';

comment on column public.maintenance_payments.receipt_number is
  'Society-generated maintenance receipt number (MNT-YYYY-####), separate from income REC- and expense EXP-.';
