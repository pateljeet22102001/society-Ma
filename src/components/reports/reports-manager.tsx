"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Society } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type IncomeRow = { transaction_date: string; amount: number; person_name: string | null; payment_mode: string; reference_number: string | null; description: string | null; receipt_number: string | null; category: { name: string } | null; flat: { flat_number: string } | null };
type ExpenseRow = { transaction_date: string; amount: number; vendor_name: string | null; payment_mode: string; reference_number: string | null; description: string | null; bill_number: string | null; category: { name: string } | null };
type MaintenanceRow = { bill_month: number; bill_year: number; period_months: number; total_amount: number; paid_amount: number; pending_amount: number; status: string; due_date: string | null; payment_date: string | null; flat: { flat_number: string; owner_name: string | null; wing: { name: string } | null } | null };
type ReportKey = "income" | "expense" | "maintenance" | "pending" | "monthly" | "yearly";
type ExportReport = { title: string; subtitle: string; headers: string[]; rows: (string | number)[][]; totalLabel: string; total: number };

const monthName = (month: number) => new Date(2000, month - 1).toLocaleString("en-IN", { month: "short" });
const dateText = (date?: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN") : "-";
const amount = (value: number) => Number(value || 0).toFixed(2);
const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const xmlText = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function ReportsManager({ society, income, expenses, maintenance }: { society: Society | null; income: IncomeRow[]; expenses: ExpenseRow[]; maintenance: MaintenanceRow[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const year = new Date().getFullYear();
  const incomeTotal = income.reduce((sum, row) => sum + Number(row.amount), 0);
  const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const yearBills = maintenance.filter((row) => Number(row.bill_year) === year);
  const collected = yearBills.reduce((sum, row) => sum + Number(row.paid_amount), 0);
  const pending = yearBills.reduce((sum, row) => sum + Number(row.pending_amount), 0);

  function makeReport(key: ReportKey): ExportReport {
    if (key === "income") return { title: "Income Report", subtitle: "All-time income transactions", headers: ["Date", "Category", "Person", "Flat", "Mode", "Receipt / Ref", "Description", "Amount (INR)"], rows: income.map((r) => [dateText(r.transaction_date), r.category?.name || "-", r.person_name || "-", r.flat?.flat_number || "-", r.payment_mode.replaceAll("_", " "), r.receipt_number || r.reference_number || "-", r.description || "-", amount(r.amount)]), totalLabel: "Total Income", total: incomeTotal };
    if (key === "expense") return { title: "Expense Report", subtitle: "All-time expense transactions", headers: ["Date", "Category", "Vendor", "Mode", "Bill / Ref", "Description", "Amount (INR)"], rows: expenses.map((r) => [dateText(r.transaction_date), r.category?.name || "-", r.vendor_name || "-", r.payment_mode.replaceAll("_", " "), r.bill_number || r.reference_number || "-", r.description || "-", amount(r.amount)]), totalLabel: "Total Expense", total: expenseTotal };
    if (key === "maintenance" || key === "pending") {
      const source = key === "pending" ? yearBills.filter((r) => Number(r.pending_amount) > 0) : yearBills.filter((r) => Number(r.paid_amount) > 0);
      return { title: key === "pending" ? "Pending Maintenance Report" : "Maintenance Collection Report", subtitle: `${year} flat-wise maintenance`, headers: ["Flat", "Owner", "Wing", "Period", "Due", "Paid Date", "Status", "Total", "Paid", "Pending"], rows: source.map((r) => [r.flat?.flat_number || "-", r.flat?.owner_name || "-", r.flat?.wing?.name || "-", `${monthName(r.bill_month)} ${r.bill_year}${r.period_months > 1 ? ` (${r.period_months} months)` : ""}`, dateText(r.due_date), dateText(r.payment_date), r.status.replaceAll("_", " "), amount(r.total_amount), amount(r.paid_amount), amount(r.pending_amount)]), totalLabel: key === "pending" ? "Total Pending" : "Total Collected", total: key === "pending" ? pending : collected };
    }
    const periods = new Map<string, { label: string; income: number; expense: number }>();
    const monthly = key === "monthly";
    const add = (date: string, field: "income" | "expense", value: number) => {
      const d = new Date(`${date}T00:00:00`); if (monthly && d.getFullYear() !== year) return;
      const periodKey = monthly ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : String(d.getFullYear());
      const label = monthly ? d.toLocaleString("en-IN", { month: "long", year: "numeric" }) : String(d.getFullYear());
      const current = periods.get(periodKey) || { label, income: 0, expense: 0 }; current[field] += Number(value); periods.set(periodKey, current);
    };
    income.forEach((r) => add(r.transaction_date, "income", r.amount)); expenses.forEach((r) => add(r.transaction_date, "expense", r.amount));
    const rows = [...periods.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([, r]) => [r.label, amount(r.income), amount(r.expense), amount(r.income - r.expense)]);
    return { title: monthly ? "Monthly Financial Summary" : "Yearly Financial Summary", subtitle: monthly ? `${year} income, expense, and balance` : "Year-wise income, expense, and balance", headers: [monthly ? "Month" : "Year", "Income (INR)", "Expense (INR)", "Balance (INR)"], rows, totalLabel: "Current Balance", total: incomeTotal - expenseTotal };
  }

  async function downloadPdf(key: ReportKey) {
    setDownloading(`${key}-pdf`);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const report = makeReport(key); const doc = new jsPDF({ orientation: report.headers.length > 7 ? "landscape" : "portrait", unit: "mm", format: "a4" });
      doc.setFillColor(29, 78, 216); doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text(society?.name || "Society Management", 14, 12);
      doc.setFontSize(10); doc.text([society?.address, society?.city, society?.state].filter(Boolean).join(", ") || "Society financial report", 14, 20); doc.setTextColor(15, 23, 42); doc.setFontSize(16); doc.text(report.title, 14, 39);
      doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(`${report.subtitle} | Generated: ${new Date().toLocaleString("en-IN")}`, 14, 46); doc.setTextColor(15, 23, 42); doc.setFontSize(12); doc.text(`${report.totalLabel}: INR ${amount(report.total)}`, 14, 55);
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
    { key: "maintenance", title: "Maintenance Collection", note: `${year} collected`, value: collected }, { key: "pending", title: "Pending Maintenance", note: `${year} pending`, value: pending },
    { key: "monthly", title: "Monthly Summary", note: `${year} month-wise summary`, value: incomeTotal - expenseTotal }, { key: "yearly", title: "Yearly Summary", note: "Year-wise financial summary", value: incomeTotal - expenseTotal },
  ];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((report) => <Card key={report.key}><CardHeader title={report.title} description={report.note} /><CardContent><p className="text-2xl font-semibold text-slate-900">{formatCurrency(report.value)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" loading={downloading === `${report.key}-pdf`} onClick={() => downloadPdf(report.key)}><FileText className="h-4 w-4" />Download PDF</Button><Button size="sm" variant="outline" loading={downloading === `${report.key}-excel`} onClick={() => downloadExcel(report.key)}><FileSpreadsheet className="h-4 w-4" />Download Excel</Button></div><p className="mt-3 flex items-center gap-1 text-xs text-slate-400"><Download className="h-3.5 w-3.5" />Includes summary and detailed records</p></CardContent></Card>)}</div>;
}
