-- Aggregate dashboard totals inside Postgres so the application does not
-- transfer complete financial ledgers on every dashboard visit.

create or replace function public.get_dashboard_summary(p_society_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  total_income numeric := 0;
  total_expense numeric := 0;
  total_flats bigint := 0;
  maintenance_collected numeric := 0;
  maintenance_pending numeric := 0;
  maintenance_overdue numeric := 0;
  maintenance_current_pending numeric := 0;
  paid_flats bigint := 0;
  pending_flats bigint := 0;
  monthly_chart jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_society_member(p_society_id) then
    raise exception 'Forbidden';
  end if;

  select coalesce(sum(amount), 0)
  into total_income
  from public.income_transactions
  where society_id = p_society_id and status = 'active';

  select coalesce(sum(amount), 0)
  into total_expense
  from public.expense_transactions
  where society_id = p_society_id and status = 'active';

  select count(*) into total_flats
  from public.flats
  where society_id = p_society_id;

  select
    coalesce(sum(paid_amount), 0),
    coalesce(sum(pending_amount), 0),
    coalesce(sum(pending_amount) filter (where status = 'overdue'), 0),
    coalesce(sum(pending_amount) filter (where status in ('pending', 'partially_paid')), 0),
    count(distinct flat_id) filter (where status = 'paid'),
    count(distinct flat_id) filter (where status in ('pending', 'partially_paid', 'overdue'))
  into maintenance_collected, maintenance_pending, maintenance_overdue,
       maintenance_current_pending, paid_flats, pending_flats
  from public.maintenance_bills
  where society_id = p_society_id;

  with months as (
    select generate_series(
      date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  income_months as (
    select date_trunc('month', transaction_date)::date as month_start,
           sum(amount) as amount
    from public.income_transactions
    where society_id = p_society_id
      and status = 'active'
      and transaction_date >= date_trunc('month', current_date) - interval '5 months'
    group by 1
  ),
  expense_months as (
    select date_trunc('month', transaction_date)::date as month_start,
           sum(amount) as amount
    from public.expense_transactions
    where society_id = p_society_id
      and status = 'active'
      and transaction_date >= date_trunc('month', current_date) - interval '5 months'
    group by 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', to_char(months.month_start, 'Mon'),
        'income', coalesce(income_months.amount, 0),
        'expense', coalesce(expense_months.amount, 0)
      ) order by months.month_start
    ),
    '[]'::jsonb
  )
  into monthly_chart
  from months
  left join income_months using (month_start)
  left join expense_months using (month_start);

  return jsonb_build_object(
    'totalIncome', total_income,
    'totalExpense', total_expense,
    'totalFlats', total_flats,
    'maintenanceCollected', maintenance_collected,
    'maintenancePending', maintenance_pending,
    'paidFlats', paid_flats,
    'pendingFlats', pending_flats,
    'monthlyChart', monthly_chart,
    'maintenanceChart', jsonb_build_object(
      'collected', maintenance_collected,
      'pending', maintenance_current_pending,
      'overdue', maintenance_overdue
    )
  );
end;
$$;

revoke all on function public.get_dashboard_summary(uuid) from public;
grant execute on function public.get_dashboard_summary(uuid) to authenticated;
