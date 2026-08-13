-- Automatic, concurrency-safe society receipt and expense voucher numbering.
-- Income: REC-YYYY-0001. Expense voucher: EXP-YYYY-0001.

alter table public.expense_transactions
  add column if not exists voucher_number text;

create table if not exists public.document_number_counters (
  society_id uuid not null references public.societies(id) on delete cascade,
  document_type text not null check (document_type in ('receipt', 'expense_voucher')),
  document_year integer not null check (document_year >= 2000),
  last_number integer not null check (last_number > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (society_id, document_type, document_year)
);

alter table public.document_number_counters enable row level security;

create or replace function public.assign_income_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  number_year integer := extract(year from new.transaction_date)::integer;
  next_number integer;
  existing_max integer;
begin
  if nullif(btrim(new.receipt_number), '') is not null then
    return new;
  end if;

  select coalesce(max(substring(receipt_number from '([0-9]+)$')::integer), 0)
    into existing_max
  from public.income_transactions
  where society_id = new.society_id
    and receipt_number ~ ('^REC-' || number_year || '-[0-9]+$');

  insert into public.document_number_counters (society_id, document_type, document_year, last_number)
  values (new.society_id, 'receipt', number_year, existing_max + 1)
  on conflict (society_id, document_type, document_year)
  do update set last_number = public.document_number_counters.last_number + 1,
                updated_at = timezone('utc', now())
  returning last_number into next_number;

  new.receipt_number := 'REC-' || number_year || '-' || lpad(next_number::text, 4, '0');
  return new;
end;
$$;

create or replace function public.assign_expense_voucher_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  number_year integer := extract(year from new.transaction_date)::integer;
  next_number integer;
  existing_max integer;
begin
  if nullif(btrim(new.voucher_number), '') is not null then
    return new;
  end if;

  select coalesce(max(substring(voucher_number from '([0-9]+)$')::integer), 0)
    into existing_max
  from public.expense_transactions
  where society_id = new.society_id
    and voucher_number ~ ('^EXP-' || number_year || '-[0-9]+$');

  insert into public.document_number_counters (society_id, document_type, document_year, last_number)
  values (new.society_id, 'expense_voucher', number_year, existing_max + 1)
  on conflict (society_id, document_type, document_year)
  do update set last_number = public.document_number_counters.last_number + 1,
                updated_at = timezone('utc', now())
  returning last_number into next_number;

  new.voucher_number := 'EXP-' || number_year || '-' || lpad(next_number::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists income_assign_receipt_number on public.income_transactions;
create trigger income_assign_receipt_number
before insert on public.income_transactions
for each row execute function public.assign_income_receipt_number();

drop trigger if exists expense_assign_voucher_number on public.expense_transactions;
create trigger expense_assign_voucher_number
before insert on public.expense_transactions
for each row execute function public.assign_expense_voucher_number();

create unique index if not exists income_transactions_auto_receipt_unique
  on public.income_transactions (society_id, receipt_number)
  where receipt_number ~ '^REC-[0-9]{4}-[0-9]+$';

create unique index if not exists expense_transactions_voucher_unique
  on public.expense_transactions (society_id, voucher_number)
  where voucher_number is not null;

comment on column public.expense_transactions.voucher_number is
  'Society-generated expense voucher number; separate from the vendor bill number.';
