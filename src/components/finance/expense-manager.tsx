"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ExpenseCategory, ExpenseTransaction, Society } from "@/types/database";
import { expenseCategorySchema, expenseSchema, type ExpenseCategoryInput, type ExpenseInput } from "@/lib/validations/finance";
import {
  createExpenseAction,
  createExpenseCategoryAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/lib/actions/expenses";
import { PAGE_SIZE, PAYMENT_MODES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PrintSlipData } from "@/lib/print-slip";
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
import { PrintSlipModal } from "@/components/print/print-slip-modal";

interface ExpenseManagerProps {
  society: Society | null;
  items: ExpenseTransaction[];
  categories: ExpenseCategory[];
  total: number;
  page: number;
  initialSearch: string;
  categoryFilter: string;
  sort: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
}

export function ExpenseManager({ society, items, categories, total, page, initialSearch, categoryFilter, sort }: ExpenseManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<ExpenseTransaction | null>(null);
  const [deleting, setDeleting] = useState<ExpenseTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [warning, setWarning] = useState<{ values: ExpenseInput; message: string } | null>(null);
  const [printSlip, setPrintSlip] = useState<PrintSlipData | null>(null);

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

  const updateQuery = useCallback((changes: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, next]) => {
      if (next === "" || next === 1) params.delete(key); else params.set(key, String(next));
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (search === (searchParams.get("search") || "")) return;
    const timer = window.setTimeout(() => updateQuery({ search: search.trim(), page: 1 }), 350);
    return () => window.clearTimeout(timer);
  }, [search, searchParams, updateQuery]);

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
    if (!editing && result.printSlip) setPrintSlip(result.printSlip);
    router.refresh();
  }

  function openPrint(row: ExpenseTransaction) {
    setPrintSlip({
      type: "expense_voucher",
      documentNumber: row.voucher_number || "—",
      date: row.transaction_date,
      amount: Number(row.amount),
      paymentMode: row.payment_mode,
      partyName: row.vendor_name,
      category: row.category?.name || null,
      description: row.description || row.notes,
      referenceNumber: row.reference_number,
      billNumber: row.bill_number,
    });
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search expenses..." />
          <Select
            options={[{ value: "", label: "All Categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            value={categoryFilter}
            onChange={(e) => updateQuery({ category: e.target.value, page: 1 })}
          />
          <Select
            options={[
              { value: "date_desc", label: "Newest first" },
              { value: "date_asc", label: "Oldest first" },
              { value: "amount_desc", label: "Amount high-low" },
              { value: "amount_asc", label: "Amount low-high" },
            ]}
            value={sort}
            onChange={(e) => updateQuery({ sort: e.target.value, page: 1 })}
          />
          <div className="flex gap-2"><Button variant="outline" onClick={() => setCategoryOpen(true)}><Plus className="h-4 w-4" />Category</Button><Button onClick={openCreate} disabled={!categories.length}><Plus className="h-4 w-4" />Add Expense</Button></div>
        </div>
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(row) => row.id}
          emptyTitle="No expense records"
          actions={(row) => (
            <>
              <Button variant="outline" size="sm" onClick={() => openPrint(row)} title="Print voucher">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </>
          )}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={(nextPage) => updateQuery({ page: nextPage })} />
      </Card>

      <PrintSlipModal
        open={!!printSlip}
        society={society}
        slip={printSlip}
        onClose={() => setPrintSlip(null)}
      />

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
