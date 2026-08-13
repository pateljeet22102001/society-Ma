-- Restore and expand standard society Aavak categories.
-- Safe to run more than once.
insert into public.income_categories (name, slug, is_system, society_id, status)
select seed.name, seed.slug, true, null, 'active'::entity_status
from (values
  ('Maintenance', 'maintenance'),
  ('Bank Interest', 'bank_interest'),
  ('Flat Transfer Fee', 'flat_transfer_fee'),
  ('Parking Charges', 'parking'),
  ('Late Payment Penalty', 'penalty'),
  ('Hall Booking', 'hall_booking'),
  ('Non-Occupancy Charges', 'non_occupancy_charges'),
  ('NOC / Document Fee', 'document_fee'),
  ('Advertisement Income', 'advertisement'),
  ('Donation', 'donation'),
  ('Scrap Sale', 'scrap_sale'),
  ('Other Income', 'other')
) as seed(name, slug)
where not exists (
  select 1 from public.income_categories existing
  where existing.society_id is null and existing.slug = seed.slug
);
