-- Support server-side pagination, filtering, sorting, and contains-search
-- for the high-growth income and expense registers.

create extension if not exists pg_trgm;

create index if not exists income_transactions_society_date_idx
  on public.income_transactions (society_id, transaction_date desc);
create index if not exists income_transactions_society_category_date_idx
  on public.income_transactions (society_id, category_id, transaction_date desc);
create index if not exists income_transactions_society_amount_idx
  on public.income_transactions (society_id, amount desc);

create index if not exists expense_transactions_society_date_idx
  on public.expense_transactions (society_id, transaction_date desc);
create index if not exists expense_transactions_society_category_date_idx
  on public.expense_transactions (society_id, category_id, transaction_date desc);
create index if not exists expense_transactions_society_amount_idx
  on public.expense_transactions (society_id, amount desc);

create index if not exists income_transactions_person_search_idx
  on public.income_transactions using gin (person_name gin_trgm_ops);
create index if not exists income_transactions_receipt_search_idx
  on public.income_transactions using gin (receipt_number gin_trgm_ops);
create index if not exists income_transactions_reference_search_idx
  on public.income_transactions using gin (reference_number gin_trgm_ops);
create index if not exists income_transactions_description_search_idx
  on public.income_transactions using gin (description gin_trgm_ops);

create index if not exists expense_transactions_vendor_search_idx
  on public.expense_transactions using gin (vendor_name gin_trgm_ops);
create index if not exists expense_transactions_voucher_search_idx
  on public.expense_transactions using gin (voucher_number gin_trgm_ops);
create index if not exists expense_transactions_bill_search_idx
  on public.expense_transactions using gin (bill_number gin_trgm_ops);
create index if not exists expense_transactions_reference_search_idx
  on public.expense_transactions using gin (reference_number gin_trgm_ops);
create index if not exists expense_transactions_description_search_idx
  on public.expense_transactions using gin (description gin_trgm_ops);
create index if not exists expense_transactions_notes_search_idx
  on public.expense_transactions using gin (notes gin_trgm_ops);
