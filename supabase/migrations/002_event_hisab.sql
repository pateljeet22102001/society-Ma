-- Event Hisab: event-wise flat contributions, money/item Aavak, and Javak
-- Run this file in the Supabase SQL Editor before opening /events.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  name text not null,
  event_year integer not null check (event_year >= 2000),
  start_date date,
  end_date date,
  contribution_amount numeric(12,2) not null default 0 check (contribution_amount >= 0),
  due_date date,
  description text,
  status entity_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (society_id, name, event_year)
);

create table if not exists public.event_flat_contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null references public.flats(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  pending_amount numeric(12,2) not null default 0 check (pending_amount >= 0),
  status maintenance_status not null default 'pending',
  due_date date,
  payment_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, flat_id)
);

create table if not exists public.event_flat_payments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.event_flat_contributions(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null references public.flats(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_mode payment_mode not null default 'cash',
  reference_number text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  society_id uuid not null references public.societies(id) on delete cascade,
  contribution_type text not null check (contribution_type in ('money','item')),
  category text not null,
  donor_name text,
  mobile_number text,
  amount numeric(12,2) check (amount is null or amount > 0),
  payment_mode payment_mode,
  item_name text,
  quantity numeric(12,3) check (quantity is null or quantity > 0),
  unit text,
  unit_price numeric(12,2) check (unit_price is null or unit_price >= 0),
  total_value numeric(12,2) not null default 0 check (total_value >= 0),
  contribution_date date not null default current_date,
  reference_number text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  society_id uuid not null references public.societies(id) on delete cascade,
  category text not null,
  vendor_name text,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_mode payment_mode not null default 'cash',
  reference_number text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists event_flat_contributions_event_idx on public.event_flat_contributions(event_id);
create index if not exists event_contributions_event_idx on public.event_contributions(event_id);
create index if not exists event_expenses_event_idx on public.event_expenses(event_id);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists event_flat_contributions_set_updated_at on public.event_flat_contributions;
create trigger event_flat_contributions_set_updated_at before update on public.event_flat_contributions for each row execute function public.set_updated_at();
drop trigger if exists event_contributions_set_updated_at on public.event_contributions;
create trigger event_contributions_set_updated_at before update on public.event_contributions for each row execute function public.set_updated_at();
drop trigger if exists event_expenses_set_updated_at on public.event_expenses;
create trigger event_expenses_set_updated_at before update on public.event_expenses for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.event_flat_contributions enable row level security;
alter table public.event_flat_payments enable row level security;
alter table public.event_contributions enable row level security;
alter table public.event_expenses enable row level security;

create policy "Authenticated full access events" on public.events for all to authenticated using (true) with check (true);
create policy "Authenticated full access event flat contributions" on public.event_flat_contributions for all to authenticated using (true) with check (true);
create policy "Authenticated full access event flat payments" on public.event_flat_payments for all to authenticated using (true) with check (true);
create policy "Authenticated full access event contributions" on public.event_contributions for all to authenticated using (true) with check (true);
create policy "Authenticated full access event expenses" on public.event_expenses for all to authenticated using (true) with check (true);
