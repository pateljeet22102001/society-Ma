import type { PaymentMode, Society } from "@/types/database";
import { PAYMENT_MODES } from "@/lib/constants";

export type PrintSlipType = "income_receipt" | "expense_voucher" | "maintenance_receipt";

export interface PrintSlipData {
  type: PrintSlipType;
  documentNumber: string;
  date: string;
  amount: number;
  paymentMode: PaymentMode | string;
  partyName?: string | null;
  flatNumber?: string | null;
  category?: string | null;
  description?: string | null;
  referenceNumber?: string | null;
  periodLabel?: string | null;
  billNumber?: string | null;
}

export function paymentModeLabel(mode: string) {
  return PAYMENT_MODES.find((item) => item.value === mode)?.label || mode.replaceAll("_", " ");
}

export function societyAddressLine(society: Society | null | undefined) {
  if (!society) return "";
  return [society.address, society.city, society.state, society.pin_code].filter(Boolean).join(", ");
}

export function slipTitle(type: PrintSlipType) {
  if (type === "expense_voucher") return "Payment Voucher";
  if (type === "maintenance_receipt") return "Maintenance Receipt";
  return "Payment Receipt";
}
