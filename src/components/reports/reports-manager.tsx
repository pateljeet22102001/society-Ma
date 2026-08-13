"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Society } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type IncomeRow = { transaction_date: string; amount: number; person_name: string | null; payment_mode: string; reference_number: string | null; description: string | null; receipt_number: string | null; category: { name: string; slug: string } | null; flat: { flat_number: string } | null };
type ExpenseRow = { transaction_date: string; amount: number; vendor_name: string | null; payment_mode: string; reference_number: string | null; description: string | null; notes: string | null; bill_number: string | null; category: { name: string } | null };
type MaintenanceRow = { bill_month: number; bill_year: number; period_months: number; total_amount: number; paid_amount: number; pending_amount: number; status: string; due_date: string | null; payment_date: string | null; flat: { flat_number: string; owner_name: string | null; wing: { name: string } | null } | null };
type CashPayment = { payment_date: string; amount: number; payment_mode: string; reference_number: string | null; notes?: string | null; flat: { flat_number: string } | null; event_id?: string };
type EventInfo = { id: string; name: string; event_year: number };
type EventFlatContributionRow = { event_id: string; amount: number; paid_amount: number; pending_amount: number; status: string; due_date: string | null; payment_date: string | null; flat: { flat_number: string; owner_name: string | null } | null };
type EventAavak = { event_id: string; contribution_type: "money" | "item"; category: string; donor_name: string | null; amount: number | null; item_name: string | null; quantity: number | null; unit: string | null; total_value: number; contribution_date: string; payment_mode: string | null; reference_number: string | null };
type EventExpenseRow = { event_id: string; category: string; vendor_name: string | null; amount: number; expense_date: string; payment_mode: string; reference_number: string | null };
type ReportKey = "income" | "expense" | "maintenance" | "pending" | "monthly" | "yearly" | `event:${string}`;
type ExportReport = { title: string; subtitle: string; headers: string[]; rows: (string | number)[][]; totalLabel: string; total: number };

const monthName = (month: number) => new Date(2000, month - 1).toLocaleString("en-IN", { month: "short" });
const dateText = (date?: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN") : "-";
const amount = (value: number) => Number(value || 0).toFixed(2);
const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const xmlText = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function ReportsManager({ society, income, expenses, maintenance, maintenancePayments, events, eventFlatContributions, eventFlatPayments, eventAavak, eventExpenses }: { society: Society | null; income: IncomeRow[]; expenses: ExpenseRow[]; maintenance: MaintenanceRow[]; maintenancePayments: CashPayment[]; events: EventInfo[]; eventFlatContributions: EventFlatContributionRow[]; eventFlatPayments: CashPayment[]; eventAavak: EventAavak[]; eventExpenses: EventExpenseRow[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const now = new Date();
  const financialYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const financialYearLabel = `${financialYearStart}-${String(financialYearStart + 1).slice(-2)}`;
  const financialYearFrom = `${financialYearStart}-04-01`;
  const financialYearTo = `${financialYearStart + 1}-03-31`;
  const inFinancialYear = (date: string) => date >= financialYearFrom && date <= financialYearTo;
  const regularIncome = income.filter((row) => row.category?.slug !== "maintenance");
  const incomeTotal = regularIncome.reduce((sum, row) => sum + Number(row.amount), 0) + maintenancePayments.reduce((sum, row) => sum + Number(row.amount), 0);
  const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const yearBills = maintenance.filter((row) => inFinancialYear(`${row.bill_year}-${String(row.bill_month).padStart(2, "0")}-01`));
  const collected = maintenancePayments.filter((row) => inFinancialYear(row.payment_date)).reduce((sum, row) => sum + Number(row.amount), 0);
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
        ...cash.map((r) => ["CASH AAVAK", r.category, r.donor_name || "Anonymous", dateText(r.contribution_date), r.payment_mode?.replaceAll("_", " ") || "-", amount(Number(r.amount))]),
        ...items.map((r) => ["ITEM DONATION", r.item_name || r.category, r.donor_name || "Anonymous", dateText(r.contribution_date), `${r.quantity || 0} ${r.unit || ""}`, amount(r.total_value)]),
        ...javak.map((r) => ["JAVAK", r.category, r.vendor_name || "-", dateText(r.expense_date), r.payment_mode.replaceAll("_", " "), amount(r.amount)]),
      ];
      return { title: `${event?.name || "Event"} ${event?.event_year || ""} Hisab`, subtitle: `Separate event report | Pending INR ${amount(pendingTotal)} | Item value INR ${amount(itemValue)}`, headers: ["Type", "Details", "Person / Status", "Date", "Information", "Value (INR)"], rows, totalLabel: "Event Cash Balance", total: flatCollected + cashDonations - expensesTotal };
    }
    if (key === "income") {
      const rows = [
        ...regularIncome.map((r) => [dateText(r.transaction_date), "Regular Aavak", r.category?.name || "-", r.person_name || "-", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.receipt_number || r.reference_number || "-", amount(r.amount)]),
        ...maintenancePayments.map((r) => [dateText(r.payment_date), "Maintenance", "Maintenance payment", "-", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.reference_number || "-", amount(r.amount)]),
      ].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
      return { title: "Society Aavak Report", subtitle: "Regular income and maintenance received; events are reported separately", headers: ["Date", "Source", "Category", "Person", "Flat", "Mode", "Receipt / Ref", "Amount (INR)"], rows, totalLabel: "Total Society Aavak", total: incomeTotal };
    }
    if (key === "expense") {
      const rows = expenses.map((r) => [dateText(r.transaction_date), "Society Javak", r.category?.name || "-", r.vendor_name || "-", r.payment_mode.replaceAll("_", " "), r.bill_number || r.reference_number || "-", amount(r.amount)]);
      return { title: "Society Javak Report", subtitle: "Regular society expenses; events are reported separately", headers: ["Date", "Source", "Category", "Vendor", "Mode", "Bill / Ref", "Amount (INR)"], rows, totalLabel: "Total Society Javak", total: expenseTotal };
    }
    if (key === "maintenance" || key === "pending") {
      const source = key === "pending" ? yearBills.filter((r) => Number(r.pending_amount) > 0) : yearBills.filter((r) => Number(r.paid_amount) > 0);
      return { title: key === "pending" ? "Pending Maintenance Report" : "Maintenance Collection Report", subtitle: `Financial Year ${financialYearLabel} flat-wise maintenance`, headers: ["Flat", "Owner", "Wing", "Period", "Due", "Paid Date", "Status", "Total", "Paid", "Pending"], rows: source.map((r) => [r.flat?.flat_number || "-", r.flat?.owner_name || "-", r.flat?.wing?.name || "-", `${monthName(r.bill_month)} ${r.bill_year}${r.period_months > 1 ? ` (${r.period_months} months)` : ""}`, dateText(r.due_date), dateText(r.payment_date), r.status.replaceAll("_", " "), amount(r.total_amount), amount(r.paid_amount), amount(r.pending_amount)]), totalLabel: key === "pending" ? "Total Pending" : "Total Collected", total: key === "pending" ? pending : collected };
    }
    if (key === "yearly") {
      const fyIncome = regularIncome.filter((row) => inFinancialYear(row.transaction_date));
      const fyMaintenance = maintenancePayments.filter((row) => inFinancialYear(row.payment_date));
      const fyExpenses = expenses.filter((row) => inFinancialYear(row.transaction_date));
      const categoryTotals = new Map<string, { receipt: number; payment: number }>();
      const addCategory = (name: string, receipt: number, payment: number) => { const current = categoryTotals.get(name) || { receipt: 0, payment: 0 }; current.receipt += receipt; current.payment += payment; categoryTotals.set(name, current); };
      fyIncome.forEach((row) => addCategory(row.category?.name || "Other Income", Number(row.amount), 0));
      fyMaintenance.forEach((row) => addCategory("Maintenance Collection", Number(row.amount), 0));
      fyExpenses.forEach((row) => addCategory(row.category?.name || "Other Expense", 0, Number(row.amount)));
      const transactions = [
        ...fyIncome.map((row) => ({ date: row.transaction_date, type: "RECEIPT", category: row.category?.name || "Other Income", party: row.person_name || "-", flat: row.flat?.flat_number || "-", details: row.description || row.category?.name || "Income received", reference: row.receipt_number || row.reference_number || "-", receipt: Number(row.amount), payment: 0 })),
        ...fyMaintenance.map((row) => ({ date: row.payment_date, type: "RECEIPT", category: "Maintenance", party: "Society member", flat: row.flat?.flat_number || "-", details: row.notes || `Maintenance received from Flat ${row.flat?.flat_number || "-"}`, reference: row.reference_number || "-", receipt: Number(row.amount), payment: 0 })),
        ...fyExpenses.map((row) => ({ date: row.transaction_date, type: "PAYMENT", category: row.category?.name || "Other Expense", party: row.vendor_name || "-", flat: "-", details: row.description || row.notes || `${row.category?.name || "Expense"} paid to ${row.vendor_name || "vendor"}`, reference: row.bill_number || row.reference_number || "-", receipt: 0, payment: Number(row.amount) })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let runningBalance = 0;
      const summaryRows: (string | number)[][] = [...categoryTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, totals]) => ["SUMMARY", "CATEGORY", category, "-", "-", "Category subtotal", "-", amount(totals.receipt), amount(totals.payment), amount(totals.receipt - totals.payment)]);
      const detailRows = transactions.map((row) => { runningBalance += row.receipt - row.payment; return [dateText(row.date), row.type, row.category, row.party, row.flat, row.details, row.reference, amount(row.receipt), amount(row.payment), amount(runningBalance)]; });
      const receipts = transactions.reduce((sum, row) => sum + row.receipt, 0); const payments = transactions.reduce((sum, row) => sum + row.payment, 0);
      return { title: `Society Annual Hisab FY ${financialYearLabel} (Unaudited)`, subtitle: `1 April ${financialYearStart} to 31 March ${financialYearStart + 1} | Receipts INR ${amount(receipts)} | Payments INR ${amount(payments)} | Events reported separately`, headers: ["Date", "Type", "Category", "Party", "Flat", "Particulars", "Receipt / Bill Ref", "Receipt", "Payment", "Running Balance"], rows: [...summaryRows, ...detailRows], totalLabel: "Closing Balance (recorded transactions)", total: receipts - payments };
    }
    const periods = new Map<string, { label: string; regularIncome: number; maintenance: number; regularExpense: number }>();
    const monthly = true;
    const add = (date: string, field: "regularIncome" | "maintenance" | "regularExpense", value: number) => {
      const d = new Date(`${date}T00:00:00`); if (!inFinancialYear(date)) return;
      const periodKey = monthly ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : String(d.getFullYear());
      const label = monthly ? d.toLocaleString("en-IN", { month: "long", year: "numeric" }) : String(d.getFullYear());
      const current = periods.get(periodKey) || { label, regularIncome: 0, maintenance: 0, regularExpense: 0 }; current[field] += Number(value); periods.set(periodKey, current);
    };
    regularIncome.forEach((r) => add(r.transaction_date, "regularIncome", r.amount)); maintenancePayments.forEach((r) => add(r.payment_date, "maintenance", r.amount)); expenses.forEach((r) => add(r.transaction_date, "regularExpense", r.amount));
    const rows = [...periods.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([, r]) => { const aavak = r.regularIncome + r.maintenance; return [r.label, amount(r.regularIncome), amount(r.maintenance), amount(aavak), amount(r.regularExpense), amount(aavak - r.regularExpense)]; });
    const fyBalance = rows.reduce((sum, row) => sum + Number(row[5]), 0);
    return { title: `Monthly Society Hisab FY ${financialYearLabel}`, subtitle: `1 April ${financialYearStart} to 31 March ${financialYearStart + 1}; events reported separately`, headers: ["Month", "Regular Aavak", "Maintenance", "Total Aavak", "Society Javak", "Cash Balance"], rows, totalLabel: "Financial Year Cash Balance", total: fyBalance };
  }

  async function downloadPdf(key: ReportKey) {
    setDownloading(`${key}-pdf`);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const report = makeReport(key); const doc = new jsPDF({ orientation: report.headers.length > 7 ? "landscape" : "portrait", unit: "mm", format: "a4" });
      doc.setFillColor(29, 78, 216); doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text(society?.name || "Society Management", 14, 12);
      doc.setFontSize(10); doc.text([society?.address, society?.city, society?.state].filter(Boolean).join(", ") || "Society financial report", 14, 20); doc.setTextColor(15, 23, 42); doc.setFontSize(16); doc.text(report.title, 14, 39);
      doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(`${report.subtitle} | Generated: ${new Date().toLocaleString("en-IN")}`, 14, 46, { maxWidth: doc.internal.pageSize.getWidth() - 28 }); doc.setTextColor(15, 23, 42); doc.setFontSize(12); doc.text(`${report.totalLabel}: INR ${amount(report.total)}`, 14, 55);
      autoTable(doc, { startY: 61, head: [report.headers], body: report.rows.length ? report.rows : [["No records available", ...report.headers.slice(1).map(() => "")]], theme: "grid", styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" }, headStyles: { fillColor: [29, 78, 216], textColor: 255 }, alternateRowStyles: { fillColor: [248, 250, 252] }, didDrawPage: ({ pageNumber }) => { doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(`Page ${pageNumber}`, doc.internal.pageSize.getWidth() - 24, doc.internal.pageSize.getHeight() - 7); } });
      doc.save(`${safeName(society?.name || "society")}-${safeName(report.title)}-${new Date().toISOString().slice(0, 10)}.pdf`); toast.success("PDF downloaded");
    } catch { toast.error("Could not generate PDF"); } finally { setDownloading(null); }
  }

  async function downloadExcel(key: ReportKey) {
    setDownloading(`${key}-excel`);
    try {
      const report = makeReport(key);
      const rowXml = (cells: (string | number)[], style = "") => `<Row>${cells.map((cell) => `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${xmlText(cell)}</Data></Cell>`).join("")}</Row>`;
      const summaryRows = [[society?.name || "Society Management"], [report.title], [report.subtitle], ["Generated", new Date().toLocaleString("en-IN")], [report.totalLabel, report.total]];
      const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14"/></Style></Styles><Worksheet ss:Name="Summary"><Table>${summaryRows.map((r, i) => rowXml(r, i < 2 ? "Title" : "")).join("")}</Table></Worksheet><Worksheet ss:Name="Details"><Table>${rowXml(report.headers, "Header")}${report.rows.map((r) => rowXml(r)).join("")}</Table></Worksheet></Workbook>`;
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
  const reportCard = (report: { key: ReportKey; title: string; note: string; value: number }) => <Card key={report.key}><CardHeader title={report.title} description={report.note} /><CardContent><p className="text-2xl font-semibold text-slate-900">{formatCurrency(report.value)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" loading={downloading === `${report.key}-pdf`} onClick={() => downloadPdf(report.key)}><FileText className="h-4 w-4" />Download PDF</Button><Button size="sm" variant="outline" loading={downloading === `${report.key}-excel`} onClick={() => downloadExcel(report.key)}><FileSpreadsheet className="h-4 w-4" />Download Excel</Button></div><p className="mt-3 flex items-center gap-1 text-xs text-slate-400"><Download className="h-3.5 w-3.5" />Includes summary and detailed records</p></CardContent></Card>;
  return <div className="space-y-8"><section><h2 className="mb-3 text-lg font-semibold text-slate-900">Society & Maintenance Reports</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(reportCard)}</div></section><section><h2 className="mb-1 text-lg font-semibold text-slate-900">Event Reports</h2><p className="mb-3 text-sm text-slate-500">Each event remains separate from regular society accounts.</p>{eventCards.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{eventCards.map(reportCard)}</div> : <Card><CardContent className="text-sm text-slate-500">No events created yet.</CardContent></Card>}</section></div>;
}
