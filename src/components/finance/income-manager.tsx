"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Flat, IncomeCategory, IncomeTransaction } from "@/types/database";
import { incomeSchema, type IncomeInput } from "@/lib/validations/finance";
import { createIncomeAction, deleteIncomeAction, updateIncomeAction } from "@/lib/actions/income";
import { PAGE_SIZE, PAYMENT_MODES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";

interface IncomeManagerProps {
  items: IncomeTransaction[];
  categories: IncomeCategory[];
  flats: Flat[];
}

export function IncomeManager({ items, categories, flats }: IncomeManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<IncomeTransaction | null>(null);
  const [deleting, setDeleting] = useState<IncomeTransaction | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<IncomeInput>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().slice(0, 10),
      category_id: categories[0]?.id || "",
      payment_mode: "cash",
      amount: 0,
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items.filter((item) => {
      const matchesCategory = !categoryFilter || item.category_id === categoryFilter;
      const matchesSearch =
        !q ||
        item.person_name?.toLowerCase().includes(q) ||
        item.receipt_number?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.name?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "amount_desc") return Number(b.amount) - Number(a.amount);
      if (sort === "amount_asc") return Number(a.amount) - Number(b.amount);
      if (sort === "date_asc") return a.transaction_date.localeCompare(b.transaction_date);
      return b.transaction_date.localeCompare(a.transaction_date);
    });

    return rows;
  }, [items, search, categoryFilter, sort]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    form.reset({
      transaction_date: new Date().toISOString().slice(0, 10),
      category_id: categories[0]?.id || "",
      flat_id: "",
      person_name: "",
      amount: 0,
      payment_mode: "cash",
      reference_number: "",
      description: "",
      receipt_number: "",
    });
    setOpen(true);
  }

  function openEdit(item: IncomeTransaction) {
    setEditing(item);
    form.reset({
      transaction_date: item.transaction_date,
      category_id: item.category_id,
      flat_id: item.flat_id || "",
      person_name: item.person_name || "",
      amount: Number(item.amount),
      payment_mode: item.payment_mode,
      reference_number: item.reference_number || "",
      description: item.description || "",
      receipt_number: item.receipt_number || "",
    });
    setOpen(true);
  }

  async function onSubmit(values: IncomeInput) {
    setLoading(true);
    const result = editing
      ? await updateIncomeAction(editing.id, values)
      : await createIncomeAction(values);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setLoading(true);
    const result = await deleteIncomeAction(deleting.id);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setDeleting(null);
    router.refresh();
  }

  const columns: Column<IncomeTransaction>[] = [
    { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
    { key: "category", header: "Category", render: (row) => row.category?.name || "—" },
    { key: "person", header: "Person", render: (row) => row.person_name || "—" },
    { key: "flat", header: "Flat", render: (row) => row.flat?.flat_number || "—" },
    {
      key: "amount",
      header: "Amount",
      render: (row) => <span className="font-semibold text-emerald-600">{formatCurrency(row.amount)}</span>,
    },
    { key: "mode", header: "Mode", render: (row) => row.payment_mode.replace("_", " ") },
  ];

  return (
    <>
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search income..." />
          <Select
            options={[{ value: "", label: "All Categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          />
          <Select
            options={[
              { value: "date_desc", label: "Newest first" },
              { value: "date_asc", label: "Oldest first" },
              { value: "amount_desc", label: "Amount high-low" },
              { value: "amount_asc", label: "Amount low-high" },
            ]}
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Income
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          emptyTitle="No income records"
          actions={(row) => (
            <>
              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </>
          )}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Income" : "Add Income"} size="lg">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" error={form.formState.errors.transaction_date?.message} {...form.register("transaction_date")} />
            <Select label="Income Category" options={categories.map((c) => ({ value: c.id, label: c.name }))} error={form.formState.errors.category_id?.message} {...form.register("category_id")} />
            <Select label="Flat Number (optional)" options={[{ value: "", label: "Not applicable" }, ...flats.map((f) => ({ value: f.id, label: f.flat_number }))]} {...form.register("flat_id")} />
            <Input label="Person Name" {...form.register("person_name")} />
            <Input label="Amount" type="number" step="0.01" error={form.formState.errors.amount?.message} {...form.register("amount")} />
            <Select label="Payment Mode" options={[...PAYMENT_MODES]} {...form.register("payment_mode")} />
            <Input label="Reference Number" {...form.register("reference_number")} />
            <Input label="Receipt Number" {...form.register("receipt_number")} />
          </div>
          <Textarea label="Description" {...form.register("description")} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>{editing ? "Save Changes" : "Add Income"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete income?"
        description="This income record will be permanently deleted."
        loading={loading}
        onConfirm={confirmDelete}
      />
    </>
  );
}
