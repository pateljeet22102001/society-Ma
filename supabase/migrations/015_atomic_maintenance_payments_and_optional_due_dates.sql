-- Keep maintenance payments, bill balances, and mirrored income atomic.
-- Existing societies continue using due dates unless they explicitly disable them.

alter table public.maintenance_settings
  add column if not exists use_due_date boolean not null default true;

comment on column public.maintenance_settings.use_due_date is
  'When false, newly generated maintenance bills have no due date or late fee.';

create or replace function public.record_maintenance_payment(
  p_society_id uuid,
  p_bill_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_mode public.payment_mode,
  p_reference_number text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_bill public.maintenance_bills%rowtype;
  new_payment public.maintenance_payments%rowtype;
  maintenance_category_id uuid;
  payer_name text;
  payer_flat_number text;
  new_paid numeric(12, 2);
  new_pending numeric(12, 2);
  new_status public.maintenance_status;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if not public.has_society_role(p_society_id, array['admin', 'chairman', 'treasurer', 'operator']) then
    raise exception 'Forbidden';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select * into target_bill
  from public.maintenance_bills
  where id = p_bill_id and society_id = p_society_id
  for update;

  if not found then raise exception 'Maintenance bill not found'; end if;
  if target_bill.pending_amount <= 0 then raise exception 'This bill has no pending balance'; end if;
  if p_amount > target_bill.pending_amount then raise exception 'Payment exceeds pending amount'; end if;

  insert into public.maintenance_payments (
    society_id, bill_id, flat_id, amount, payment_date, payment_mode,
    reference_number, notes, created_by
  ) values (
    p_society_id, target_bill.id, target_bill.flat_id, p_amount,
    p_payment_date, p_payment_mode, nullif(btrim(p_reference_number), ''),
    nullif(btrim(p_notes), ''), auth.uid()
  ) returning * into new_payment;

  new_paid := target_bill.paid_amount + p_amount;
  new_pending := greatest(target_bill.total_amount - new_paid, 0);
  new_status := case
    when new_paid >= target_bill.total_amount then 'paid'::public.maintenance_status
    when new_paid > 0 then 'partially_paid'::public.maintenance_status
    when target_bill.due_date is not null and target_bill.due_date < current_date
      then 'overdue'::public.maintenance_status
    else 'pending'::public.maintenance_status
  end;

  update public.maintenance_bills
  set paid_amount = new_paid, pending_amount = new_pending,
      payment_date = p_payment_date, status = new_status
  where id = target_bill.id and society_id = p_society_id;

  select id into maintenance_category_id
  from public.income_categories
  where slug = 'maintenance' and society_id is null
  limit 1;
  if maintenance_category_id is null then
    raise exception 'Maintenance income category is not configured';
  end if;

  select coalesce(owner_name, resident_name, 'Maintenance payment'), flat_number
  into payer_name, payer_flat_number
  from public.flats
  where id = target_bill.flat_id and society_id = p_society_id;

  insert into public.income_transactions (
    society_id, category_id, flat_id, transaction_date, person_name, amount,
    payment_mode, reference_number, description, receipt_number, created_by
  ) values (
    p_society_id, maintenance_category_id, target_bill.flat_id, p_payment_date,
    coalesce(payer_name, 'Maintenance payment'), p_amount, p_payment_mode,
    nullif(btrim(p_reference_number), ''),
    'Maintenance ' || target_bill.bill_month || '/' || target_bill.bill_year,
    new_payment.receipt_number, auth.uid()
  );

  return jsonb_build_object(
    'id', new_payment.id, 'receipt_number', new_payment.receipt_number,
    'payment_date', new_payment.payment_date, 'amount', new_payment.amount,
    'payment_mode', new_payment.payment_mode,
    'reference_number', new_payment.reference_number,
    'flat_number', payer_flat_number,
    'party_name', coalesce(payer_name, 'Maintenance payment')
  );
end;
$$;

revoke all on function public.record_maintenance_payment(
  uuid, uuid, numeric, date, public.payment_mode, text, text
) from public;
grant execute on function public.record_maintenance_payment(
  uuid, uuid, numeric, date, public.payment_mode, text, text
) to authenticated;
