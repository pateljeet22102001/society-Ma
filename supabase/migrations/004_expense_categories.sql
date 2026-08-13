-- Restore and expand standard society Javak categories.
-- Safe to run more than once.
insert into public.expense_categories (name, slug, is_system, society_id, status)
select seed.name, seed.slug, true, null, 'active'::entity_status
from (values
  ('Electricity', 'electricity'), ('Water', 'water'), ('Security', 'security'),
  ('Cleaning', 'cleaning'), ('Lift Maintenance', 'lift_maintenance'),
  ('Building Repair', 'building_repair'), ('Plumbing', 'plumbing'),
  ('Garden Maintenance', 'garden'), ('Staff Salary', 'salary'),
  ('Office Expense', 'office_expense'), ('Insurance', 'insurance'),
  ('Property Tax', 'property_tax'), ('Legal / Professional Fee', 'professional_fee'),
  ('Pest Control', 'pest_control'), ('Fire Safety', 'fire_safety'),
  ('Generator / Diesel', 'generator'), ('Other Expense', 'other')
) as seed(name, slug)
where not exists (
  select 1 from public.expense_categories existing
  where existing.society_id is null and existing.slug = seed.slug
);
