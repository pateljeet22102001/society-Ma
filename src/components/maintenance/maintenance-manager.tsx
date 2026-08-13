"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Flat, MaintenanceBill, MaintenanceSettings, PaymentMode, Wing } from "@/types/database";
import {
  generateMaintenanceSchema,
  type GenerateMaintenanceInput,
} from "@/lib/validations/finance";
import {
  addMaintenancePaymentAction,
  generateMaintenanceBillsAction,
  undoLastMaintenancePaymentAction,
} from "@/lib/actions/maintenance";
import {
  BILLING_FREQUENCIES,
  billingFrequencyLabel,
  MAINTENANCE_STATUSES,
  MONTHS,
  PAGE_SIZE,
  PAYMENT_MODES,
} from "@/lib/constants";
import { billingPeriodLabel, cn, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlertCircle, CheckCircle2, Clock3, IndianRupee } from "lucide-react";

interface MaintenanceManagerProps {
  bills: MaintenanceBill[];
  flats: Flat[];
  wings: Wing[];
  settings: MaintenanceSettings | null;
}

export function MaintenanceManager({ bills, flats, wings, settings }: MaintenanceManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(searchParams.get("pay") === "1");
  const [selectedBill, setSelectedBill] = useState<MaintenanceBill | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [pickFlatMode, setPickFlatMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [undoingBill, setUndoingBill] = useState<MaintenanceBill | null>(null);

  const frequencyMonths = Number(settings?.billing_frequency_months || 1);

  const generateForm = useForm<GenerateMaintenanceInput>({
    resolver: zodResolver(generateMaintenanceSchema),
    defaultValues: {
      bill_month: new Date().getMonth() + 1,
      bill_year: new Date().getFullYear(),
      amount: Number(settings?.default_amount || 1500),
      late_fee: Number(settings?.late_fee || 0),
    },
  });

  const pendingBills = useMemo(
    () => bills.filter((b) => b.status !== "paid" && Number(b.pending_amount) > 0),
    [bills],
  );

  const watchedStartMonth = Number(generateForm.watch("bill_month") || 1);
  const watchedStartYear = Number(generateForm.watch("bill_year") || new Date().getFullYear());
  const previewPeriod = billingPeriodLabel(watchedStartMonth, watchedStartYear, frequencyMonths);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((bill) => {
      const flat = bill.flat || flats.find((f) => f.id === bill.flat_id);
      const matchesSearch = !q || flat?.flat_number.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || bill.status === statusFilter;
      const matchesWing = !wingFilter || flat?.wing_id === wingFilter;
      const matchesMonth = !monthFilter || String(bill.bill_month) === monthFilter;
      const matchesYear = !yearFilter || String(bill.bill_year) === yearFilter;
      return matchesSearch && matchesStatus && matchesWing && matchesMonth && matchesYear;
    });
  }, [bills, flats, search, statusFilter, wingFilter, monthFilter, yearFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary = useMemo(() => {
    const totalExpected = filtered.reduce((s, b) => s + Number(b.total_amount), 0);
    const totalCollected = filtered.reduce((s, b) => s + Number(b.paid_amount), 0);
    const totalPending = filtered.reduce((s, b) => s + Number(b.pending_amount), 0);
    const totalOverdue = filtered
      .filter((b) => b.status === "overdue")
      .reduce((s, b) => s + Number(b.pending_amount), 0);
    const paidFlats = new Set(filtered.filter((b) => b.status === "paid").map((b) => b.flat_id)).size;
    const pendingFlats = new Set(
      filtered.filter((b) => b.status !== "paid").map((b) => b.flat_id),
    ).size;
    return { totalExpected, totalCollected, totalPending, totalOverdue, paidFlats, pendingFlats };
  }, [filtered]);

  function selectBillForPayment(bill: MaintenanceBill | null) {
    setSelectedBill(bill);
    setPayAmount(bill ? String(Number(bill.pending_amount)) : "");
  }

  function openPay(bill?: MaintenanceBill) {
    if (bill) {
      selectBillForPayment(bill);
      setPickFlatMode(false);
    } else {
      selectBillForPayment(null);
      setPickFlatMode(true);
    }
    setPaymentMode("upi");
    setPayOpen(true);
  }

  async function onGenerate(values: GenerateMaintenanceInput) {
    setLoading(true);
    const result = await generateMaintenanceBillsAction(values);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setGenerateOpen(false);
    router.refresh();
  }

  async function onPay() {
    if (!selectedBill) {
      toast.error("Please select a flat");
      return;
    }
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > Number(selectedBill.pending_amount)) {
      toast.error("Amount cannot exceed pending amount");
      return;
    }

    setLoading(true);
    const result = await addMaintenancePaymentAction({
      bill_id: selectedBill.id,
      amount,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_mode: paymentMode,
    });
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setPayOpen(false);
    router.refresh();
  }

  async function onUndoPayment() {
    if (!undoingBill) return;

    setLoading(true);
    const result = await undoLastMaintenancePaymentAction(undoingBill.id);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setUndoingBill(null);
    router.refresh();
  }

  function getFlatNumber(bill: MaintenanceBill) {
    return bill.flat?.flat_number || flats.find((f) => f.id === bill.flat_id)?.flat_number || "—";
  }

  const columns: Column<MaintenanceBill>[] = [
    {
      key: "flat",
      header: "Flat",
      render: (row) => row.flat?.flat_number || flats.find((f) => f.id === row.flat_id)?.flat_number || "—",
    },
    {
      key: "period",
      header: "Billing Period",
      render: (row) =>
        billingPeriodLabel(row.bill_month, row.bill_year, Number(row.period_months || 1)),
    },
    { key: "amount", header: "Maintenance", render: (row) => formatCurrency(row.maintenance_amount) },
    { key: "outstanding", header: "Prev. Outstanding", render: (row) => formatCurrency(row.previous_outstanding) },
    { key: "late", header: "Late Fee", render: (row) => formatCurrency(row.late_fee) },
    { key: "total", header: "Total", render: (row) => formatCurrency(row.total_amount) },
    { key: "paid", header: "Paid", render: (row) => formatCurrency(row.paid_amount) },
    { key: "pending", header: "Pending", render: (row) => formatCurrency(row.pending_amount) },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={statusBadgeVariant(row.status)}>{row.status.replace("_", " ")}</Badge>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total Expected" value={formatCurrency(summary.totalExpected)} icon={IndianRupee} />
        <StatCard title="Total Collected" value={formatCurrency(summary.totalCollected)} icon={CheckCircle2} tone="green" />
        <StatCard title="Total Pending" value={formatCurrency(summary.totalPending)} icon={Clock3} tone="amber" />
        <StatCard title="Total Overdue" value={formatCurrency(summary.totalOverdue)} icon={AlertCircle} tone="rose" />
        <StatCard title="Paid Flats" value={String(summary.paidFlats)} icon={CheckCircle2} tone="green" />
        <StatCard title="Pending Flats" value={String(summary.pendingFlats)} icon={Clock3} tone="amber" />
      </div>

      <Card>
        <CardHeader
          title="Maintenance Bills"
          description={`Cycle: ${billingFrequencyLabel(frequencyMonths)}. Generate → flats become Pending → click Pay → Amount + Payment Method.`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setGenerateOpen(true)}>
                <Plus className="h-4 w-4" />
                Generate Bills
              </Button>
              <Button onClick={() => openPay()} disabled={!pendingBills.length}>
                <Wallet className="h-4 w-4" />
                Add Payment
              </Button>
            </div>
          }
        />
        <CardContent className="space-y-4 !pt-0">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search flat..." />
            <Select options={[{ value: "", label: "All Statuses" }, ...MAINTENANCE_STATUSES.map((s) => ({ value: s.value, label: s.label }))]} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} />
            <Select options={[{ value: "", label: "All Wings" }, ...wings.map((w) => ({ value: w.id, label: `Wing ${w.name}` }))]} value={wingFilter} onChange={(e) => { setWingFilter(e.target.value); setPage(1); }} />
            <Select options={[{ value: "", label: "All Months" }, ...MONTHS]} value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }} />
            <Input
              type="number"
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
              placeholder="Year"
            />
          </div>
        </CardContent>
        <DataTable
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          emptyTitle="No maintenance bills"
          emptyDescription="Click Generate Bills. All active flats will become Pending for that period."
          actions={(row) =>
            Number(row.paid_amount) > 0 ? (
              <div className="flex items-center justify-end gap-2">
                {Number(row.pending_amount) > 0 ? (
                  <Button size="sm" onClick={() => openPay(row)}>
                    Pay
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">{formatDate(row.payment_date)}</span>
                )}
                <Button size="sm" variant="outline" onClick={() => setUndoingBill(row)}>
                  Undo payment
                </Button>
              </div>
            ) : row.status !== "paid" ? (
              <Button size="sm" onClick={() => openPay(row)}>
                Pay
              </Button>
            ) : (
              <span className="text-xs text-slate-400">{formatDate(row.payment_date)}</span>
            )
          }
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      <Modal open={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate Maintenance Bills">
        <form className="space-y-4" onSubmit={generateForm.handleSubmit(onGenerate)}>
          <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Period will be: <strong>{previewPeriod}</strong>
            <br />
            All active flats will become <strong>Pending</strong> for this period.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={frequencyMonths > 1 ? "From Month (start)" : "Month"}
              options={[...MONTHS]}
              {...generateForm.register("bill_month")}
            />
            <Input label="Year" type="number" {...generateForm.register("bill_year")} />
            <Input
              label={
                frequencyMonths === 3
                  ? "Amount (full 3 months)"
                  : frequencyMonths === 6
                    ? "Amount (full 6 months)"
                    : "Amount (1 month)"
              }
              type="number"
              {...generateForm.register("amount")}
            />
            <Input label="Late Fee" type="number" {...generateForm.register("late_fee")} />
          </div>
          <p className="text-xs text-slate-500">
            Frequency from Settings: {BILLING_FREQUENCIES.map((f) => f.label).join(" / ")}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Generate Pending Bills</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Collect Payment"
        description={
          selectedBill
            ? `${getFlatNumber(selectedBill)} · ${billingPeriodLabel(selectedBill.bill_month, selectedBill.bill_year, Number(selectedBill.period_months || 1))} · Pending ${formatCurrency(selectedBill.pending_amount)}`
            : "Select a pending flat, then enter amount and payment method."
        }
      >
        <div className="space-y-5">
          {pickFlatMode || !selectedBill ? (
            <Select
              label="Pending Flat"
              placeholder="Select flat"
              options={pendingBills.map((bill) => ({
                value: bill.id,
                label: `${getFlatNumber(bill)} · ${billingPeriodLabel(bill.bill_month, bill.bill_year, Number(bill.period_months || 1))} · ${formatCurrency(bill.pending_amount)}`,
              }))}
              value={selectedBill?.id || ""}
              onChange={(e) => {
                const bill = pendingBills.find((b) => b.id === e.target.value) || null;
                selectBillForPayment(bill);
              }}
            />
          ) : null}

          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Enter amount"
          />

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Payment Method</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAYMENT_MODES.map((mode) => {
                const active = paymentMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setPaymentMode(mode.value)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-sm font-medium transition",
                      active
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button type="button" loading={loading} onClick={onPay} disabled={!selectedBill}>
              <Wallet className="h-4 w-4" />
              Save Payment
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(undoingBill)}
        title="Undo last payment?"
        description={
          undoingBill
            ? `The most recent payment for flat ${getFlatNumber(undoingBill)} will be removed and the outstanding amount will be recalculated.`
            : "The most recent maintenance payment will be removed."
        }
        confirmLabel="Undo payment"
        loading={loading}
        onConfirm={onUndoPayment}
        onClose={() => setUndoingBill(null)}
      />
    </div>
  );
}
