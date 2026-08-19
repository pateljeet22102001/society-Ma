-- Speeds up global search for flats, owners, receipts, and vendors.

create index if not exists flats_society_flat_number_idx
  on public.flats (society_id, flat_number);

create index if not exists flats_society_owner_name_idx
  on public.flats (society_id, owner_name);

create index if not exists flats_society_resident_name_idx
  on public.flats (society_id, resident_name);

create index if not exists income_transactions_society_receipt_idx
  on public.income_transactions (society_id, receipt_number);

create index if not exists expense_transactions_society_vendor_idx
  on public.expense_transactions (society_id, vendor_name);

create index if not exists expense_transactions_society_voucher_idx
  on public.expense_transactions (society_id, voucher_number);

create index if not exists maintenance_payments_society_receipt_idx
  on public.maintenance_payments (society_id, receipt_number);
