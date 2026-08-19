-- Accelerate expanded global search across maintenance and Event Hisab.

create extension if not exists pg_trgm;

create index if not exists flats_owner_search_idx
  on public.flats using gin (owner_name gin_trgm_ops);
create index if not exists flats_resident_search_idx
  on public.flats using gin (resident_name gin_trgm_ops);
create index if not exists flats_number_search_idx
  on public.flats using gin (flat_number gin_trgm_ops);
create index if not exists maintenance_reference_search_idx
  on public.maintenance_payments using gin (reference_number gin_trgm_ops);

create index if not exists events_name_search_idx
  on public.events using gin (name gin_trgm_ops);
create index if not exists events_description_search_idx
  on public.events using gin (description gin_trgm_ops);
create index if not exists events_society_year_idx
  on public.events (society_id, event_year desc);

create index if not exists event_contributions_category_search_idx
  on public.event_contributions using gin (category gin_trgm_ops);
create index if not exists event_contributions_donor_search_idx
  on public.event_contributions using gin (donor_name gin_trgm_ops);
create index if not exists event_contributions_item_search_idx
  on public.event_contributions using gin (item_name gin_trgm_ops);
create index if not exists event_contributions_reference_search_idx
  on public.event_contributions using gin (reference_number gin_trgm_ops);

create index if not exists event_expenses_category_search_idx
  on public.event_expenses using gin (category gin_trgm_ops);
create index if not exists event_expenses_vendor_search_idx
  on public.event_expenses using gin (vendor_name gin_trgm_ops);
create index if not exists event_expenses_reference_search_idx
  on public.event_expenses using gin (reference_number gin_trgm_ops);

create index if not exists event_flat_payments_reference_search_idx
  on public.event_flat_payments using gin (reference_number gin_trgm_ops);
