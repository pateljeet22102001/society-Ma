"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Wing } from "@/types/database";
import { wingSchema, type WingInput } from "@/lib/validations/society";
import { createWingAction, deleteWingAction, updateWingAction } from "@/lib/actions/wings";
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
import { ENTITY_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface WingsManagerProps {
  wings: Wing[];
}

export function WingsManager({ wings }: WingsManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<Wing | null>(null);
  const [deleting, setDeleting] = useState<Wing | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<WingInput>({
    resolver: zodResolver(wingSchema),
    defaultValues: {
      name: "",
      total_flats: 20,
      description: "",
      status: "active",
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wings;
    return wings.filter(
      (wing) =>
        wing.name.toLowerCase().includes(q) ||
        wing.description?.toLowerCase().includes(q),
    );
  }, [wings, search]);

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", total_flats: 20, description: "", status: "active" });
    setOpen(true);
  }

  function openEdit(wing: Wing) {
    setEditing(wing);
    form.reset({
      name: wing.name,
      total_flats: wing.total_flats,
      description: wing.description || "",
      status: wing.status,
    });
    setOpen(true);
  }

  async function onSubmit(values: WingInput) {
    setLoading(true);
    const result = editing
      ? await updateWingAction(editing.id, values)
      : await createWingAction(values);
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
    const result = await deleteWingAction(deleting.id);
    setLoading(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setDeleting(null);
    router.refresh();
  }

  const columns: Column<Wing>[] = [
    { key: "name", header: "Wing", render: (row) => <span className="font-medium">Wing {row.name}</span> },
    { key: "flats", header: "Flats", render: (row) => row.total_flats },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>,
    },
    { key: "created", header: "Created", render: (row) => formatDate(row.created_at) },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search wings..." />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Wing
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
          emptyTitle="No wings yet"
          emptyDescription="Create Wing A, B, C and auto-generate flats."
          actions={(row) => (
            <>
              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </>
          )}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Wing" : "Add Wing"}
        description={
          editing
            ? "Update wing details. Flat count is managed from flats."
            : "Flats will be generated automatically (e.g. A-01, A-02)."
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Wing Name" placeholder="A" error={form.formState.errors.name?.message} {...form.register("name")} />
            <Input
              label="Number of Flats"
              type="number"
              disabled={!!editing}
              error={form.formState.errors.total_flats?.message}
              {...form.register("total_flats")}
            />
          </div>
          <Select
            label="Status"
            options={[...ENTITY_STATUSES]}
            error={form.formState.errors.status?.message}
            {...form.register("status")}
          />
          <Textarea label="Description" {...form.register("description")} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {editing ? "Save Changes" : "Create Wing"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete wing?"
        description={`This will delete Wing ${deleting?.name} and its flats.`}
        confirmLabel="Delete"
        loading={loading}
        onConfirm={confirmDelete}
      />
    </>
  );
}
