"use client";

import { Printer, X } from "lucide-react";
import type { Society } from "@/types/database";
import {
  paymentModeLabel,
  slipTitle,
  societyAddressLine,
  type PrintSlipData,
} from "@/lib/print-slip";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PrintSlipModalProps {
  open: boolean;
  society: Society | null;
  slip: PrintSlipData | null;
  onClose: () => void;
}

export function PrintSlipModal({ open, society, slip, onClose }: PrintSlipModalProps) {
  if (!open || !slip) return null;

  const isExpense = slip.type === "expense_voucher";

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4 print:static print:bg-transparent print:p-0">
      <button
        type="button"
        aria-label="Close receipt"
        className="absolute inset-0 print:hidden"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl print:max-h-none print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 print:hidden sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{slipTitle(slip.type)}</h2>
            <p className="text-sm text-slate-500">Preview, print, or save as PDF to share on WhatsApp.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div id="print-slip" className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6 print:border-0 print:p-0">
            <div className="border-b border-slate-200 pb-4 text-center">
              <p className="text-xl font-bold tracking-tight">{society?.name || "Society Management"}</p>
              {societyAddressLine(society) ? (
                <p className="mt-1 text-sm text-slate-600">{societyAddressLine(society)}</p>
              ) : null}
              <p className="mt-1 text-sm text-slate-600">
                {[society?.phone ? `Phone: ${society.phone}` : null, society?.email || null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {society?.registration_number ? (
                <p className="mt-1 text-xs text-slate-500">Reg. No: {society.registration_number}</p>
              ) : null}
              <p className="mt-3 text-base font-semibold uppercase tracking-wide text-primary">
                {slipTitle(slip.type)}
              </p>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {isExpense ? "Voucher No." : "Receipt No."}
                </p>
                <p className="font-semibold">{slip.documentNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Date</p>
                <p className="font-semibold">{formatDate(slip.date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {isExpense ? "Paid To" : "Received From"}
                </p>
                <p className="font-semibold">{slip.partyName || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Flat</p>
                <p className="font-semibold">{slip.flatNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Category</p>
                <p className="font-semibold">{slip.category || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Payment Mode</p>
                <p className="font-semibold capitalize">{paymentModeLabel(String(slip.paymentMode))}</p>
              </div>
              {slip.periodLabel ? (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Billing Period</p>
                  <p className="font-semibold">{slip.periodLabel}</p>
                </div>
              ) : null}
              {slip.referenceNumber ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Reference</p>
                  <p className="font-semibold">{slip.referenceNumber}</p>
                </div>
              ) : null}
              {slip.billNumber ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Bill No.</p>
                  <p className="font-semibold">{slip.billNumber}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Amount</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{formatCurrency(slip.amount)}</p>
            </div>

            {slip.description ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Particulars</p>
                <p className="mt-1 text-sm text-slate-700">{slip.description}</p>
              </div>
            ) : null}

            <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
              <div className="border-t border-slate-200 pt-3">
                <p className="text-slate-500">{isExpense ? "Receiver Signature" : "Payer Signature"}</p>
              </div>
              <div className="border-t border-slate-200 pt-3 text-right">
                <p className="text-slate-500">Authorized Signatory</p>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Generated by Society Management · {new Date().toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-3 print:hidden sm:flex-row sm:justify-end sm:px-5">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
