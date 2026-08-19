export type EntityStatus = "active" | "inactive";
export type OccupancyType = "owner" | "tenant" | "vacant";
export type PaymentMode = "cash" | "upi" | "bank_transfer" | "cheque" | "other";
export type MaintenanceStatus = "paid" | "pending" | "partially_paid" | "overdue";
export type SocietyMemberRole =
  | "admin"
  | "chairman"
  | "treasurer"
  | "operator"
  | "viewer"
  | "auditor";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Society {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  phone: string | null;
  email: string | null;
  registration_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  upi_id: string | null;
  status: EntityStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wing {
  id: string;
  society_id: string;
  name: string;
  total_flats: number;
  description: string | null;
  status: EntityStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Flat {
  id: string;
  society_id: string;
  wing_id: string;
  flat_number: string;
  owner_name: string | null;
  resident_name: string | null;
  mobile_number: string | null;
  email: string | null;
  occupancy_type: OccupancyType;
  members_count: number;
  status: EntityStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  wing?: Wing | null;
}

export interface IncomeCategory {
  id: string;
  society_id: string | null;
  name: string;
  slug: string;
  is_system: boolean;
  status: EntityStatus;
}

export interface ExpenseCategory {
  id: string;
  society_id: string | null;
  name: string;
  slug: string;
  is_system: boolean;
  status: EntityStatus;
}

export interface IncomeTransaction {
  id: string;
  society_id: string;
  category_id: string;
  flat_id: string | null;
  transaction_date: string;
  person_name: string | null;
  amount: number;
  payment_mode: PaymentMode;
  reference_number: string | null;
  description: string | null;
  receipt_number: string | null;
  status: EntityStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: IncomeCategory | null;
  flat?: Flat | null;
}

export interface ExpenseTransaction {
  id: string;
  society_id: string;
  category_id: string;
  transaction_date: string;
  vendor_name: string | null;
  amount: number;
  payment_mode: PaymentMode;
  reference_number: string | null;
  description: string | null;
  bill_number: string | null;
  voucher_number: string | null;
  notes: string | null;
  status: EntityStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory | null;
}

export type BillingFrequencyMonths = number;

export interface MaintenanceSettings {
  id: string;
  society_id: string;
  default_amount: number;
  due_day: number;
  late_fee: number;
  billing_frequency_months: BillingFrequencyMonths;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceBill {
  id: string;
  society_id: string;
  flat_id: string;
  bill_month: number;
  bill_year: number;
  period_months: BillingFrequencyMonths;
  maintenance_amount: number;
  previous_outstanding: number;
  late_fee: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  due_date: string | null;
  payment_date: string | null;
  status: MaintenanceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  flat?: Flat | null;
}

export interface MaintenancePayment {
  id: string;
  society_id: string;
  bill_id: string;
  flat_id: string;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  reference_number: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  totalFlats: number;
  maintenanceCollected: number;
  maintenancePending: number;
  paidFlats: number;
  pendingFlats: number;
}

export interface SocietyMember {
  id: string;
  society_id: string;
  user_id: string;
  role: SocietyMemberRole;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface SocietyEvent {
  id: string; society_id: string; name: string; event_year: number;
  start_date: string | null; end_date: string | null; contribution_amount: number;
  due_date: string | null; description: string | null; status: EntityStatus;
  created_at: string; updated_at: string;
}

export interface EventFlatContribution {
  id: string; event_id: string; society_id: string; flat_id: string; amount: number;
  paid_amount: number; pending_amount: number; status: MaintenanceStatus;
  due_date: string | null; payment_date: string | null; flat?: Flat | null;
}

export interface EventContribution {
  id: string; event_id: string; society_id: string; contribution_type: "money" | "item";
  category: string; donor_name: string | null; mobile_number: string | null;
  amount: number | null; payment_mode: PaymentMode | null; item_name: string | null;
  quantity: number | null; unit: string | null; unit_price: number | null;
  total_value: number; contribution_date: string; reference_number: string | null; notes: string | null;
}

export interface EventExpense {
  id: string; event_id: string; society_id: string; category: string; vendor_name: string | null;
  amount: number; expense_date: string; payment_mode: PaymentMode;
  reference_number: string | null; notes: string | null;
}
