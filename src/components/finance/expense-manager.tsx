"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ExpenseCategory, ExpenseTransaction } from "@/types/database";
import { expenseCategorySchema, expenseSchema, type ExpenseCategoryInput, type ExpenseInput } from "@/lib/validations/finance";
import {
  createExpenseAction,
  createExpenseCategoryAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/lib/actions/expenses";
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

interface ExpenseManagerProps {
  items: ExpenseTransaction[];
  categories: ExpenseCategory[];
}

export function ExpenseManager({ items, categories }: ExpenseManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<ExpenseTransaction | null>(null);
  const [deleting, setDeleting] = useState<ExpenseTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [warning, setWarning] = useState<{ values: ExpenseInput; message: string } | null>(null);

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().slice(0, 10),
      category_id: categories[0]?.id || "",
      payment_mode: "cash",
      amount: 0,
    },
  });
  const categoryForm = useForm<ExpenseCategoryInput>({ resolver: zodResolver(expenseCategorySchema), defaultValues: { name: "" } });

  async function onAddCategory(values: ExpenseCategoryInput) {
    setLoading(true); const result = await createExpenseCategoryAction(values); setLoading(false);
    if (!result.success) { toast.error(result.message); return; }
    toast.success(result.message); categoryForm.reset(); setCategoryOpen(false); router.refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items.filter((item) => {
      const matchesCategory = !categoryFilter || item.category_id === categoryFilter;
      const matchesSearch =
        !q ||
        item.vendor_name?.toLowerCase().includes(q) ||
        item.voucher_number?.toLowerCase().includes(q) ||
        item.bill_number?.toLowerCase().includes(q) ||
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
      vendor_name: "",
      amount: 0,
      payment_mode: "cash",
      reference_number: "",
      description: "",
      bill_number: "",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(item: ExpenseTransaction) {
    setEditing(item);
    form.reset({
      transaction_date: item.transaction_date,
      category_id: item.category_id,
      vendor_name: item.vendor_name || "",
      amount: Number(item.amount),
      payment_mode: item.payment_mode,
      reference_number: item.reference_number || "",
      description: item.description || "",
      bill_number: item.bill_number || "",
      notes: item.notes || "",
    });
    setOpen(true);
  }

  async function saveExpense(values: ExpenseInput, confirmed = false) {
    setLoading(true);
    const result = editing
      ? await updateExpenseAction(editing.id, values, confirmed)
      : await createExpenseAction(values, confirmed);
    setLoading(false);
    if (!result.success) {
      if (result.requiresConfirmation) {
        setWarning({ values, message: result.message || "Please confirm this entry." });
        return;
      }
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setWarning(null);
    setOpen(false);
    router.refresh();
  }

  async function onSubmit(values: ExpenseInput) {
    await saveExpense(values);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const reason = window.prompt("Enter the reason for voiding this expense voucher:");
    if (!reason?.trim()) return;
    setLoading(true);
    const result = await deleteExpenseAction(deleting.id, reason);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setDeleting(null);
    router.refresh();
  }

  const columns: Column<ExpenseTransaction>[] = [
    { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
    { key: "category", header: "Category", render: (row) => row.category?.name || "—" },
    { key: "vendor", header: "Vendor / Paid To", render: (row) => row.vendor_name || "—" },
    {
      key: "amount",
      header: "Amount",
      render: (row) => <span className="font-semibold text-rose-600">{formatCurrency(row.amount)}</span>,
    },
    { key: "mode", header: "Mode", render: (row) => row.payment_mode.replace("_", " ") },
    { key: "voucher", header: "Voucher No.", render: (row) => row.voucher_number || "—" },
    { key: "bill", header: "Bill No.", render: (row) => row.bill_number || "—" },
  ];

  return (
    <>
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search expenses..." />
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
          <div className="flex gap-2"><Button variant="outline" onClick={() => setCategoryOpen(true)}><Plus className="h-4 w-4" />Category</Button><Button onClick={openCreate} disabled={!categories.length}><Plus className="h-4 w-4" />Add Expense</Button></div>
        </div>
        <DataTable
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          emptyTitle="No expense records"
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Expense" : "Add Expense"} size="lg">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" error={form.formState.errors.transaction_date?.message} {...form.register("transaction_date")} />
            <Select label="Expense Category" options={categories.map((c) => ({ value: c.id, label: c.name }))} error={form.formState.errors.category_id?.message} {...form.register("category_id")} />
            <Input label="Vendor / Paid To" {...form.register("vendor_name")} />
            <Input label="Amount" type="number" min="0.01" step="0.01" error={form.formState.errors.amount?.message} {...form.register("amount")} />
            <Select label="Payment Mode" options={[...PAYMENT_MODES]} {...form.register("payment_mode")} />
            <Input label="Reference Number" {...form.register("reference_number")} />
            <Input label="Voucher Number" value={editing?.voucher_number || "Generated after saving"} disabled />
            <Input label="Bill Number" {...form.register("bill_number")} />
          </div>
          <Textarea label="Description" {...form.register("description")} />
          <Textarea label="Notes" {...form.register("notes")} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>{editing ? "Save Changes" : "Add Expense"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={categoryOpen} onClose={() => setCategoryOpen(false)} title="Add Expense Category" description="Create a reusable Javak category for this society.">
        <form className="space-y-4" onSubmit={categoryForm.handleSubmit(onAddCategory)}>
          <Input label="Category Name" placeholder="Example: Building Repair" error={categoryForm.formState.errors.name?.message} {...categoryForm.register("name")} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button><Button type="submit" loading={loading}>Add Category</Button></div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!warning}
        onClose={() => setWarning(null)}
        title="Check expense entry"
        description={warning?.message || "Please confirm this entry."}
        confirmLabel="Continue and save"
        loading={loading}
        onConfirm={() => warning && saveExpense(warning.values, true)}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Void expense voucher?"
        description="The voucher will remain in the audit history and will be excluded from totals. A reason is required."
        confirmLabel="Continue"
        loading={loading}
        onConfirm={confirmDelete}
      />
    </>
  );
}
