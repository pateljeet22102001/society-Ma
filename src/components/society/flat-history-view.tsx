"use client";

import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import type { Flat, IncomeTransaction, MaintenanceBill, MaintenancePayment } from "@/types/database";
import { billingPeriodLabel, formatCurrency, formatDate } from "@/lib/utils";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

interface FlatHistoryViewProps {
  flat: Flat;
  income: IncomeTransaction[];
  bills: MaintenanceBill[];
  payments: MaintenancePayment[];
}

export function FlatHistoryView({ flat, income, bills, payments }: FlatHistoryViewProps) {
  const pendingTotal = bills.reduce((sum, bill) => sum + Number(bill.pending_amount || 0), 0);
  const paidTotal = bills.reduce((sum, bill) => sum + Number(bill.paid_amount || 0), 0);
  const incomeTotal = income.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={`Flat ${flat.flat_number}`}
        description={[
          flat.wing?.name ? `Wing ${flat.wing.name}` : null,
          flat.owner_name ? `Owner: ${flat.owner_name}` : null,
          flat.resident_name ? `Resident: ${flat.resident_name}` : null,
          flat.mobile_number || null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/society/flats"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              All flats
            </Link>
            <Link
              href="/maintenance?pay=1"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Wallet className="h-4 w-4" />
              Collect payment
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Income linked</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">{formatCurrency(incomeTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Maintenance paid</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(paidTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Pending</p>
            <p className="mt-1 text-xl font-semibold text-amber-600">{formatCurrency(pendingTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Maintenance bills" description="All generated bills for this flat." />
        <CardContent className="p-0">
          {bills.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No maintenance bills yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {bills.map((bill) => (
                <div key={bill.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {billingPeriodLabel(bill.bill_month, bill.bill_year, Number(bill.period_months || 1))}
                    </p>
                    <p className="text-xs text-slate-500">
                      Due {formatDate(bill.due_date)} · Total {formatCurrency(bill.total_amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-slate-500">
                      <p>Paid {formatCurrency(bill.paid_amount)}</p>
                      <p>Pending {formatCurrency(bill.pending_amount)}</p>
                    </div>
                    <Badge variant={statusBadgeVariant(bill.status)}>{bill.status.replaceAll("_", " ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Payment receipts" description="Maintenance collections with MNT receipt numbers." />
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No maintenance payments yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{payment.receipt_number || "—"}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(payment.payment_date)} · {String(payment.payment_mode).replaceAll("_", " ")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Income history" description="All income entries linked to this flat, including maintenance mirrors." />
        <CardContent className="p-0">
          {income.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No income records for this flat.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {income.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {row.receipt_number || row.person_name || "Income"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {[formatDate(row.transaction_date), row.category?.name, row.description]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-600">{formatCurrency(row.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
