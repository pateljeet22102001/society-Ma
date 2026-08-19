"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Flat, Wing } from "@/types/database";
import { flatSchema, type FlatInput } from "@/lib/validations/society";
import {
  createFlatAction,
  deleteFlatAction,
  toggleFlatStatusAction,
  updateFlatAction,
} from "@/lib/actions/flats";
import { ENTITY_STATUSES, OCCUPANCY_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE } from "@/lib/constants";

interface FlatsManagerProps {
  flats: Flat[];
  wings: Wing[];
}

export function FlatsManager({ flats, wings }: FlatsManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<Flat | null>(null);
  const [deleting, setDeleting] = useState<Flat | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FlatInput>({
    resolver: zodResolver(flatSchema),
    defaultValues: {
      wing_id: wings[0]?.id || "",
      flat_number: "",
      occupancy_type: "vacant",
      members_count: 0,
      status: "active",
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flats.filter((flat) => {
      const matchesWing = !wingFilter || flat.wing_id === wingFilter;
      const matchesSearch =
        !q ||
        flat.flat_number.toLowerCase().includes(q) ||
        flat.owner_name?.toLowerCase().includes(q) ||
        flat.resident_name?.toLowerCase().includes(q) ||
        flat.mobile_number?.includes(q);
      return matchesWing && matchesSearch;
    });
  }, [flats, search, wingFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    form.reset({
      wing_id: wings[0]?.id || "",
      flat_number: "",
      owner_name: "",
      resident_name: "",
      mobile_number: "",
      email: "",
      occupancy_type: "vacant",
      members_count: 0,
      status: "active",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(flat: Flat) {
    setEditing(flat);
    form.reset({
      wing_id: flat.wing_id,
      flat_number: flat.flat_number,
      owner_name: flat.owner_name || "",
      resident_name: flat.resident_name || "",
      mobile_number: flat.mobile_number || "",
      email: flat.email || "",
      occupancy_type: flat.occupancy_type,
      members_count: flat.members_count,
      status: flat.status,
      notes: flat.notes || "",
    });
    setOpen(true);
  }

  async function onSubmit(values: FlatInput) {
    setLoading(true);
    const result = editing
      ? await updateFlatAction(editing.id, values)
      : await createFlatAction(values);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  async function toggleStatus(flat: Flat) {
    const next = flat.status === "active" ? "inactive" : "active";
    const result = await toggleFlatStatusAction(flat.id, next);
    if (!result.success) toast.error(result.message);
    else {
      toast.success(result.message);
      router.refresh();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setLoading(true);
    const result = await deleteFlatAction(deleting.id);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setDeleting(null);
    router.refresh();
  }

  const columns: Column<Flat>[] = [
    { key: "flat", header: "Flat", render: (row) => <span className="font-medium">{row.flat_number}</span> },
    {
      key: "wing",
      header: "Wing",
      render: (row) => row.wing?.name || wings.find((w) => w.id === row.wing_id)?.name || "—",
    },
    { key: "owner", header: "Owner", render: (row) => row.owner_name || "—" },
    { key: "resident", header: "Resident", hideOnMobile: true, render: (row) => row.resident_name || "—" },
    { key: "mobile", header: "Mobile", render: (row) => row.mobile_number || "—" },
    {
      key: "occupancy",
      header: "Occupancy",
      render: (row) => <Badge variant="info">{row.occupancy_type}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>,
    },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search flats, owner, mobile..." />
            <Select
              options={[{ value: "", label: "All Wings" }, ...wings.map((w) => ({ value: w.id, label: `Wing ${w.name}` }))]}
              value={wingFilter}
              onChange={(e) => { setWingFilter(e.target.value); setPage(1); }}
            />
            <Button onClick={openCreate} disabled={!wings.length}>
              <Plus className="h-4 w-4" />
              Add Flat
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          emptyTitle="No flats found"
          emptyDescription={wings.length ? "Add a flat or create a wing with auto flats." : "Create a wing first."}
          actions={(row) => (
            <>
              <Link
                href={`/society/flats/${row.id}`}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                title="Past records"
              >
                <History className="h-4 w-4" />
              </Link>
              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleStatus(row)}>
                <Power className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </>
          )}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Flat" : "Add Flat"}
        size="lg"
      >
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Wing"
              options={wings.map((w) => ({ value: w.id, label: `Wing ${w.name}` }))}
              error={form.formState.errors.wing_id?.message}
              {...form.register("wing_id")}
            />
            <Input label="Flat Number" placeholder="A-21" error={form.formState.errors.flat_number?.message} {...form.register("flat_number")} />
            <Input label="Owner Name" {...form.register("owner_name")} />
            <Input label="Resident Name" {...form.register("resident_name")} />
            <Input label="Mobile Number" {...form.register("mobile_number")} />
            <Input label="Email" type="email" {...form.register("email")} />
            <Select label="Occupancy Type" options={[...OCCUPANCY_TYPES]} {...form.register("occupancy_type")} />
            <Input label="Number of Members" type="number" {...form.register("members_count")} />
            <Select label="Status" options={[...ENTITY_STATUSES]} {...form.register("status")} />
          </div>
          <Textarea label="Notes" {...form.register("notes")} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>{editing ? "Save Changes" : "Add Flat"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete flat?"
        description={`Delete flat ${deleting?.flat_number}?`}
        confirmLabel="Delete"
        loading={loading}
        onConfirm={confirmDelete}
      />
    </>
  );
}
