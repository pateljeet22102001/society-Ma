alter table public.income_transactions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles (id),
  add column if not exists cancellation_reason text;

alter table public.expense_transactions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles (id),
  add column if not exists cancellation_reason text;

create table if not exists public.financial_audit_logs (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('update', 'void')),
  old_values jsonb not null,
  new_values jsonb not null,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default timezone('utc', now())
);

create index if not exists financial_audit_logs_record_idx
  on public.financial_audit_logs (table_name, record_id, changed_at desc);

alter table public.financial_audit_logs enable row level security;
create policy "Society members read financial audit logs"
  on public.financial_audit_logs for select to authenticated
  using (public.is_society_member(society_id));

create or replace function public.audit_financial_record_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.financial_audit_logs
    (society_id, table_name, record_id, action, old_values, new_values, changed_by)
  values
    (new.society_id, tg_table_name, new.id,
     case when old.status = 'active' and new.status = 'inactive' then 'void' else 'update' end,
     to_jsonb(old), to_jsonb(new), auth.uid());
  return new;
end;
$$;

drop trigger if exists audit_income_transaction_changes on public.income_transactions;
create trigger audit_income_transaction_changes after update on public.income_transactions
for each row execute function public.audit_financial_record_change();

drop trigger if exists audit_expense_transaction_changes on public.expense_transactions;
create trigger audit_expense_transaction_changes after update on public.expense_transactions
for each row execute function public.audit_financial_record_change();
