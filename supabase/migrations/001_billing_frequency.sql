-- Add maintenance billing frequency support (1 / 3 / 6 months)
-- Run this in Supabase SQL Editor

alter table public.maintenance_settings
  add column if not exists billing_frequency_months integer not null default 1
  check (billing_frequency_months in (1, 3, 6));

alter table public.maintenance_bills
  add column if not exists period_months integer not null default 1
  check (period_months in (1, 3, 6));

comment on column public.maintenance_settings.billing_frequency_months is
  '1 = monthly, 3 = quarterly, 6 = half-yearly';

comment on column public.maintenance_bills.period_months is
  'Number of months covered by this bill';
