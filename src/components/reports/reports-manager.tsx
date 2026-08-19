"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { Society } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type IncomeRow = { transaction_date: string; amount: number; person_name: string | null; payment_mode: string; reference_number: string | null; description: string | null; receipt_number: string | null; category: { name: string; slug: string } | null; flat: { flat_number: string; wing: { name: string } | null } | null };
type ExpenseRow = { transaction_date: string; amount: number; vendor_name: string | null; payment_mode: string; reference_number: string | null; description: string | null; notes: string | null; bill_number: string | null; voucher_number: string | null; category: { name: string } | null };
type MaintenanceRow = { bill_month: number; bill_year: number; period_months: number; total_amount: number; paid_amount: number; pending_amount: number; status: string; due_date: string | null; payment_date: string | null; flat: { flat_number: string; owner_name: string | null; wing: { name: string } | null } | null };
type CashPayment = { payment_date: string; amount: number; payment_mode: string; reference_number: string | null; notes?: string | null; flat: { flat_number: string; wing: { name: string } | null } | null; event_id?: string };
type EventInfo = { id: string; name: string; event_year: number };
type EventFlatContributionRow = { event_id: string; amount: number; paid_amount: number; pending_amount: number; status: string; due_date: string | null; payment_date: string | null; flat: { flat_number: string; owner_name: string | null } | null };
type EventAavak = { event_id: string; contribution_type: "money" | "item"; category: string; donor_name: string | null; amount: number | null; item_name: string | null; quantity: number | null; unit: string | null; total_value: number; contribution_date: string; payment_mode: string | null; reference_number: string | null };
type EventExpenseRow = { event_id: string; category: string; vendor_name: string | null; amount: number; expense_date: string; payment_mode: string; reference_number: string | null };
type ReportKey = "income" | "expense" | "maintenance" | "pending" | "monthly" | "yearly" | `event:${string}`;
type ExportReport = { title: string; subtitle: string; headers: string[]; rows: (string | number)[][]; totalLabel: string; total: number };
type ReportFilters = { period: "financial_year" | "custom" | "all_time"; financialYear: number; from: string; to: string; wing: string; flat: string; category: string; status: string; detail: "detailed" | "summary"; openingBalance: number };

const monthName = (month: number) => new Date(2000, month - 1).toLocaleString("en-IN", { month: "short" });
const dateText = (date?: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN") : "-";
const amount = (value: number) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isSummaryRow = (row: (string | number)[]) => row.some((cell) => String(cell).toUpperCase() === "SUMMARY");
const reportPeriod = (period: ReportFilters["period"], label: string, from: string, to: string) => period === "all_time" ? "All-time records" : period === "custom" ? `${dateText(from)} to ${dateText(to)}` : `Financial Year ${label}`;
const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const xmlText = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function ReportsManager({ society, income, expenses, maintenance, maintenancePayments, events, eventFlatContributions, eventFlatPayments, eventAavak, eventExpenses }: { society: Society | null; income: IncomeRow[]; expenses: ExpenseRow[]; maintenance: MaintenanceRow[]; maintenancePayments: CashPayment[]; events: EventInfo[]; eventFlatContributions: EventFlatContributionRow[]; eventFlatPayments: CashPayment[]; eventAavak: EventAavak[]; eventExpenses: EventExpenseRow[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const now = new Date();
  const currentFinancialYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFilters: ReportFilters = { period: "financial_year", financialYear: currentFinancialYear, from: `${currentFinancialYear}-04-01`, to: `${currentFinancialYear + 1}-03-31`, wing: "", flat: "", category: "", status: "", detail: "detailed", openingBalance: 0 };
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [draft, setDraft] = useState<ReportFilters>(defaultFilters);
  const financialYearStart = filters.financialYear;
  const financialYearLabel = `${financialYearStart}-${String(financialYearStart + 1).slice(-2)}`;
  const financialYearFrom = filters.period === "custom" ? filters.from : `${financialYearStart}-04-01`;
  const financialYearTo = filters.period === "custom" ? filters.to : `${financialYearStart + 1}-03-31`;
  const inFinancialYear = (date: string) => filters.period === "all_time" || (date >= financialYearFrom && date <= financialYearTo);
  const matchesFlat = (flat?: { flat_number: string; wing?: { name: string } | null } | null) => (!filters.flat || flat?.flat_number === filters.flat) && (!filters.wing || flat?.wing?.name === filters.wing);
  const regularIncome = income.filter((row) => row.category?.slug !== "maintenance" && inFinancialYear(row.transaction_date) && matchesFlat(row.flat) && (!filters.category || filters.category === `income:${row.category?.name}`));
  const reportExpenses = expenses.filter((row) => inFinancialYear(row.transaction_date) && (!filters.category || filters.category === `expense:${row.category?.name}`));
  const reportMaintenancePayments = maintenancePayments.filter((row) => inFinancialYear(row.payment_date) && matchesFlat(row.flat) && (!filters.category || filters.category === "maintenance"));
  const incomeTotal = regularIncome.reduce((sum, row) => sum + Number(row.amount), 0) + reportMaintenancePayments.reduce((sum, row) => sum + Number(row.amount), 0);
  const expenseTotal = reportExpenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const yearBills = maintenance.filter((row) => inFinancialYear(`${row.bill_year}-${String(row.bill_month).padStart(2, "0")}-01`) && matchesFlat(row.flat) && (!filters.status || row.status === filters.status) && (!filters.category || filters.category === "maintenance"));
  const collected = reportMaintenancePayments.reduce((sum, row) => sum + Number(row.amount), 0);
  const pending = yearBills.reduce((sum, row) => sum + Number(row.pending_amount), 0);

  function makeReport(key: ReportKey): ExportReport {
    if (key.startsWith("event:")) {
      const eventId = key.slice(6); const event = events.find((item) => item.id === eventId);
      const flatRows = eventFlatContributions.filter((item) => item.event_id === eventId);
      const payments = eventFlatPayments.filter((item) => item.event_id === eventId);
      const cash = eventAavak.filter((item) => item.event_id === eventId && item.contribution_type === "money");
      const items = eventAavak.filter((item) => item.event_id === eventId && item.contribution_type === "item");
      const javak = eventExpenses.filter((item) => item.event_id === eventId);
      const flatCollected = payments.reduce((sum, item) => sum + Number(item.amount), 0);
      const cashDonations = cash.reduce((sum, item) => sum + Number(item.amount), 0);
      const expensesTotal = javak.reduce((sum, item) => sum + Number(item.amount), 0);
      const pendingTotal = flatRows.reduce((sum, item) => sum + Number(item.pending_amount), 0);
      const itemValue = items.reduce((sum, item) => sum + Number(item.total_value), 0);
      const rows: (string | number)[][] = [
        ["SUMMARY", "Flat contributions collected", "-", "-", "-", amount(flatCollected)],
        ["SUMMARY", "Other cash Aavak", "-", "-", "-", amount(cashDonations)],
        ["SUMMARY", "Event Javak", "-", "-", "-", amount(expensesTotal)],
        ["SUMMARY", "Pending from flats", "-", "-", "-", amount(pendingTotal)],
        ["SUMMARY", "Donated item value (non-cash)", "-", "-", "-", amount(itemValue)],
        ...flatRows.map((r) => ["FLAT", `${r.flat?.flat_number || "-"} - ${r.flat?.owner_name || "-"}`, r.status.replaceAll("_", " "), dateText(r.payment_date || r.due_date), `Paid ${amount(r.paid_amount)} / Pending ${amount(r.pending_amount)}`, amount(r.amount)]),
        ...payments.map((r) => ["FLAT PAYMENT", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), dateText(r.payment_date), r.reference_number || "-", amount(r.amount)]),
        ...cash.map((r) => ["CASH AAVAK", r.category, r.donor_name || "Anonymous", dateText(r.contribution_date), r.payment_mode?.replaceAll("_", " ") || "-", amount(Number(r.amount))]),
        ...items.map((r) => ["ITEM DONATION", r.item_name || r.category, r.donor_name || "Anonymous", dateText(r.contribution_date), `${r.quantity || 0} ${r.unit || ""}`, amount(r.total_value)]),
        ...javak.map((r) => ["JAVAK", r.category, r.vendor_name || "-", dateText(r.expense_date), r.payment_mode.replaceAll("_", " "), amount(r.amount)]),
      ];
      return { title: `${event?.name || "Event"} ${event?.event_year || ""} Hisab`, subtitle: `Separate event report | Pending INR ${amount(pendingTotal)} | Item value INR ${amount(itemValue)}`, headers: ["Type", "Details", "Person / Status", "Date", "Information", "Value (INR)"], rows, totalLabel: "Event Cash Balance", total: flatCollected + cashDonations - expensesTotal };
    }
    if (key === "income") {
      const categories = new Map<string, number>();
      regularIncome.forEach((r) => categories.set(r.category?.name || "Other Income", (categories.get(r.category?.name || "Other Income") || 0) + Number(r.amount)));
      categories.set("Maintenance Collection", reportMaintenancePayments.reduce((sum, r) => sum + Number(r.amount), 0));
      const rows: (string | number)[][] = [
        ...[...categories.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, total]) => ["SUMMARY", "Category subtotal", name, "-", "-", "-", "-", amount(total)]),
        ...regularIncome.map((r) => [dateText(r.transaction_date), "Regular Aavak", r.category?.name || "-", r.person_name || "-", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.receipt_number || r.reference_number || "-", amount(r.amount)]),
        ...reportMaintenancePayments.map((r) => [dateText(r.payment_date), "Maintenance", "Maintenance payment", "Society member", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.reference_number || "-", amount(r.amount)]),
      ];
      return { title: "Society Aavak Report (Unaudited)", subtitle: "Category summary and complete receipts; event accounts reported separately", headers: ["Date", "Source", "Category", "Person", "Flat", "Mode", "Receipt / Ref", "Amount (INR)"], rows, totalLabel: "Total Society Aavak", total: incomeTotal };
    }
    if (key === "expense") {
      const categories = new Map<string, number>(); reportExpenses.forEach((r) => categories.set(r.category?.name || "Other Expense", (categories.get(r.category?.name || "Other Expense") || 0) + Number(r.amount)));
      const rows: (string | number)[][] = [
        ...[...categories.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, total]) => ["SUMMARY", "Category subtotal", name, "-", "-", "-", "-", amount(total)]),
        ...reportExpenses.map((r) => [dateText(r.transaction_date), "Society Javak", r.category?.name || "-", r.vendor_name || "-", r.description || r.notes || "-", r.payment_mode.replaceAll("_", " "), r.voucher_number || r.bill_number || r.reference_number || "-", amount(r.amount)]),
      ];
      return { title: "Society Javak Report (Unaudited)", subtitle: "Category summary and complete payments; event accounts reported separately", headers: ["Date", "Source", "Category", "Paid To", "Particulars", "Mode", "Bill / Ref", "Amount (INR)"], rows, totalLabel: "Total Society Javak", total: expenseTotal };
    }
    if (key === "maintenance" || key === "pending") {
      const source = key === "pending" ? yearBills.filter((r) => Number(r.pending_amount) > 0) : yearBills.filter((r) => Number(r.paid_amount) > 0);
      const wingTotals = new Map<string, number>(); source.forEach((r) => { const wing = r.flat?.wing?.name || "No Wing"; const value = key === "pending" ? Number(r.pending_amount) : Number(r.paid_amount); wingTotals.set(wing, (wingTotals.get(wing) || 0) + value); });
      const rows: (string | number)[][] = [
        ...[...wingTotals.entries()].map(([wing, total]) => ["SUMMARY", "-", wing, "Wing subtotal", "-", "-", "-", "-", key === "pending" ? "-" : amount(total), key === "pending" ? amount(total) : "-"]),
        ...source.map((r) => [r.flat?.flat_number || "-", r.flat?.owner_name || "-", r.flat?.wing?.name || "-", `${monthName(r.bill_month)} ${r.bill_year}${r.period_months > 1 ? ` (${r.period_months} months)` : ""}`, dateText(r.due_date), dateText(r.payment_date), r.status.replaceAll("_", " "), amount(r.total_amount), amount(r.paid_amount), amount(r.pending_amount)]),
      ];
      return { title: key === "pending" ? "Pending Maintenance Report (Unaudited)" : "Maintenance Collection Report (Unaudited)", subtitle: `Financial Year ${financialYearLabel} wing and flat-wise details`, headers: ["Flat", "Owner", "Wing", "Period", "Due", "Paid Date", "Status", "Total", "Paid", "Pending"], rows, totalLabel: key === "pending" ? "Total Pending" : "Total Collected", total: key === "pending" ? pending : collected };
    }
    if (key === "yearly") {
      const fyIncome = regularIncome;
      const fyMaintenance = reportMaintenancePayments;
      const fyExpenses = reportExpenses;
      const categoryTotals = new Map<string, { receipt: number; payment: number }>();
      const addCategory = (name: string, receipt: number, payment: number) => { const current = categoryTotals.get(name) || { receipt: 0, payment: 0 }; current.receipt += receipt; current.payment += payment; categoryTotals.set(name, current); };
      fyIncome.forEach((row) => addCategory(row.category?.name || "Other Income", Number(row.amount), 0));
      fyMaintenance.forEach((row) => addCategory("Maintenance Collection", Number(row.amount), 0));
      fyExpenses.forEach((row) => addCategory(row.category?.name || "Other Expense", 0, Number(row.amount)));
      const transactions = [
        ...fyIncome.map((row) => ({ date: row.transaction_date, type: "RECEIPT", category: row.category?.name || "Other Income", party: row.person_name || "-", flat: row.flat?.flat_number || "-", details: row.description || row.category?.name || "Income received", reference: row.receipt_number || row.reference_number || "-", receipt: Number(row.amount), payment: 0 })),
        ...fyMaintenance.map((row) => ({ date: row.payment_date, type: "RECEIPT", category: "Maintenance", party: "Society member", flat: row.flat?.flat_number || "-", details: row.notes || `Maintenance received from Flat ${row.flat?.flat_number || "-"}`, reference: row.reference_number || "-", receipt: Number(row.amount), payment: 0 })),
        ...fyExpenses.map((row) => ({ date: row.transaction_date, type: "PAYMENT", category: row.category?.name || "Other Expense", party: row.vendor_name || "-", flat: "-", details: row.description || row.notes || `${row.category?.name || "Expense"} paid to ${row.vendor_name || "vendor"}`, reference: row.voucher_number || row.bill_number || row.reference_number || "-", receipt: 0, payment: Number(row.amount) })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let runningBalance = Number(filters.openingBalance);
      const summaryRows: (string | number)[][] = [...categoryTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, totals]) => ["SUMMARY", "CATEGORY", category, "-", "-", "Category subtotal", "-", amount(totals.receipt), amount(totals.payment), amount(totals.receipt - totals.payment)]);
      const detailRows = transactions.map((row) => { runningBalance += row.receipt - row.payment; return [dateText(row.date), row.type, row.category, row.party, row.flat, row.details, row.reference, amount(row.receipt), amount(row.payment), amount(runningBalance)]; });
      const receipts = transactions.reduce((sum, row) => sum + row.receipt, 0); const payments = transactions.reduce((sum, row) => sum + row.payment, 0);
      return { title: `Society Annual Hisab ${filters.period === "financial_year" ? `FY ${financialYearLabel}` : "Custom Period"} (Unaudited)`, subtitle: `${dateText(financialYearFrom)} to ${dateText(financialYearTo)} | Opening INR ${amount(filters.openingBalance)} | Receipts INR ${amount(receipts)} | Payments INR ${amount(payments)} | Events separate`, headers: ["Date", "Type", "Category", "Party", "Flat", "Particulars", "Receipt / Bill Ref", "Receipt", "Payment", "Running Balance"], rows: [["SUMMARY", "OPENING", "Opening Balance", "-", "-", "Balance brought forward", "-", "-", "-", amount(filters.openingBalance)], ...summaryRows, ...detailRows], totalLabel: "Closing Balance", total: Number(filters.openingBalance) + receipts - payments };
    }
    const periods = new Map<string, { label: string; regularIncome: number; maintenance: number; regularExpense: number }>();
    const monthly = true;
    const add = (date: string, field: "regularIncome" | "maintenance" | "regularExpense", value: number) => {
      const d = new Date(`${date}T00:00:00`); if (!inFinancialYear(date)) return;
      const periodKey = monthly ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : String(d.getFullYear());
      const label = monthly ? d.toLocaleString("en-IN", { month: "long", year: "numeric" }) : String(d.getFullYear());
      const current = periods.get(periodKey) || { label, regularIncome: 0, maintenance: 0, regularExpense: 0 }; current[field] += Number(value); periods.set(periodKey, current);
    };
    regularIncome.forEach((r) => add(r.transaction_date, "regularIncome", r.amount)); reportMaintenancePayments.forEach((r) => add(r.payment_date, "maintenance", r.amount)); reportExpenses.forEach((r) => add(r.transaction_date, "regularExpense", r.amount));
    const summaryRows: (string | number)[][] = [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, r]) => { const aavak = r.regularIncome + r.maintenance; return [r.label, "SUMMARY", "Monthly subtotal", "-", "-", amount(aavak), amount(r.regularExpense), amount(aavak - r.regularExpense)]; });
    const details: { date: string; type: string; category: string; party: string; ref: string; receipt: number; payment: number }[] = [
      ...regularIncome.filter((r) => inFinancialYear(r.transaction_date)).map((r) => ({ date: r.transaction_date, type: "RECEIPT", category: r.category?.name || "Income", party: `${r.person_name || "-"}${r.flat?.flat_number ? ` / ${r.flat.flat_number}` : ""}`, ref: r.receipt_number || r.reference_number || "-", receipt: Number(r.amount), payment: 0 })),
      ...reportMaintenancePayments.map((r) => ({ date: r.payment_date, type: "RECEIPT", category: "Maintenance", party: `Flat ${r.flat?.flat_number || "-"}`, ref: r.reference_number || "-", receipt: Number(r.amount), payment: 0 })),
      ...reportExpenses.map((r) => ({ date: r.transaction_date, type: "PAYMENT", category: r.category?.name || "Expense", party: r.vendor_name || "-", ref: r.voucher_number || r.bill_number || r.reference_number || "-", receipt: 0, payment: Number(r.amount) })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let monthlyRunning = Number(filters.openingBalance);
    const detailRows = details.map((r) => { monthlyRunning += r.receipt - r.payment; return [dateText(r.date), r.type, r.category, r.party, r.ref, amount(r.receipt), amount(r.payment), amount(monthlyRunning)]; });
    return { title: `Monthly Society Hisab ${filters.period === "financial_year" ? `FY ${financialYearLabel}` : "Custom Period"} (Unaudited)`, subtitle: `Opening INR ${amount(filters.openingBalance)} | Month summaries and receipt/payment register; events separate`, headers: ["Date / Month", "Type", "Category / Particulars", "Party / Flat", "Receipt / Bill Ref", "Receipt", "Payment", "Running Balance"], rows: [["SUMMARY", "OPENING", "Opening Balance", "-", "-", "-", "-", amount(filters.openingBalance)], ...summaryRows, ...detailRows], totalLabel: "Period Cash Balance", total: monthlyRunning };
  }

  function preparedReport(key: ReportKey) {
    const report = makeReport(key);
    if (filters.detail === "detailed") return report;
    return { ...report, rows: report.rows.filter((row) => row.some((cell) => String(cell).toUpperCase() === "SUMMARY")) };
  }

  function simpleSummary(key: ReportKey, report: ExportReport) {
    const rows = report.rows.filter(isSummaryRow);
    if (key === "yearly") {
      return { headers: ["Category", "Receipts (INR)", "Payments (INR)", "Net (INR)"], rows: rows.filter((row) => row[1] === "CATEGORY").map((row) => [row[2], row[7], row[8], row[9]]), metrics: [{ label: "Opening Balance", value: filters.openingBalance }, { label: "Total Receipts", value: incomeTotal }, { label: "Total Payments", value: expenseTotal }, { label: "Closing Balance", value: report.total }] };
    }
    if (key === "monthly") {
      return { headers: ["Month", "Receipts (INR)", "Payments (INR)", "Net (INR)"], rows: rows.filter((row) => row[1] === "SUMMARY").map((row) => [row[0], row[5], row[6], row[7]]), metrics: [{ label: "Opening Balance", value: filters.openingBalance }, { label: "Total Receipts", value: incomeTotal }, { label: "Total Payments", value: expenseTotal }, { label: "Closing Balance", value: report.total }] };
    }
    if (key === "income") {
      const regular = regularIncome.reduce((sum, row) => sum + Number(row.amount), 0);
      return { headers: ["Aavak Category", "Amount (INR)"], rows: rows.map((row) => [row[2], row[7]]), metrics: [{ label: "Regular Aavak", value: regular }, { label: "Maintenance Received", value: collected }, { label: "Total Aavak", value: report.total }] };
    }
    if (key === "expense") return { headers: ["Javak Category", "Amount (INR)"], rows: rows.map((row) => [row[2], row[7]]), metrics: [{ label: "Total Javak", value: report.total }] };
    if (key === "maintenance" || key === "pending") {
      return { headers: ["Wing", key === "pending" ? "Pending (INR)" : "Collected (INR)"], rows: rows.map((row) => [row[2], key === "pending" ? row[9] : row[8]]), metrics: [{ label: "Total Billed", value: yearBills.reduce((sum, row) => sum + Number(row.total_amount), 0) }, { label: "Collected", value: collected }, { label: "Pending", value: pending }] };
    }
    if (key.startsWith("event:")) {
      return { headers: ["Particular", "Amount / Value (INR)"], rows: rows.map((row) => [row[1], row[5]]), metrics: [{ label: report.totalLabel, value: report.total }] };
    }
    return { headers: ["Particular", "Amount (INR)"], rows, metrics: [{ label: report.totalLabel, value: report.total }] };
  }

  async function downloadPdf(key: ReportKey) {
    setDownloading(`${key}-pdf`);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const report = preparedReport(key);
      const summary = simpleSummary(key, report);
      const orientation = report.headers.length > 7 ? "landscape" : "portrait";
      const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const address = [society?.address, society?.city, society?.state, society?.pin_code].filter(Boolean).join(", ") || "Society financial report";
      const generated = new Date().toLocaleString("en-IN");
      const period = reportPeriod(filters.period, financialYearLabel, financialYearFrom, financialYearTo);
      const detailRows = report.rows.filter((row) => !isSummaryRow(row));
      const drawPageFrame = () => {
        doc.setFillColor(29, 78, 216); doc.rect(0, 0, pageWidth, 24, "F");
        doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(society?.name || "Society Management", margin, 10);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(address, margin, 17, { maxWidth: pageWidth - margin * 2 });
        doc.setDrawColor(226, 232, 240); doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      };
      drawPageFrame();
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(report.title, margin, 35);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139); doc.text(`${period}  |  Generated ${generated}`, margin, 42);
      const metricGap = 3; const metricWidth = (pageWidth - margin * 2 - metricGap * (summary.metrics.length - 1)) / summary.metrics.length;
      summary.metrics.forEach((metric, index) => { const x = margin + index * (metricWidth + metricGap); doc.setFillColor(239, 246, 255); doc.roundedRect(x, 48, metricWidth, 18, 2, 2, "F"); doc.setTextColor(30, 64, 175); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(metric.label.toUpperCase(), x + 4, 55); doc.setTextColor(metric.value < 0 ? 190 : 15, metric.value < 0 ? 24 : 23, metric.value < 0 ? 93 : 42); doc.setFontSize(12); doc.text(`INR ${amount(metric.value)}`, x + 4, 62); });

      let cursorY = 74;
      const tableBase = {
        theme: "grid" as const,
        margin: { left: margin, right: margin, top: 30, bottom: 18 },
        styles: { fontSize: orientation === "landscape" ? 7.2 : 8, cellPadding: 2.2, overflow: "linebreak" as const, textColor: [30, 41, 59] as [number, number, number], lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.15 },
        headStyles: { fillColor: [29, 78, 216] as [number, number, number], textColor: 255, fontStyle: "bold" as const, halign: "left" as const },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        didDrawPage: ({ pageNumber }: { pageNumber: number }) => { drawPageFrame(); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 6, { align: "right" }); doc.text("UNAUDITED - Confidential society record", margin, pageHeight - 6); },
      };
      if (summary.rows.length) {
        doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Summary", margin, cursorY);
        autoTable(doc, { ...tableBase, startY: cursorY + 3, head: [summary.headers], body: summary.rows, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } });
        cursorY = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursorY) + 9;
      }
      if (filters.detail === "detailed") {
        if (cursorY > pageHeight - 45) { doc.addPage(); cursorY = 34; }
        doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(summary.rows.length ? "Detailed Records" : "Records", margin, cursorY);
        autoTable(doc, { ...tableBase, startY: cursorY + 3, head: [report.headers], body: detailRows.length ? detailRows : [["No detailed records available", ...report.headers.slice(1).map(() => "")]] });
      }
      let finalY = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursorY) + 12;
      if (finalY > pageHeight - 38) { doc.addPage(); drawPageFrame(); finalY = 40; }
      doc.setDrawColor(148, 163, 184); doc.line(margin, finalY + 14, margin + 48, finalY + 14); doc.line(pageWidth - margin - 48, finalY + 14, pageWidth - margin, finalY + 14);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text("Treasurer / Authorized Signatory", margin, finalY + 19); doc.text("Secretary / Chairman", pageWidth - margin, finalY + 19, { align: "right" });
      doc.save(`${safeName(society?.name || "society")}-${safeName(report.title)}-${new Date().toISOString().slice(0, 10)}.pdf`); toast.success("PDF downloaded");
    } catch { toast.error("Could not generate PDF"); } finally { setDownloading(null); }
  }

  async function downloadExcel(key: ReportKey) {
    setDownloading(`${key}-excel`);
    try {
      const report = preparedReport(key);
      const simple = simpleSummary(key, report);
      const cellXml = (cell: string | number, style = "Cell") => `<Cell ss:StyleID="${style}"><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${xmlText(cell)}</Data></Cell>`;
      const rowXml = (cells: (string | number)[], style = "Cell") => `<Row>${cells.map((cell) => cellXml(cell, style)).join("")}</Row>`;
      const columnsXml = (count: number) => Array.from({ length: count }, (_, index) => `<Column ss:Width="${index === 0 ? 95 : index >= count - 3 ? 90 : 125}"/>`).join("");
      const sheetXml = (name: string, headers: string[], rows: (string | number)[][], includeTitle = false) => {
        const titleRows = includeTitle ? `${rowXml([society?.name || "Society Management"], "SocietyTitle")}${rowXml([report.title], "ReportTitle")}${rowXml([report.subtitle], "Subtitle")}${rowXml([`Generated: ${new Date().toLocaleString("en-IN")}`], "Subtitle")}${rowXml([`${report.totalLabel}: INR ${amount(report.total)}`], "Total")}<Row/>` : "";
        return `<Worksheet ss:Name="${xmlText(name.slice(0, 31))}"><Table>${columnsXml(headers.length)}${titleRows}${rowXml(headers, "Header")}${rows.length ? rows.map((row) => rowXml(row)).join("") : rowXml(["No records available", ...headers.slice(1).map(() => "")])}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>${includeTitle ? 7 : 1}</SplitHorizontal><TopRowBottomPane>${includeTitle ? 7 : 1}</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
      };
      const summaryRows: (string | number)[][] = [["Society", society?.name || "Society Management"], ["Address", [society?.address, society?.city, society?.state, society?.pin_code].filter(Boolean).join(", ") || "-"], ["Report", report.title], ["Period", reportPeriod(filters.period, financialYearLabel, financialYearFrom, financialYearTo)], ["Generated", new Date().toLocaleString("en-IN")], [report.totalLabel, report.total], ["Status", "Unaudited - verify with society accountant / auditor"], ["Treasurer / Authorized Signatory", ""], ["Secretary / Chairman", ""]];
      const reportDetailRows = report.rows.filter((row) => !isSummaryRow(row));
      const overviewRows: (string | number)[][] = simple.metrics.map((metric) => [metric.label, metric.value]);
      const sheets = [
        sheetXml("Report Summary", ["Particular", "Value"], [...summaryRows, ["", ""], ...overviewRows], true),
        sheetXml("Category Summary", simple.headers, simple.rows),
        ...(filters.detail === "detailed" ? [sheetXml("Detailed Records", report.headers, reportDetailRows)] : []),
      ];

      if (key === "yearly") {
        const fyIncome = regularIncome;
        const fyMaintenance = reportMaintenancePayments;
        const fyExpenses = reportExpenses;
        sheets.push(sheetXml("Receipts", ["Date", "Category", "Person", "Flat", "Mode", "Receipt / Ref", "Description", "Amount"], [
          ...fyIncome.map((r) => [dateText(r.transaction_date), r.category?.name || "Income", r.person_name || "-", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.receipt_number || r.reference_number || "-", r.description || "-", amount(r.amount)]),
          ...fyMaintenance.map((r) => [dateText(r.payment_date), "Maintenance", "Society member", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.reference_number || "-", r.notes || "Maintenance payment", amount(r.amount)]),
        ]));
        sheets.push(sheetXml("Payments", ["Date", "Category", "Paid To", "Mode", "Voucher / Bill / Ref", "Particulars", "Amount"], fyExpenses.map((r) => [dateText(r.transaction_date), r.category?.name || "Expense", r.vendor_name || "-", r.payment_mode.replaceAll("_", " "), r.voucher_number || r.bill_number || r.reference_number || "-", r.description || r.notes || "-", amount(r.amount)])));
        sheets.push(sheetXml("Maintenance", ["Flat", "Owner", "Wing", "Period", "Status", "Total", "Paid", "Pending"], yearBills.map((r) => [r.flat?.flat_number || "-", r.flat?.owner_name || "-", r.flat?.wing?.name || "-", `${monthName(r.bill_month)} ${r.bill_year}`, r.status.replaceAll("_", " "), amount(r.total_amount), amount(r.paid_amount), amount(r.pending_amount)])));
        sheets.push(sheetXml("Outstanding", ["Flat", "Owner", "Wing", "Period", "Due Date", "Status", "Pending"], yearBills.filter((r) => Number(r.pending_amount) > 0).map((r) => [r.flat?.flat_number || "-", r.flat?.owner_name || "-", r.flat?.wing?.name || "-", `${monthName(r.bill_month)} ${r.bill_year}`, dateText(r.due_date), r.status.replaceAll("_", " "), amount(r.pending_amount)])));
        sheets.push(sheetXml("Category Ledger", report.headers, report.rows.filter((row) => row[0] === "SUMMARY")));
      } else if (key.startsWith("event:")) {
        const eventId = key.slice(6); const flats = eventFlatContributions.filter((row) => row.event_id === eventId); const payments = eventFlatPayments.filter((row) => row.event_id === eventId); const cash = eventAavak.filter((row) => row.event_id === eventId && row.contribution_type === "money"); const items = eventAavak.filter((row) => row.event_id === eventId && row.contribution_type === "item"); const javak = eventExpenses.filter((row) => row.event_id === eventId);
        sheets.push(sheetXml("Flat Contributions", ["Flat", "Owner", "Amount", "Paid", "Pending", "Status", "Due Date"], flats.map((r) => [r.flat?.flat_number || "-", r.flat?.owner_name || "-", amount(r.amount), amount(r.paid_amount), amount(r.pending_amount), r.status.replaceAll("_", " "), dateText(r.due_date)])));
        sheets.push(sheetXml("Flat Payments", ["Date", "Flat", "Mode", "Reference", "Amount"], payments.map((r) => [dateText(r.payment_date), r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.reference_number || "-", amount(r.amount)])));
        sheets.push(sheetXml("Cash Aavak", ["Date", "Category", "Donor", "Mode", "Reference", "Amount"], cash.map((r) => [dateText(r.contribution_date), r.category, r.donor_name || "Anonymous", r.payment_mode?.replaceAll("_", " ") || "-", r.reference_number || "-", amount(Number(r.amount))])));
        sheets.push(sheetXml("Item Donations", ["Date", "Item", "Donor", "Quantity", "Unit", "Value"], items.map((r) => [dateText(r.contribution_date), r.item_name || r.category, r.donor_name || "Anonymous", Number(r.quantity || 0), r.unit || "-", amount(r.total_value)])));
        sheets.push(sheetXml("Event Javak", ["Date", "Category", "Paid To", "Mode", "Reference", "Amount"], javak.map((r) => [dateText(r.expense_date), r.category, r.vendor_name || "-", r.payment_mode.replaceAll("_", " "), r.reference_number || "-", amount(r.amount)])));
      }

      const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Cell"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style><Style ss:ID="Header"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style><Style ss:ID="SocietyTitle"><Font ss:Bold="1" ss:Size="16" ss:Color="#1D4ED8"/></Style><Style ss:ID="ReportTitle"><Font ss:Bold="1" ss:Size="13"/></Style><Style ss:ID="Subtitle"><Font ss:Color="#64748B"/><Alignment ss:WrapText="1"/></Style><Style ss:ID="Total"><Font ss:Bold="1" ss:Size="12"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style></Styles>${sheets.join("")}</Workbook>`;
      const url = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
      const link = document.createElement("a"); link.href = url; link.download = `${safeName(society?.name || "society")}-${safeName(report.title)}-${new Date().toISOString().slice(0, 10)}.xls`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch { toast.error("Could not generate Excel"); } finally { setDownloading(null); }
  }

  const cards: { key: ReportKey; title: string; note: string; value: number }[] = [
    { key: "income", title: "Income Report", note: "All-time detailed income", value: incomeTotal }, { key: "expense", title: "Expense Report", note: "All-time detailed expenses", value: expenseTotal },
    { key: "maintenance", title: "Maintenance Collection", note: `FY ${financialYearLabel} collected`, value: collected }, { key: "pending", title: "Pending Maintenance", note: `FY ${financialYearLabel} pending`, value: pending },
    { key: "monthly", title: "Monthly Summary", note: `FY ${financialYearLabel} month-wise`, value: makeReport("monthly").total }, { key: "yearly", title: "Annual Society Hisab", note: `FY ${financialYearLabel} detailed unaudited accounts`, value: makeReport("yearly").total },
  ];
  const eventCards = events.map((event) => {
    const flatCash = eventFlatPayments.filter((row) => row.event_id === event.id).reduce((sum, row) => sum + Number(row.amount), 0);
    const otherCash = eventAavak.filter((row) => row.event_id === event.id && row.contribution_type === "money").reduce((sum, row) => sum + Number(row.amount), 0);
    const javak = eventExpenses.filter((row) => row.event_id === event.id).reduce((sum, row) => sum + Number(row.amount), 0);
    return { key: `event:${event.id}` as ReportKey, title: `${event.name} ${event.event_year}`, note: "Separate complete event Hisab", value: flatCash + otherCash - javak };
  });
  const wingOptions = [...new Set(maintenance.map((row) => row.flat?.wing?.name).filter((value): value is string => Boolean(value)))].sort();
  const flatOptions = [...new Set(maintenance.filter((row) => !draft.wing || row.flat?.wing?.name === draft.wing).map((row) => row.flat?.flat_number).filter((value): value is string => Boolean(value)))].sort();
  const categoryOptions = [
    { value: "", label: "All Categories" }, { value: "maintenance", label: "Maintenance" },
    ...[...new Set(income.filter((row) => row.category?.slug !== "maintenance").map((row) => row.category?.name).filter((value): value is string => Boolean(value)))].sort().map((name) => ({ value: `income:${name}`, label: `Aavak: ${name}` })),
    ...[...new Set(expenses.map((row) => row.category?.name).filter((value): value is string => Boolean(value)))].sort().map((name) => ({ value: `expense:${name}`, label: `Javak: ${name}` })),
  ];
  const scopeLabel = filters.period === "all_time" ? "All time" : filters.period === "custom" ? `${dateText(filters.from)} – ${dateText(filters.to)}` : `FY ${financialYearLabel}`;
  const reportCard = (report: { key: ReportKey; title: string; note: string; value: number }) => <Card key={report.key}><CardHeader title={report.title} description={report.note} /><CardContent><p className="text-2xl font-semibold text-slate-900">{formatCurrency(report.value)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" loading={downloading === `${report.key}-pdf`} onClick={() => downloadPdf(report.key)}><FileText className="h-4 w-4" />Download PDF</Button><Button size="sm" variant="outline" loading={downloading === `${report.key}-excel`} onClick={() => downloadExcel(report.key)}><FileSpreadsheet className="h-4 w-4" />Download Excel</Button></div><p className="mt-3 flex items-center gap-1 text-xs text-slate-400"><Download className="h-3.5 w-3.5" />Includes summary and detailed records</p></CardContent></Card>;
  return <div className="space-y-4 sm:space-y-6">
    <div><PageHeader title="Reports" description="Download detailed financial and maintenance reports in PDF or Excel format." actions={<Button onClick={() => { setDraft(filters); setCustomizeOpen(true); }}><Settings2 className="h-4 w-4" />Customize Reports</Button>} /><div className="-mt-1 flex flex-wrap gap-2 text-xs text-slate-500 sm:-mt-2"><span className="rounded-full bg-slate-100 px-3 py-1">{scopeLabel}</span>{filters.wing ? <span className="rounded-full bg-slate-100 px-3 py-1">Wing {filters.wing}</span> : null}{filters.flat ? <span className="rounded-full bg-slate-100 px-3 py-1">Flat {filters.flat}</span> : null}{filters.category ? <span className="rounded-full bg-slate-100 px-3 py-1">Filtered category</span> : null}<span className="rounded-full bg-slate-100 px-3 py-1">{filters.detail === "detailed" ? "Summary + details" : "Summary only"}</span></div></div>
    <section><h2 className="mb-2 text-base font-semibold text-slate-900 sm:mb-3 sm:text-lg">Society & Maintenance Reports</h2><div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">{cards.map(reportCard)}</div></section>
    <section><h2 className="mb-1 text-base font-semibold text-slate-900 sm:text-lg">Event Reports</h2><p className="mb-2 text-sm text-slate-500 sm:mb-3">Each event remains separate from regular society accounts.</p>{eventCards.length ? <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">{eventCards.map(reportCard)}</div> : <Card><CardContent className="text-sm text-slate-500">No events created yet.</CardContent></Card>}</section>
    <Modal open={customizeOpen} onClose={() => setCustomizeOpen(false)} title="Customize Reports" description="Filters change report cards and downloads only. Stored records are never modified." size="lg">
      <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
        <Select label="Report Period" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value as ReportFilters["period"] })} options={[{ value: "financial_year", label: "Financial Year" }, { value: "custom", label: "Custom Date Range" }, { value: "all_time", label: "All Time" }]} />
        {draft.period === "financial_year" ? <Select label="Financial Year" value={String(draft.financialYear)} onChange={(e) => setDraft({ ...draft, financialYear: Number(e.target.value) })} options={Array.from({ length: 7 }, (_, i) => currentFinancialYear + 1 - i).map((start) => ({ value: String(start), label: `${start}-${String(start + 1).slice(-2)}` }))} /> : null}
        {draft.period === "custom" ? <><Input label="From Date" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /><Input label="To Date" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></> : null}
        <Select label="Wing" value={draft.wing} onChange={(e) => setDraft({ ...draft, wing: e.target.value, flat: "" })} options={[{ value: "", label: "All Wings" }, ...wingOptions.map((name) => ({ value: name, label: `Wing ${name}` }))]} />
        <Select label="Flat" value={draft.flat} onChange={(e) => setDraft({ ...draft, flat: e.target.value })} options={[{ value: "", label: "All Flats" }, ...flatOptions.map((name) => ({ value: name, label: name }))]} />
        <Select label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} options={categoryOptions} />
        <Select label="Maintenance Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} options={[{ value: "", label: "All Statuses" }, { value: "paid", label: "Paid" }, { value: "pending", label: "Pending" }, { value: "partially_paid", label: "Partially Paid" }, { value: "overdue", label: "Overdue" }]} />
        <Select label="Report Detail" value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value as ReportFilters["detail"] })} options={[{ value: "detailed", label: "Summary + Transactions" }, { value: "summary", label: "Summary Only" }]} />
        <Input label="Opening Balance" type="number" step="0.01" value={draft.openingBalance} onChange={(e) => setDraft({ ...draft, openingBalance: Number(e.target.value) })} />
      </div><div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Opening balance is used only in Monthly and Annual cash-balance reports.</div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={() => setDraft(defaultFilters)}>Reset Defaults</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setCustomizeOpen(false)}>Cancel</Button><Button onClick={() => { if (draft.period === "custom" && (!draft.from || !draft.to || draft.from > draft.to)) { toast.error("Enter a valid date range"); return; } setFilters(draft); setCustomizeOpen(false); toast.success("Report filters applied"); }}>Apply Filters</Button></div></div></div>
    </Modal>
  </div>;
}
