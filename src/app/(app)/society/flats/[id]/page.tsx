import { notFound } from "next/navigation";
import { FlatHistoryView } from "@/components/society/flat-history-view";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Flat history" };

interface FlatHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function FlatHistoryPage({ params }: FlatHistoryPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const society = await getPrimarySociety();
  if (!society) notFound();

  const { data: flat } = await supabase
    .from("flats")
    .select("*, wing:wings(*)")
    .eq("society_id", society.id)
    .eq("id", id)
    .maybeSingle();

  if (!flat) notFound();

  const [{ data: income }, { data: bills }, { data: payments }] = await Promise.all([
    supabase
      .from("income_transactions")
      .select("*, category:income_categories(*)")
      .eq("society_id", society.id)
      .eq("flat_id", id)
      .eq("status", "active")
      .order("transaction_date", { ascending: false }),
    supabase
      .from("maintenance_bills")
      .select("*")
      .eq("society_id", society.id)
      .eq("flat_id", id)
      .order("bill_year", { ascending: false })
      .order("bill_month", { ascending: false }),
    supabase
      .from("maintenance_payments")
      .select("*")
      .eq("society_id", society.id)
      .eq("flat_id", id)
      .order("payment_date", { ascending: false }),
  ]);

  return (
    <FlatHistoryView
      flat={flat}
      income={income || []}
      bills={bills || []}
      payments={payments || []}
    />
  );
}
