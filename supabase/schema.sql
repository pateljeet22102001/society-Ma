-- Society Management System - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type occupancy_type as enum ('owner', 'tenant', 'vacant');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type entity_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_mode as enum ('cash', 'upi', 'bank_transfer', 'cheque', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type maintenance_status as enum ('paid', 'pending', 'partially_paid', 'overdue');
exception when duplicate_object then null;
end $$;

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text not null default 'admin',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Societies
create table if not exists public.societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  city text,
  state text,
  pin_code text,
  phone text,
  email text,
  registration_number text,
  bank_name text,
  account_number text,
  ifsc text,
  upi_id text,
  status entity_status not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger societies_set_updated_at
before update on public.societies
for each row execute function public.set_updated_at();

-- Wings
create table if not exists public.wings (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  name text not null,
  total_flats integer not null default 0 check (total_flats >= 0),
  description text,
  status entity_status not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (society_id, name)
);

create trigger wings_set_updated_at
before update on public.wings
for each row execute function public.set_updated_at();

-- Flats
create table if not exists public.flats (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  wing_id uuid not null references public.wings (id) on delete cascade,
  flat_number text not null,
  owner_name text,
  resident_name text,
  mobile_number text,
  email text,
  occupancy_type occupancy_type not null default 'vacant',
  members_count integer not null default 0 check (members_count >= 0),
  status entity_status not null default 'active',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (society_id, flat_number)
);

create index if not exists flats_wing_id_idx on public.flats (wing_id);
create index if not exists flats_society_id_idx on public.flats (society_id);

create trigger flats_set_updated_at
before update on public.flats
for each row execute function public.set_updated_at();

-- Income categories
create table if not exists public.income_categories (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies (id) on delete cascade,
  name text not null,
  slug text not null,
  is_system boolean not null default false,
  status entity_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (society_id, slug)
);

create trigger income_categories_set_updated_at
before update on public.income_categories
for each row execute function public.set_updated_at();

-- Expense categories
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies (id) on delete cascade,
  name text not null,
  slug text not null,
  is_system boolean not null default false,
  status entity_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (society_id, slug)
);

create trigger expense_categories_set_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

-- Income transactions
create table if not exists public.income_transactions (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  category_id uuid not null references public.income_categories (id),
  flat_id uuid references public.flats (id) on delete set null,
  transaction_date date not null default current_date,
  person_name text,
  amount numeric(12, 2) not null check (amount > 0),
  payment_mode payment_mode not null default 'cash',
  reference_number text,
  description text,
  receipt_number text,
  status entity_status not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists income_transactions_society_date_idx
  on public.income_transactions (society_id, transaction_date desc);

create trigger income_transactions_set_updated_at
before update on public.income_transactions
for each row execute function public.set_updated_at();

-- Expense transactions
create table if not exists public.expense_transactions (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id),
  transaction_date date not null default current_date,
  vendor_name text,
  amount numeric(12, 2) not null check (amount > 0),
  payment_mode payment_mode not null default 'cash',
  reference_number text,
  description text,
  bill_number text,
  notes text,
  status entity_status not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists expense_transactions_society_date_idx
  on public.expense_transactions (society_id, transaction_date desc);

create trigger expense_transactions_set_updated_at
before update on public.expense_transactions
for each row execute function public.set_updated_at();

-- Maintenance settings
create table if not exists public.maintenance_settings (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null unique references public.societies (id) on delete cascade,
  default_amount numeric(12, 2) not null default 1500 check (default_amount >= 0),
  due_day integer not null default 10 check (due_day between 1 and 28),
  late_fee numeric(12, 2) not null default 0 check (late_fee >= 0),
  billing_frequency_months integer not null default 1 check (billing_frequency_months between 1 and 12),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger maintenance_settings_set_updated_at
before update on public.maintenance_settings
for each row execute function public.set_updated_at();

-- Maintenance bills (monthly flat-wise)
create table if not exists public.maintenance_bills (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  flat_id uuid not null references public.flats (id) on delete cascade,
  bill_month integer not null check (bill_month between 1 and 12),
  bill_year integer not null check (bill_year >= 2000),
  period_months integer not null default 1 check (period_months between 1 and 12),
  maintenance_amount numeric(12, 2) not null check (maintenance_amount >= 0),
  previous_outstanding numeric(12, 2) not null default 0 check (previous_outstanding >= 0),
  late_fee numeric(12, 2) not null default 0 check (late_fee >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  pending_amount numeric(12, 2) not null default 0 check (pending_amount >= 0),
  due_date date,
  payment_date date,
  status maintenance_status not null default 'pending',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (flat_id, bill_month, bill_year)
);

create index if not exists maintenance_bills_society_period_idx
  on public.maintenance_bills (society_id, bill_year, bill_month);

create trigger maintenance_bills_set_updated_at
before update on public.maintenance_bills
for each row execute function public.set_updated_at();

-- Maintenance payments (history / partial payments)
create table if not exists public.maintenance_payments (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  bill_id uuid not null references public.maintenance_bills (id) on delete cascade,
  flat_id uuid not null references public.flats (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_mode payment_mode not null default 'cash',
  reference_number text,
  receipt_number text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists maintenance_payments_bill_id_idx
  on public.maintenance_payments (bill_id);

create trigger maintenance_payments_set_updated_at
before update on public.maintenance_payments
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Seed default categories (society_id null = global system defaults)
insert into public.income_categories (name, slug, is_system, society_id)
values
  ('Maintenance', 'maintenance', true, null),
  ('Parking', 'parking', true, null),
  ('Donation', 'donation', true, null),
  ('Penalty', 'penalty', true, null),
  ('Interest', 'interest', true, null),
  ('Hall Booking', 'hall_booking', true, null),
  ('Other', 'other', true, null)
on conflict do nothing;

insert into public.expense_categories (name, slug, is_system, society_id)
values
  ('Electricity', 'electricity', true, null),
  ('Water', 'water', true, null),
  ('Security', 'security', true, null),
  ('Cleaning', 'cleaning', true, null),
  ('Lift Maintenance', 'lift_maintenance', true, null),
  ('Repair', 'repair', true, null),
  ('Plumbing', 'plumbing', true, null),
  ('Garden', 'garden', true, null),
  ('Festival', 'festival', true, null),
  ('Salary', 'salary', true, null),
  ('Office Expense', 'office_expense', true, null),
  ('Other', 'other', true, null)
on conflict do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.societies enable row level security;
alter table public.wings enable row level security;
alter table public.flats enable row level security;
alter table public.income_categories enable row level security;
alter table public.expense_categories enable row level security;
alter table public.income_transactions enable row level security;
alter table public.expense_transactions enable row level security;
alter table public.maintenance_settings enable row level security;
alter table public.maintenance_bills enable row level security;
alter table public.maintenance_payments enable row level security;

-- Authenticated users can manage data (single-society admin app for Phase 1)
create policy "Authenticated read profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create policy "Authenticated full access societies"
  on public.societies for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access wings"
  on public.wings for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access flats"
  on public.flats for all to authenticated
  using (true) with check (true);

create policy "Authenticated read income categories"
  on public.income_categories for select to authenticated
  using (true);

create policy "Authenticated manage income categories"
  on public.income_categories for all to authenticated
  using (true) with check (true);

create policy "Authenticated read expense categories"
  on public.expense_categories for select to authenticated
  using (true);

create policy "Authenticated manage expense categories"
  on public.expense_categories for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access income"
  on public.income_transactions for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access expenses"
  on public.expense_transactions for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access maintenance settings"
  on public.maintenance_settings for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access maintenance bills"
  on public.maintenance_bills for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access maintenance payments"
  on public.maintenance_payments for all to authenticated
  using (true) with check (true);

-- Storage bucket for society logos (run once)
insert into storage.buckets (id, name, public)
values ('society-assets', 'society-assets', true)
on conflict (id) do nothing;

create policy "Authenticated upload society assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'society-assets');

create policy "Public read society assets"
  on storage.objects for select to public
  using (bucket_id = 'society-assets');

create policy "Authenticated update society assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'society-assets');

create policy "Authenticated delete society assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'society-assets');
