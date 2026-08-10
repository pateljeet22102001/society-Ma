import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function padFlatNumber(index: number, digits = 2) {
  return String(index).padStart(digits, "0");
}

export function generateFlatNumbers(wingName: string, count: number) {
  return Array.from({ length: count }, (_, i) => `${wingName}-${padFlatNumber(i + 1)}`);
}

export function monthLabel(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString("en-IN", { month: "short" });
}

/** Returns label for a billing period starting at month/year covering periodMonths. */
export function billingPeriodLabel(month: number, year: number, periodMonths = 1) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month - 1 + periodMonths - 1, 1);
  const startText = start.toLocaleString("en-IN", { month: "short", year: "numeric" });
  if (periodMonths <= 1) return startText;
  const endText = end.toLocaleString("en-IN", { month: "short", year: "numeric" });
  return `${startText} – ${endText}`;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
