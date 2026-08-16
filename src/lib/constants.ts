export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Society Management";

export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;

export const OCCUPANCY_TYPES = [
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "vacant", label: "Vacant" },
] as const;

export const ENTITY_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export const MAINTENANCE_STATUSES = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

export const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString("en-IN", { month: "long" }),
}));

export const BILLING_FREQUENCIES = Array.from({ length: 12 }, (_, index) => {
  const months = index + 1;
  const special = months === 1 ? "Monthly" : months === 3 ? "Quarterly" : months === 6 ? "Half-Yearly" : months === 12 ? "Yearly" : "Custom";
  return { value: String(months), label: `${months} ${months === 1 ? "Month" : "Months"} (${special})`, months };
});

export function billingFrequencyLabel(months: number) {
  if (months === 3) return "Quarterly (3 months)";
  if (months === 6) return "Half-Yearly (6 months)";
  if (months === 12) return "Yearly (12 months)";
  if (months === 1) return "Monthly (1 month)";
  return `Custom (${months} months)`;
}

export const PAGE_SIZE = 10;

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/society", label: "Society", icon: "Building2" },
  { href: "/society/wings", label: "Wings", icon: "Layers" },
  { href: "/society/flats", label: "Flats", icon: "Home" },
  { href: "/income", label: "Income", icon: "TrendingUp" },
  { href: "/expenses", label: "Expenses", icon: "TrendingDown" },
  { href: "/maintenance", label: "Maintenance", icon: "Wallet" },
  { href: "/events", label: "Event Hisab", icon: "CalendarHeart" },
  { href: "/reports", label: "Reports", icon: "FileBarChart" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
