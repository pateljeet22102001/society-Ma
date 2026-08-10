"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Flat, MaintenanceBill, MaintenanceSettings, Wing } from "@/types/database";
import {
  generateMaintenanceSchema,
  maintenancePaymentSchema,
  type GenerateMaintenanceInput,
  type MaintenancePaymentInput,
} from "@/lib/validations/finance";
import {
  addMaintenancePaymentAction,
  generateMaintenanceBillsAction,
} from "@/lib/actions/maintenance";
import {
  BILLING_FREQUENCIES,
  billingFrequencyLabel,
  MAINTENANCE_STATUSES,
  MONTHS,
  PAGE_SIZE,
  PAYMENT_MODES,
} from "@/lib/constants";
import { billingPeriodLabel, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
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
  const [loading, setLoading] = useState(false);

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

  const payForm = useForm<MaintenancePaymentInput>({
    resolver: zodResolver(maintenancePaymentSchema),
    defaultValues: {
      bill_id: "",
      amount: 0,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_mode: "upi",
    },
  });

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

  function openPay(bill?: MaintenanceBill) {
    const target = bill || filtered.find((b) => b.status !== "paid") || null;
    setSelectedBill(target);
    payForm.reset({
      bill_id: target?.id || "",
      amount: Number(target?.pending_amount || 0),
      payment_date: new Date().toISOString().slice(0, 10),
      payment_mode: "upi",
      reference_number: "",
      notes: "",
    });
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

  async function onPay(values: MaintenancePaymentInput) {
    setLoading(true);
    const result = await addMaintenancePaymentAction(values);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setPayOpen(false);
    router.refresh();
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
          description={`Current cycle: ${billingFrequencyLabel(frequencyMonths)}. Generate bills and record full or partial payments.`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setGenerateOpen(true)}>
                <Plus className="h-4 w-4" />
                Generate Bills
              </Button>
              <Button onClick={() => openPay()}>
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
          emptyDescription="Generate bills for the selected month and year."
          actions={(row) =>
            row.status !== "paid" ? (
              <Button size="sm" variant="outline" onClick={() => openPay(row)}>
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
            Billing frequency: <strong>{billingFrequencyLabel(frequencyMonths)}</strong>
            {frequencyMonths > 1
              ? ". Choose the starting month of the period (example: Apr for Apr–Jun)."
              : ". Choose the billing month."}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={frequencyMonths > 1 ? "Period Start Month" : "Month"}
              options={[...MONTHS]}
              {...generateForm.register("bill_month")}
            />
            <Input label="Year" type="number" {...generateForm.register("bill_year")} />
            <Input
              label={
                frequencyMonths === 3
                  ? "Amount (for 3 months)"
                  : frequencyMonths === 6
                    ? "Amount (for 6 months)"
                    : "Amount (for 1 month)"
              }
              type="number"
              {...generateForm.register("amount")}
            />
            <Input label="Late Fee" type="number" {...generateForm.register("late_fee")} />
          </div>
          <p className="text-xs text-slate-500">
            Change frequency anytime in Settings → Maintenance Settings:{" "}
            {BILLING_FREQUENCIES.map((f) => f.label).join(" / ")}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Generate</Button>
          </div>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Add Maintenance Payment">
        <form className="space-y-4" onSubmit={payForm.handleSubmit(onPay)}>
          <Select
            label="Bill / Flat"
            options={bills
              .filter((b) => b.status !== "paid")
              .map((b) => ({
                value: b.id,
                label: `${b.flat?.flat_number || flats.find((f) => f.id === b.flat_id)?.flat_number} • ${billingPeriodLabel(b.bill_month, b.bill_year, Number(b.period_months || 1))} • Pending ${formatCurrency(b.pending_amount)}`,
              }))}
            {...payForm.register("bill_id", {
              onChange: (e) => {
                const bill = bills.find((b) => b.id === e.target.value);
                setSelectedBill(bill || null);
                if (bill) payForm.setValue("amount", Number(bill.pending_amount));
              },
            })}
          />
          {selectedBill ? (
            <p className="text-sm text-slate-500">
              Pending amount: {formatCurrency(selectedBill.pending_amount)}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount" type="number" step="0.01" {...payForm.register("amount")} />
            <Input label="Payment Date" type="date" {...payForm.register("payment_date")} />
            <Select label="Payment Mode" options={[...PAYMENT_MODES]} {...payForm.register("payment_mode")} />
            <Input label="Reference Number" {...payForm.register("reference_number")} />
          </div>
          <Textarea label="Notes" {...payForm.register("notes")} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
