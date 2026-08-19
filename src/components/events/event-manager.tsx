"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarHeart, CheckCircle2, Gift, IndianRupee, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { EventContribution, EventExpense, EventFlatContribution, SocietyEvent } from "@/types/database";
import { addEventAavakAction, addEventExpenseAction, addEventPaymentAction, createEventAction, deleteEventRecordAction, generateEventContributionsAction, undoEventPaymentAction } from "@/lib/actions/events";
import { PAYMENT_MODES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = { events: SocietyEvent[]; flatContributions: EventFlatContribution[]; aavak: EventContribution[]; expenses: EventExpense[] };
const today = () => new Date().toISOString().slice(0, 10);
const moneyCategories = ["Public donation", "Society member donation", "Sponsorship", "Advertisement", "Stall income", "Pass / ticket", "Other"];
const expenseCategories = ["Sound system", "Nasta / food", "Decoration", "Lighting", "Garba / orchestra", "Puja material", "Prizes / gifts", "Cleaning", "Security", "Tent / chairs", "Printing", "Other"];

export function EventManager({ events, flatContributions, aavak, expenses }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEvent = searchParams.get("event");
  const [eventId, setEventId] = useState(events.some((item) => item.id === requestedEvent) ? requestedEvent || "" : events[0]?.id || "");
  const event = events.find((e) => e.id === eventId);
  const [modal, setModal] = useState<"event" | "pay" | "aavak" | "expense" | null>(null);
  const [selected, setSelected] = useState<EventFlatContribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<"money" | "item">("money");
  const [warning, setWarning] = useState<{ message: string; retry: () => Promise<{success:boolean;message?:string;requiresConfirmation?:boolean}> } | null>(null);
  const [destructive, setDestructive] = useState<{ title: string; description: string; action: () => Promise<{success:boolean;message?:string}> } | null>(null);
  const rows = flatContributions.filter((x) => x.event_id === eventId);
  const income = aavak.filter((x) => x.event_id === eventId);
  const outgo = expenses.filter((x) => x.event_id === eventId);
  const summary = useMemo(() => {
    const expected = rows.reduce((s, x) => s + Number(x.amount), 0);
    const flatPaid = rows.reduce((s, x) => s + Number(x.paid_amount), 0);
    const pending = rows.reduce((s, x) => s + Number(x.pending_amount), 0);
    const cashAavak = income.filter((x) => x.contribution_type === "money").reduce((s, x) => s + Number(x.amount), 0);
    const itemValue = income.filter((x) => x.contribution_type === "item").reduce((s, x) => s + Number(x.total_value), 0);
    const javak = outgo.reduce((s, x) => s + Number(x.amount), 0);
    return { expected, flatPaid, pending, cashAavak, itemValue, javak, balance: flatPaid + cashAavak - javak };
  }, [rows, income, outgo]);
  async function run(action: Promise<{success:boolean;message?:string;requiresConfirmation?:boolean}>, close = true, retry?: () => Promise<{success:boolean;message?:string;requiresConfirmation?:boolean}>) { setLoading(true); const r = await action; setLoading(false); if (r.requiresConfirmation && retry) { setWarning({ message: r.message || "Please confirm this entry.", retry }); return; } if (r.success) toast.success(r.message); else toast.error(r.message); if (r.success) { setWarning(null); setDestructive(null); if (close) setModal(null); router.refresh(); } }
  function formData(form: HTMLFormElement) { return Object.fromEntries(new FormData(form)); }

  return <div className="space-y-4">
    <Card><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Select className="flex-1" label="Event" placeholder="Create an event first" value={eventId} onChange={(e) => setEventId(e.target.value)} options={events.map((e) => ({ value: e.id, label: `${e.name} ${e.event_year}` }))} />
      <Button className="w-full sm:w-auto" onClick={() => setModal("event")}><Plus className="h-4 w-4" />Create Event</Button>
    </CardContent></Card>

    {event ? <>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard title="Expected Flat Contribution" value={formatCurrency(summary.expected)} icon={IndianRupee} />
        <StatCard title="Flat Contribution Collected" value={formatCurrency(summary.flatPaid)} icon={CheckCircle2} tone="green" />
        <StatCard title="Pending From Flats" value={formatCurrency(summary.pending)} icon={Wallet} tone="amber" />
        <StatCard title="Other Cash Aavak" value={formatCurrency(summary.cashAavak)} icon={IndianRupee} tone="green" />
        <StatCard title="Donated Item Value" value={formatCurrency(summary.itemValue)} icon={Gift} tone="slate" hint="Not included in cash balance" />
        <StatCard title="Event Javak" value={formatCurrency(summary.javak)} icon={IndianRupee} tone="rose" />
        <StatCard title="Available Cash Balance" value={formatCurrency(summary.balance)} icon={Wallet} tone={summary.balance >= 0 ? "blue" : "rose"} />
        <StatCard title="Paid Flats" value={String(rows.filter((x) => x.status === "paid").length)} icon={CalendarHeart} tone="green" />
      </div>

      <Card><CardHeader title="Flat Contributions" description={`${formatCurrency(event.contribution_amount)} fixed per active flat`} action={<Button className="w-full sm:w-auto" variant="outline" onClick={() => run(generateEventContributionsAction(event.id), false)}>Generate for Flats</Button>} />
        {rows.length ? <>
          <div className="space-y-3 p-4 md:hidden">{rows.map(row=><div key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">Flat {row.flat?.flat_number || "—"}</p><p className="mt-1 text-xs text-slate-500">Contribution {formatCurrency(row.amount)}</p></div><Badge variant={statusBadgeVariant(row.status)}>{row.status.replace("_"," ")}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-xs text-slate-500">Paid</p><p className="mt-1 font-semibold text-emerald-600">{formatCurrency(row.paid_amount)}</p></div><div><p className="text-xs text-slate-500">Pending</p><p className="mt-1 font-semibold text-amber-600">{formatCurrency(row.pending_amount)}</p></div></div><div className="mt-3 flex flex-wrap justify-end gap-2">{Number(row.pending_amount)>0?<Button className="min-w-20" size="sm" onClick={()=>{setSelected(row);setModal("pay")}}>Pay</Button>:null}{Number(row.paid_amount)>0?<Button size="sm" variant="outline" onClick={()=>setDestructive({title:"Undo last event payment?",description:`The most recent payment for flat ${row.flat?.flat_number || "this flat"} will be removed and its pending balance recalculated.`,action:()=>undoEventPaymentAction(row.id)})}>Undo payment</Button>:null}</div></div>)}</div>
          <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Flat","Amount","Paid","Pending","Status","Actions"].map(x=><th key={x} className="whitespace-nowrap px-4 py-3 text-left font-medium">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row=><tr key={row.id}><td className="px-4 py-3">{row.flat?.flat_number}</td><td className="px-4 py-3">{formatCurrency(row.amount)}</td><td className="px-4 py-3">{formatCurrency(row.paid_amount)}</td><td className="px-4 py-3">{formatCurrency(row.pending_amount)}</td><td className="px-4 py-3"><Badge variant={statusBadgeVariant(row.status)}>{row.status.replace("_"," ")}</Badge></td><td className="px-4 py-3"><div className="flex gap-2">{Number(row.pending_amount)>0?<Button size="sm" onClick={()=>{setSelected(row);setModal("pay")}}>Pay</Button>:null}{Number(row.paid_amount)>0?<Button size="sm" variant="outline" onClick={()=>setDestructive({title:"Undo last event payment?",description:`The most recent payment for flat ${row.flat?.flat_number || "this flat"} will be removed and its pending balance recalculated.`,action:()=>undoEventPaymentAction(row.id)})}>Undo</Button>:null}</div></td></tr>)}</tbody></table></div>
        </> : <p className="p-6 text-center text-sm text-slate-500">Generate fixed contributions for active flats.</p>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader title="Event Aavak / Donations" description="Money and donated items in one list" action={<Button className="w-full sm:w-auto" size="sm" onClick={()=>setModal("aavak")}><Plus className="h-4 w-4"/>Add Aavak</Button>} /><div className="divide-y divide-slate-100">{income.map(x=><div key={x.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium">{x.contribution_type === "item" ? x.item_name : x.category}</p><p className="mt-1 break-words text-xs text-slate-500">{x.donor_name || "Anonymous"} · {formatDate(x.contribution_date)}{x.contribution_type === "item" ? ` · ${x.quantity} ${x.unit} × ${formatCurrency(x.unit_price || 0)}` : ""}</p></div><div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end"><span className="font-semibold text-emerald-600">{formatCurrency(x.contribution_type === "money" ? x.amount || 0 : x.total_value)}</span><Button size="icon" variant="ghost" aria-label="Delete event Aavak" onClick={()=>setDestructive({title:"Delete event Aavak?",description:"This donation or Aavak record will be permanently deleted.",action:()=>deleteEventRecordAction("event_contributions",x.id)})}><Trash2 className="h-4 w-4 text-rose-500"/></Button></div></div>)}{!income.length?<p className="p-5 text-sm text-slate-500">No event Aavak yet.</p>:null}</div></Card>
        <Card><CardHeader title="Event Javak" description="Sound, nasta, decoration and other expenses" action={<Button className="w-full sm:w-auto" size="sm" onClick={()=>setModal("expense")}><Plus className="h-4 w-4"/>Add Javak</Button>} /><div className="divide-y divide-slate-100">{outgo.map(x=><div key={x.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium">{x.category}</p><p className="mt-1 break-words text-xs text-slate-500">{x.vendor_name || "No vendor"} · {formatDate(x.expense_date)}</p></div><div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end"><span className="font-semibold text-rose-600">{formatCurrency(x.amount)}</span><Button size="icon" variant="ghost" aria-label="Delete event Javak" onClick={()=>setDestructive({title:"Delete event Javak?",description:"This event expense record will be permanently deleted.",action:()=>deleteEventRecordAction("event_expenses",x.id)})}><Trash2 className="h-4 w-4 text-rose-500"/></Button></div></div>)}{!outgo.length?<p className="p-5 text-sm text-slate-500">No event expenses yet.</p>:null}</div></Card>
      </div>
    </> : <Card><CardContent className="py-10 text-center text-slate-500">Create your first event, for example Navratri 2026.</CardContent></Card>}

    <Modal open={modal==="event"} onClose={()=>setModal(null)} title="Create Event"><form className="space-y-4" onSubmit={e=>{e.preventDefault();run(createEventAction(formData(e.currentTarget)) as never)}}><div className="grid gap-4 sm:grid-cols-2"><Input required name="name" label="Event Name" placeholder="Navratri"/><Input required name="event_year" type="number" label="Year" defaultValue={new Date().getFullYear()}/><Input name="start_date" type="date" label="Start Date"/><Input name="end_date" type="date" label="End Date"/><Input required name="contribution_amount" type="number" step="0.01" label="Fixed Amount Per Flat"/><Input name="due_date" type="date" label="Due Date"/></div><Textarea name="description" label="Description"/><Button className="w-full sm:w-auto" type="submit" loading={loading}>Create Event</Button></form></Modal>
    <Modal open={modal==="pay"} onClose={()=>setModal(null)} title="Collect Flat Contribution"><form className="space-y-4" onSubmit={e=>{e.preventDefault();const values={...formData(e.currentTarget),contribution_id:selected?.id};run(addEventPaymentAction(values),true,()=>addEventPaymentAction(values,true))}}><Input required name="amount" type="number" min="0.01" step="0.01" max={Number(selected?.pending_amount)} defaultValue={Number(selected?.pending_amount)} label="Amount"/><Input required name="payment_date" type="date" defaultValue={today()} label="Date"/><Select name="payment_mode" label="Payment Mode" options={[...PAYMENT_MODES]}/><Input name="reference_number" label="Reference Number"/><Button className="w-full sm:w-auto" type="submit" loading={loading}>Save Payment</Button></form></Modal>
    <Modal open={modal==="aavak"} onClose={()=>setModal(null)} title="Add Event Aavak" size="lg"><form className="space-y-4" onSubmit={e=>{e.preventDefault();const values={...formData(e.currentTarget),event_id:eventId,contribution_type:kind};run(addEventAavakAction(values),true,()=>addEventAavakAction(values,true))}}><Select label="Contribution Type" value={kind} onChange={e=>setKind(e.target.value as "money"|"item")} options={[{value:"money",label:"Money"},{value:"item",label:"Item / Goods"}]}/><div className="grid gap-4 sm:grid-cols-2"><Input name="donor_name" label="Donor / Payer Name"/><Input name="mobile_number" label="Mobile Number"/>{kind==="money"?<><Select name="category" label="Category" options={moneyCategories.map(x=>({value:x,label:x}))}/><Input required name="amount" type="number" min="0.01" step="0.01" label="Amount"/><Select name="payment_mode" label="Payment Mode" options={[...PAYMENT_MODES]}/><Input name="reference_number" label="Receipt / Reference"/></>:<><Input name="category" type="hidden" value="Item donation"/><Input required name="item_name" label="Item Name" placeholder="Ghee"/><Input required name="quantity" type="number" min="0.001" step="0.001" label="Quantity"/><Input required name="unit" label="Unit" placeholder="kg / litre / piece"/><Input name="unit_price" type="number" min="0" step="0.01" label="Price Per Unit"/></>}<Input required name="contribution_date" type="date" defaultValue={today()} label="Date"/></div><Textarea name="notes" label="Notes"/><Button className="w-full sm:w-auto" type="submit" loading={loading}>Add Aavak</Button></form></Modal>
    <Modal open={modal==="expense"} onClose={()=>setModal(null)} title="Add Event Javak" size="lg"><form className="space-y-4" onSubmit={e=>{e.preventDefault();const values={...formData(e.currentTarget),event_id:eventId};run(addEventExpenseAction(values),true,()=>addEventExpenseAction(values,true))}}><div className="grid gap-4 sm:grid-cols-2"><Select name="category" label="Expense" options={expenseCategories.map(x=>({value:x,label:x}))}/><Input name="vendor_name" label="Vendor / Person"/><Input required name="amount" type="number" min="0.01" step="0.01" label="Price / Amount"/><Input required name="expense_date" type="date" defaultValue={today()} label="Date"/><Select name="payment_mode" label="Payment Mode" options={[...PAYMENT_MODES]}/><Input name="reference_number" label="Bill / Reference"/></div><Textarea name="notes" label="Notes"/><Button className="w-full sm:w-auto" type="submit" loading={loading}>Add Javak</Button></form></Modal>
    <ConfirmDialog open={!!warning} title="Check event entry" description={warning?.message || "Please confirm this entry."} confirmLabel="Continue and save" loading={loading} onClose={()=>setWarning(null)} onConfirm={()=>warning && run(warning.retry())}/>
    <ConfirmDialog open={!!destructive} title={destructive?.title || "Confirm action"} description={destructive?.description || "This action cannot be undone."} confirmLabel="Confirm" loading={loading} onClose={()=>setDestructive(null)} onConfirm={()=>destructive && run(destructive.action(),false)}/>
  </div>;
}
