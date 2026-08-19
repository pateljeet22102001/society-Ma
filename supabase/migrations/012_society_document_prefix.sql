-- Add society-branded document numbers without changing historical numbers.
-- Examples: Shreenath Park Society -> SPS-REC-2026-00001
--           Sharthak Shreeji 2     -> SS2-VOU-2026-00001

alter table public.societies
  add column if not exists document_prefix text;

create or replace function public.society_document_prefix(society_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    coalesce(
      nullif(
        string_agg(
          case
            when word ~ '^[0-9]+$' then word
            else left(word, 1)
          end,
          '' order by position
        ),
        ''
      ),
      'SOC'
    ),
    10
  )
  from (
    select upper(match[1]) as word, ordinality as position
    from regexp_matches(coalesce(society_name, ''), '([[:alnum:]]+)', 'g')
      with ordinality as matches(match, ordinality)
  ) words;
$$;

update public.societies
set document_prefix = public.society_document_prefix(name)
where nullif(btrim(document_prefix), '') is null;

alter table public.societies
  alter column document_prefix set not null,
  alter column document_prefix set default 'SOC',
  add constraint societies_document_prefix_format
    check (document_prefix ~ '^[A-Z0-9]{1,10}$');

create or replace function public.normalize_society_document_prefix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.document_prefix := upper(regexp_replace(coalesce(new.document_prefix, ''), '[^[:alnum:]]', '', 'g'));
  if nullif(new.document_prefix, '') is null or (tg_op = 'INSERT' and new.document_prefix = 'SOC') then
    new.document_prefix := public.society_document_prefix(new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists societies_normalize_document_prefix on public.societies;
create trigger societies_normalize_document_prefix
before insert or update of name, document_prefix on public.societies
for each row execute function public.normalize_society_document_prefix();

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
  society_prefix text;
begin
  if nullif(btrim(new.receipt_number), '') is not null then return new; end if;

  select document_prefix into society_prefix
  from public.societies where id = new.society_id;

  select coalesce(max(substring(receipt_number from '([0-9]+)$')::integer), 0)
    into existing_max
  from public.income_transactions
  where society_id = new.society_id
    and extract(year from transaction_date)::integer = number_year;

  insert into public.document_number_counters (society_id, document_type, document_year, last_number)
  values (new.society_id, 'receipt', number_year, existing_max + 1)
  on conflict (society_id, document_type, document_year)
  do update set last_number = public.document_number_counters.last_number + 1,
                updated_at = timezone('utc', now())
  returning last_number into next_number;

  new.receipt_number := coalesce(society_prefix, 'SOC') || '-REC-' || number_year || '-' || lpad(next_number::text, 5, '0');
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
  society_prefix text;
begin
  if nullif(btrim(new.voucher_number), '') is not null then return new; end if;

  select document_prefix into society_prefix
  from public.societies where id = new.society_id;

  select coalesce(max(substring(voucher_number from '([0-9]+)$')::integer), 0)
    into existing_max
  from public.expense_transactions
  where society_id = new.society_id
    and extract(year from transaction_date)::integer = number_year;

  insert into public.document_number_counters (society_id, document_type, document_year, last_number)
  values (new.society_id, 'expense_voucher', number_year, existing_max + 1)
  on conflict (society_id, document_type, document_year)
  do update set last_number = public.document_number_counters.last_number + 1,
                updated_at = timezone('utc', now())
  returning last_number into next_number;

  new.voucher_number := coalesce(society_prefix, 'SOC') || '-VOU-' || number_year || '-' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

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
  society_prefix text;
begin
  if nullif(btrim(new.receipt_number), '') is not null then return new; end if;

  select document_prefix into society_prefix
  from public.societies where id = new.society_id;

  select coalesce(max(substring(receipt_number from '([0-9]+)$')::integer), 0)
    into existing_max
  from public.maintenance_payments
  where society_id = new.society_id
    and extract(year from payment_date)::integer = number_year;

  insert into public.document_number_counters (society_id, document_type, document_year, last_number)
  values (new.society_id, 'maintenance_receipt', number_year, existing_max + 1)
  on conflict (society_id, document_type, document_year)
  do update set last_number = public.document_number_counters.last_number + 1,
                updated_at = timezone('utc', now())
  returning last_number into next_number;

  new.receipt_number := coalesce(society_prefix, 'SOC') || '-MNT-' || number_year || '-' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

create unique index if not exists income_transactions_branded_receipt_unique
  on public.income_transactions (society_id, receipt_number)
  where receipt_number ~ '^[A-Z0-9]{1,10}-REC-[0-9]{4}-[0-9]+$';

create unique index if not exists maintenance_payments_branded_receipt_unique
  on public.maintenance_payments (society_id, receipt_number)
  where receipt_number ~ '^[A-Z0-9]{1,10}-MNT-[0-9]{4}-[0-9]+$';

comment on column public.societies.document_prefix is
  'Uppercase society code used for newly generated receipt and voucher numbers.';
